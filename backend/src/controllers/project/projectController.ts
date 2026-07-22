import { Request, Response } from "express";
import prisma from "../../utils/prismaClient";
import ProjectService from "../../services/project/project";
import { NotFoundError } from "../../utils/error";
import { uploadThumbnail } from "../../middleware/upload";
import logger from "../../logger";
import { reviewVideoFile } from "../../services/aiVideoReviewService";
import { publishAndAwardProject, extractYouTubeId } from "../admin/videoApprovalController";
import { notifyAllAdmins } from "../../services/notificationService";
import { generateUploadUrl, downloadToTempFile, deleteFromStorage, publicUrlFor } from "../../services/firebaseStorageService";

// ✅ Import YouTube upload service (optional)
let uploadToYouTube: any = null;
try {
  const youtubeService = require("../../services/youtubeUploadService");
  uploadToYouTube = youtubeService.uploadToYouTube;
  logger.info('YouTube service loaded in project controller');
} catch (error) {
  logger.warn({ error: (error as Error).message }, 'YouTube service not available in project controller - YouTube features will be disabled');
}

const projectService = new ProjectService();

export const createProject = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // ── Child session awareness ─────────────────────────────────────────
  // req.subject is set by resolveSubject (wired into this route). When a
  // mentor is inside a child's PIN session, req.subject.isChild is true and
  // the project (and its eventual Goins on approval) must be attributed to
  // the CHILD's own account — req.subject.linkedUserId — not the mentor's
  // JWT-holding userId above. Project.userId is a foreign key to User, and
  // every child has an independent User login via ChildProfile.linkedUserId
  // (see resolveSubject.ts), so that's the correct id to use here.
  //
  // If somehow no PIN session is active (or resolveSubject wasn't run —
  // defensive fallback), ownerUserId is just the normal logged-in user,
  // identical to the old behaviour.
  let ownerUserId = userId;
  if (req.subject?.isChild) {
    if (!req.subject.linkedUserId) {
      // A legacy/incompletely-provisioned ChildProfile with no independent
      // login yet. Fail loudly rather than silently crediting the mentor —
      // losing Goins into the wrong account is worse than a clear error.
      return res.status(400).json({
        error:
          "This child profile doesn't have an independent login set up yet, " +
          "so their project can't be attributed correctly. Ask an admin to " +
          "complete the child's account setup (linkedUserId) before uploading.",
      });
    }
    ownerUserId = req.subject.linkedUserId;
  }

  const {
    title, description, startDate, endDate, materials, categoryName, collaboratorIds,
    videoStoragePath, thumbnailStoragePath, challengeId,
  } = req.body;

  if (!title || !description || !startDate || !endDate || !materials || !categoryName) {
    return res.status(400).json({ error: "All fields are required" });
  }
  if (!videoStoragePath) {
    return res.status(400).json({ error: "Video is required" });
  }

  // ── Shared/group projects — collaborators (optional) ────────────────
  // Collaborators can ONLY be set here, at upload time. There is no
  // endpoint to add one after the Project exists — this is intentional
  // (confirmed product decision: planning-only, instant-add, equal split).
  let collaborators: { userId: string; name: string }[] = [];
  if (collaboratorIds) {
    let parsedIds: string[] = [];
    try {
      parsedIds = typeof collaboratorIds === "string"
        ? JSON.parse(collaboratorIds)
        : collaboratorIds;
      if (!Array.isArray(parsedIds)) parsedIds = [];
    } catch {
      parsedIds = [];
    }
    // de-dupe, drop the owner if they somehow added themselves
    parsedIds = [...new Set(parsedIds)].filter((cid) => cid !== ownerUserId);
    if (parsedIds.length > 0) {
      try {
        const collaboratorUsers = await prisma.user.findMany({
          where: { id: { in: parsedIds } },
          select: { id: true, name: true },
        });
        collaborators = collaboratorUsers.map((u) => ({ userId: u.id, name: u.name }));
      } catch (collabError) {
        // Non-fatal — an upload should never hang or fail just because the
        // collaborator lookup had a hiccup. Proceed as a solo project.
        logger.warn(
          `Collaborator lookup failed, proceeding without them: ${(collabError as Error).message}`
        );
        collaborators = [];
      }
    }
  }

  // STEAM Challenge join (optional). A child can pick a challenge while
  // planning. Must be APPROVED and not yet ended - anything else is
  // silently ignored (fail-open, same philosophy as the collaborator
  // lookup below): an upload should never fail just because a challenge
  // reference went stale while the child was building. Bonus Goins for
  // this are awarded later, on admin approval - see
  // publishAndAwardProject() in videoApprovalController.ts.
  let validChallengeId: string | undefined;
  if (challengeId && typeof challengeId === "string") {
    try {
      const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
      if (challenge && challenge.status === "APPROVED" && challenge.endDate >= new Date()) {
        validChallengeId = challenge.id;
        // Reflect real interest immediately, independent of approval timing.
        await prisma.challenge.update({
          where: { id: challenge.id },
          data: { participants: { increment: 1 } },
        }).catch(() => {});
      }
    } catch (challengeError) {
      logger.warn(
        `Challenge lookup failed, proceeding without it: ${(challengeError as Error).message}`
      );
    }
  }

  let parsedMaterials: { id: string; quantity: number }[] = [];
  try {
    if (typeof materials === "string") {
      parsedMaterials = JSON.parse(materials);
      if (!Array.isArray(parsedMaterials)) {
        return res.status(400).json({ error: "Materials must be an array" });
      }
    } else if (Array.isArray(materials)) {
      parsedMaterials = materials;
    } else {
      return res.status(400).json({ error: "Invalid materials format" });
    }
  } catch (error) {
    logger.error(error as Error);
    return res.status(400).json({ error: "Invalid materials format" });
  }

  // ── Video arrives via Firebase Storage now, not the request body ─────
  // Cloud Run enforces a hard, non-configurable 32MB limit on incoming
  // request bodies — real videos routinely exceed that (confirmed via a
  // real 413 response). The Flutter app now uploads the video (and
  // optional thumbnail) DIRECTLY to Firebase Storage first (see
  // requestUploadUrl below), completely bypassing that limit, then sends
  // us just this small JSON request with the storage path(s). We download
  // the video here, server-to-server — Cloud Run's body-size limit only
  // applies to requests INTO Cloud Run from outside, not to Cloud Run's
  // own outbound calls, so this direction is unaffected.
  let localVideoPath: string;
  try {
    localVideoPath = await downloadToTempFile(videoStoragePath);
  } catch (downloadError) {
    logger.error(`Failed to download video from storage: ${(downloadError as Error).message}`);
    return res.status(500).json({ error: "Could not retrieve the uploaded video. Please try again." });
  }

  // The thumbnail is just referenced by its already-public Firebase
  // Storage URL — no need to re-download or re-host it locally (which was
  // also, incidentally, subject to the same "Cloud Run disk writes count
  // as container RAM" gotcha as the old video path — this fixes that too).
  const thumbnailPath = thumbnailStoragePath ? publicUrlFor(thumbnailStoragePath) : "";

  // ── AI first-pass video review ──────────────────────────────────────
  // MUST run here, BEFORE uploadToYouTube() below — youtubeUploadService.js
  // deletes the local video file (fs.unlinkSync) immediately after its
  // upload call, win or lose. reviewVideoFile() is documented to never
  // throw (any failure resolves to UNSURE) — but this outer try/catch is a
  // belt-and-suspenders guarantee: NOTHING in this handler may hang the
  // request without a response, since that's exactly what happened before
  // (the browser reports the resulting timeout as a false "CORS" error).
  let aiReview: { verdict: string; reason: string; confidence: number };
  try {
    aiReview = await reviewVideoFile(localVideoPath, "video/mp4");
  } catch (aiError) {
    logger.error(`AI review threw unexpectedly (should never happen): ${(aiError as Error).message}`);
    aiReview = { verdict: "UNSURE", reason: "AI review failed unexpectedly — needs human review.", confidence: 0 };
  }
  const aiReviewedAt = new Date();
  logger.info(
    `AI review for "${title}": ${aiReview.verdict} (confidence ${aiReview.confidence}) — ${aiReview.reason}`
  );

  // ✅ Upload video to YouTube as UNLISTED (optional - falls back to local if unavailable)
  // NOTE: this always runs regardless of the AI verdict above. Cloud Run's
  // local disk is ephemeral (containers restart on their own) — a video
  // flagged by AI but never uploaded to YouTube could simply vanish before
  // a human ever reviews it. The AI verdict decides what happens *after*
  // the upload, not whether the upload happens at all.
  let videoUrl = "";
  if (uploadToYouTube) {
    try {
      logger.info(`📤 Uploading video to YouTube for project: "${title}"`);

      const result = await uploadToYouTube(
        localVideoPath,
        {
          title: title,
          description: description || "",
          tags: ["MiniGuru", "STEM", "Education", "India"],
        }
      );

      videoUrl = result.url; // e.g. https://www.youtube.com/watch?v=ABC123
      logger.info(`✅ YouTube upload successful. Video ID: ${result.videoId}`);
    } catch (error) {
      logger.error(`❌ YouTube upload failed: ${(error as Error).message}`);
      return res.status(500).json({
        error: "Failed to upload video to YouTube. Please try again.",
      });
    }
  } else {
    logger.warn('YouTube service not available, skipping video upload');
    // For now, we'll store an empty videoUrl - this might need to be handled differently
    // depending on how the frontend expects to handle videos without YouTube
    videoUrl = ""; // Or you could return an error here
  }

  // The Firebase Storage copy of the VIDEO was only ever a staging area to
  // get it past Cloud Run's request-size limit — not needed once YouTube
  // has it. Deliberately NOT deleting the thumbnail: its Firebase Storage
  // URL IS the permanent thumbnail reference stored on the project.
  deleteFromStorage(videoStoragePath).catch(() => {});

  try {
    const project = await projectService.create(ownerUserId, {
      title,
      description,
      startDate,
      endDate,
      materials: parsedMaterials,
      categoryName,
      thumbnailPath,
      videoUrl, // ✅ Now a YouTube URL, stored in project.video.url
      collaborators,
      challengeId: validChallengeId,
      aiVerdict: aiReview.verdict,
      aiReason: aiReview.reason,
      aiConfidence: aiReview.confidence,
      aiReviewedAt,
    });

    // NOTE: Goins are awarded ONLY on admin approval (see approveProject in
    // videoApprovalController.ts) — never at upload time. Previously this
    // line awarded +100 Goins immediately on upload, which double-paid
    // every child (once here, again on approval) and paid out even for
    // videos that were later rejected. Removed — do not re-add.

    // ── Route the project based on the AI verdict ──────────────────────
    // APPROVE: the service itself only returns APPROVE when confidence is
    //   already >= MIN_CONFIDENCE_FOR_APPROVE (0.85) — that check lives in
    //   aiVideoReviewService.ts, not duplicated here. Auto-publish uses the
    //   SAME publishAndAwardProject() function the admin "Approve" button
    //   calls, so both paths always stay in sync.
    // REJECT: video stays uploaded (Unlisted) and project stays 'pending' —
    //   admin sees a red badge with the AI's reason and has final say.
    // UNSURE: same as REJECT, plus an email alert so nothing sits unnoticed.
    if (aiReview.verdict === "APPROVE" && videoUrl) {
      try {
        await publishAndAwardProject(project.id);
        logger.info(`🤖 AI auto-approved + published project ${project.id}`);
      } catch (publishError) {
        // Never fail the upload response over this — the project already
        // exists and sits in the normal admin queue as a safe fallback.
        logger.error(
          `AI auto-approve failed for project ${project.id}, left pending for manual review: ` +
          `${(publishError as Error).message}`
        );
      }
    } else if (aiReview.verdict === "UNSURE") {
      try {
        // In-app notification, not email — admin already sees this project
        // with its AI badge on admin.miniguru.in/videos; this just makes
        // sure it doesn't sit unnoticed without adding to email quota.
        await notifyAllAdmins({
          type: "ai_review_unsure",
          emoji: "🤔",
          message: `AI review UNSURE on "${title}" — ${aiReview.reason}`,
          link: "/videos",
        });
      } catch (notifyError) {
        // Non-fatal — the project still sits correctly in the pending
        // queue with its AI badge even if this in-app notification fails.
        logger.warn(`Failed to create AI-UNSURE admin notification (non-fatal): ${(notifyError as Error).message}`);
      }
    }

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    logger.error(error);
    res.status(500).json({ error: (error as Error).message });
  }
};

// POST /project/request-upload-url — generates a short-lived signed URL the
// client can PUT a video or thumbnail to DIRECTLY, bypassing Cloud Run's
// hard 32MB request body limit entirely for the actual file bytes.
export const requestUploadUrl = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { filename, contentType, kind } = req.body;
  if (!filename || !contentType || !kind) {
    return res.status(400).json({ error: "filename, contentType, and kind are required" });
  }
  if (kind !== "video" && kind !== "thumbnail") {
    return res.status(400).json({ error: "kind must be 'video' or 'thumbnail'" });
  }

  try {
    const folder = kind === "video" ? "temp-videos" : "project-thumbnails";
    const { uploadUrl, storagePath } = await generateUploadUrl(folder, userId, filename, contentType);
    res.json({ uploadUrl, storagePath });
  } catch (error) {
    logger.error(`Failed to generate upload URL: ${(error as Error).message}`);
    res.status(500).json({ error: "Could not prepare upload. Please try again." });
  }
};

export const updateProject = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;
  const {
    title,
    description,
    startDate,
    endDate,
    materials,
    categoryName,
  } = req.body;

  const thumbnailPath = req.file ? await uploadThumbnail(req.file) : "";

  // NOTE: updateProject doesn't re-upload to YouTube (keep existing video URL)
  // If you need video replacement, add YouTube upload logic here similarly
  const videoUrl = "";

  try {
    const project = await projectService.update(userId, id, {
      title,
      description,
      startDate,
      endDate,
      materials,
      categoryName,
      thumbnailPath,
      videoUrl,
    });

    res.json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Error ${error}`);
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getProjectById = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const { id } = req.params;

  try {
    const project = await projectService.getById(userId, id);
    res.json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getAllProjectsForUser = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  // Same reasoning as createProject: during a child PIN session, "my
  // projects" must mean the CHILD's projects (their linked User.id), not
  // the mentor's own. Falls back to the mentor/normal user otherwise.
  const effectiveUserId =
    req.subject?.isChild && req.subject.linkedUserId ? req.subject.linkedUserId : userId;

  try {
    const projects = await projectService.getAllForUser(effectiveUserId);
    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

export const getAllProjects = async (req: Request, res: Response) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 10;

  if (page < 1 || limit < 1) {
    return res.status(400).json({ error: "Page and limit must be greater than 0" });
  }

  try {
    const { projects, totalProjects } = await projectService.getAll(page, limit);
    res.json({
      projects,
      pagination: {
        totalProjects,
        currentPage: page,
        totalPages: Math.ceil(totalProjects / limit),
        pageSize: limit,
      },
    });
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
};

// GET /project/feed — public, no auth required
//
// Replaces the old approach of the Flutter app calling YouTube's own API
// directly from the client (YouTubeService.getChannelVideos in
// youtube_service.dart) to build the home screen's video list. That
// approach had two real problems:
//   1. It hit YouTube Data API v3 quota on EVERY home-screen load, by every
//      user, with zero caching — burning the same shared 10,000 units/day
//      pool that video uploads use, and silently falling back to a fake
//      "placeholder" video list on any failure (network blip, quota hit,
//      timeout) — this is what caused videos to intermittently not load or
//      show placeholders "at times".
//   2. It depended on YouTube's own playlist-indexing catching up after a
//      video went Public, adding avoidable delay right after approval.
//
// This endpoint reads directly from MiniGuru's own database instead —
// zero YouTube API calls, zero quota cost, always consistent the moment a
// video is approved. Field names match exactly what home.dart already
// expects from YouTubeService.getChannelVideos() (videoId, id, title,
// description, channelTitle, viewCount, thumbnail) so the Flutter-side
// change is just swapping which method is called, not the data shape.
export const getPublishedVideoFeed = async (req: Request, res: Response) => {
  try {
    const limit = Math.min(50, parseInt(req.query.limit as string) || 50);

    const projects = await prisma.project.findMany({
      where: { status: "published" },
      orderBy: { updatedAt: "desc" },
      take: limit,
      include: {
        user: { select: { name: true } },
      },
    });

    const videos = projects
      .filter((p) => p.video?.url) // defensive — skip any malformed record rather than 500
      .map((p) => {
        const videoId = extractYouTubeId(p.video!.url);
        // Shared/group projects — show every team member's name, not just
        // the owner. channelTitle is a single shared field read identically
        // by every screen (home cards, video detail "by X", rating widget
        // messages), so fixing it here fixes the display everywhere at once.
        const collaboratorNames = ((p as any).collaborators as
          Array<{ userId: string; name: string }> | null) || [];
        const teamNames = [p.user?.name || "MiniGuru Maker", ...collaboratorNames.map((c) => c.name)];
        return {
          id: p.id,
          projectId: p.id,
          videoId,
          title: p.title,
          description: p.description,
          channelTitle: teamNames.join(", "),
          viewCount: 0, // view tracking lives in /api/videos/:id/views — not duplicated here
          // Prefer our own stored thumbnail (set at upload time); fall back
          // to YouTube's own free, no-API-call thumbnail CDN URL — never
          // an empty/broken image.
          thumbnail: p.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
        };
      });

    return res.status(200).json({ videos });
  } catch (error) {
    logger.error(`getPublishedVideoFeed error: ${(error as Error).message}`);
    return res.status(500).json({ error: "Failed to load video feed." });
  }
};

export const deleteProjectByID = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId && req.user?.role !== "ADMIN") return res.status(401).json({ error: "Unauthorized" });

  const { projectId } = req.params;

  try {
    await projectService.deleteById(projectId);
    res.status(204).end();
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: (error as Error).message });
  }
};

// GET /project/find-collaborator/:miniguruId
// Looks up another user by their MiniGuru ID (login email) so a child can
// add them as a project collaborator while planning. Returns only id+name —
// never anything sensitive. Excludes the requester themselves.
export const findCollaborator = async (req: Request, res: Response) => {
  const requesterId = req.user?.userId;
  if (!requesterId) return res.status(401).json({ error: "Unauthorized" });

  const { miniguruId } = req.params;
  if (!miniguruId) return res.status(400).json({ error: "MiniGuru ID is required" });

  try {
    const user = await prisma.user.findUnique({
      where: { email: miniguruId.trim().toLowerCase() },
      select: { id: true, name: true },
    });

    if (!user) {
      return res.status(404).json({ error: "No MiniGuru account found with that ID" });
    }
    if (user.id === requesterId) {
      return res.status(400).json({ error: "You can't add yourself as a collaborator" });
    }

    return res.status(200).json({ id: user.id, name: user.name });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};