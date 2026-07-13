"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCollaborator = exports.deleteProjectByID = exports.getPublishedVideoFeed = exports.getAllProjects = exports.getAllProjectsForUser = exports.getProjectById = exports.updateProject = exports.createProject = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const project_1 = __importDefault(require("../../services/project/project"));
const error_1 = require("../../utils/error");
const upload_1 = require("../../middleware/upload");
const logger_1 = __importDefault(require("../../logger"));
const aiVideoReviewService_1 = require("../../services/aiVideoReviewService");
const videoApprovalController_1 = require("../admin/videoApprovalController");
const notificationService_1 = require("../../services/notificationService");
// ✅ Import YouTube upload service (optional)
let uploadToYouTube = null;
try {
    const youtubeService = require("../../services/youtubeUploadService");
    uploadToYouTube = youtubeService.uploadToYouTube;
    logger_1.default.info('YouTube service loaded in project controller');
}
catch (error) {
    logger_1.default.warn({ error: error.message }, 'YouTube service not available in project controller - YouTube features will be disabled');
}
const projectService = new project_1.default();
const createProject = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
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
                error: "This child profile doesn't have an independent login set up yet, " +
                    "so their project can't be attributed correctly. Ask an admin to " +
                    "complete the child's account setup (linkedUserId) before uploading.",
            });
        }
        ownerUserId = req.subject.linkedUserId;
    }
    const { title, description, startDate, endDate, materials, categoryName, collaboratorIds } = req.body;
    if (!title || !description || !startDate || !endDate || !materials || !categoryName) {
        return res.status(400).json({ error: "All fields are required" });
    }
    // ── Shared/group projects — collaborators (optional) ────────────────
    // Collaborators can ONLY be set here, at upload time. There is no
    // endpoint to add one after the Project exists — this is intentional
    // (confirmed product decision: planning-only, instant-add, equal split).
    let collaborators = [];
    if (collaboratorIds) {
        let parsedIds = [];
        try {
            parsedIds = typeof collaboratorIds === "string"
                ? JSON.parse(collaboratorIds)
                : collaboratorIds;
            if (!Array.isArray(parsedIds))
                parsedIds = [];
        }
        catch {
            parsedIds = [];
        }
        // de-dupe, drop the owner if they somehow added themselves
        parsedIds = [...new Set(parsedIds)].filter((cid) => cid !== ownerUserId);
        if (parsedIds.length > 0) {
            const collaboratorUsers = await prismaClient_1.default.user.findMany({
                where: { id: { in: parsedIds } },
                select: { id: true, name: true },
            });
            collaborators = collaboratorUsers.map((u) => ({ userId: u.id, name: u.name }));
        }
    }
    let parsedMaterials = [];
    try {
        if (typeof materials === "string") {
            parsedMaterials = JSON.parse(materials);
            if (!Array.isArray(parsedMaterials)) {
                return res.status(400).json({ error: "Materials must be an array" });
            }
        }
        else if (Array.isArray(materials)) {
            parsedMaterials = materials;
        }
        else {
            return res.status(400).json({ error: "Invalid materials format" });
        }
    }
    catch (error) {
        logger_1.default.error(error);
        return res.status(400).json({ error: "Invalid materials format" });
    }
    const files = req.files;
    const thumbnailFile = files?.thumbnail?.[0];
    const videoFile = files?.video?.[0];
    if (!videoFile) {
        return res.status(400).json({ error: "Video file is required" });
    }
    // ✅ Upload thumbnail as before (local storage)
    const thumbnailPath = thumbnailFile ? await (0, upload_1.uploadThumbnail)(thumbnailFile) : "";
    // ── AI first-pass video review ──────────────────────────────────────
    // MUST run here, BEFORE uploadToYouTube() below — youtubeUploadService.js
    // deletes the local video file (fs.unlinkSync) immediately after its
    // upload call, win or lose. reviewVideoFile() never throws: any failure
    // (missing GEMINI_API_KEY, quota exhausted, network error, malformed
    // response) resolves to UNSURE so a human always gets the final say.
    const aiReview = await (0, aiVideoReviewService_1.reviewVideoFile)(videoFile.path, videoFile.mimetype);
    const aiReviewedAt = new Date();
    logger_1.default.info(`AI review for "${title}": ${aiReview.verdict} (confidence ${aiReview.confidence}) — ${aiReview.reason}`);
    // ✅ Upload video to YouTube as UNLISTED (optional - falls back to local if unavailable)
    // NOTE: this always runs regardless of the AI verdict above. Cloud Run's
    // local disk is ephemeral (containers restart on their own) — a video
    // flagged by AI but never uploaded to YouTube could simply vanish before
    // a human ever reviews it. The AI verdict decides what happens *after*
    // the upload, not whether the upload happens at all.
    let videoUrl = "";
    if (uploadToYouTube) {
        try {
            logger_1.default.info(`📤 Uploading video to YouTube for project: "${title}"`);
            const result = await uploadToYouTube(videoFile.path, // multer diskStorage sets file.path to the full local path
            {
                title: title,
                description: description || "",
                tags: ["MiniGuru", "STEM", "Education", "India"],
            });
            videoUrl = result.url; // e.g. https://www.youtube.com/watch?v=ABC123
            logger_1.default.info(`✅ YouTube upload successful. Video ID: ${result.videoId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ YouTube upload failed: ${error.message}`);
            return res.status(500).json({
                error: "Failed to upload video to YouTube. Please try again.",
            });
        }
    }
    else {
        logger_1.default.warn('YouTube service not available, skipping video upload');
        // For now, we'll store an empty videoUrl - this might need to be handled differently
        // depending on how the frontend expects to handle videos without YouTube
        videoUrl = ""; // Or you could return an error here
    }
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
                await (0, videoApprovalController_1.publishAndAwardProject)(project.id);
                logger_1.default.info(`🤖 AI auto-approved + published project ${project.id}`);
            }
            catch (publishError) {
                // Never fail the upload response over this — the project already
                // exists and sits in the normal admin queue as a safe fallback.
                logger_1.default.error(`AI auto-approve failed for project ${project.id}, left pending for manual review: ` +
                    `${publishError.message}`);
            }
        }
        else if (aiReview.verdict === "UNSURE") {
            try {
                // In-app notification, not email — admin already sees this project
                // with its AI badge on admin.miniguru.in/videos; this just makes
                // sure it doesn't sit unnoticed without adding to email quota.
                await (0, notificationService_1.notifyAllAdmins)({
                    type: "ai_review_unsure",
                    emoji: "🤔",
                    message: `AI review UNSURE on "${title}" — ${aiReview.reason}`,
                    link: "/videos",
                });
            }
            catch (notifyError) {
                // Non-fatal — the project still sits correctly in the pending
                // queue with its AI badge even if this in-app notification fails.
                logger_1.default.warn(`Failed to create AI-UNSURE admin notification (non-fatal): ${notifyError.message}`);
            }
        }
        res.status(201).json(project);
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        logger_1.default.error(error);
        res.status(500).json({ error: error.message });
    }
};
exports.createProject = createProject;
const updateProject = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { title, description, startDate, endDate, materials, categoryName, } = req.body;
    const thumbnailPath = req.file ? await (0, upload_1.uploadThumbnail)(req.file) : "";
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
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        logger_1.default.error(`Error ${error}`);
        res.status(500).json({ error: error.message });
    }
};
exports.updateProject = updateProject;
const getProjectById = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    try {
        const project = await projectService.getById(userId, id);
        res.json(project);
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};
exports.getProjectById = getProjectById;
const getAllProjectsForUser = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    // Same reasoning as createProject: during a child PIN session, "my
    // projects" must mean the CHILD's projects (their linked User.id), not
    // the mentor's own. Falls back to the mentor/normal user otherwise.
    const effectiveUserId = req.subject?.isChild && req.subject.linkedUserId ? req.subject.linkedUserId : userId;
    try {
        const projects = await projectService.getAllForUser(effectiveUserId);
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllProjectsForUser = getAllProjectsForUser;
const getAllProjects = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllProjects = getAllProjects;
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
const getPublishedVideoFeed = async (req, res) => {
    try {
        const limit = Math.min(50, parseInt(req.query.limit) || 50);
        const projects = await prismaClient_1.default.project.findMany({
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
            const videoId = (0, videoApprovalController_1.extractYouTubeId)(p.video.url);
            return {
                id: p.id,
                projectId: p.id,
                videoId,
                title: p.title,
                description: p.description,
                channelTitle: p.user?.name || "MiniGuru Maker",
                viewCount: 0, // view tracking lives in /api/videos/:id/views — not duplicated here
                // Prefer our own stored thumbnail (set at upload time); fall back
                // to YouTube's own free, no-API-call thumbnail CDN URL — never
                // an empty/broken image.
                thumbnail: p.thumbnail || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            };
        });
        return res.status(200).json({ videos });
    }
    catch (error) {
        logger_1.default.error(`getPublishedVideoFeed error: ${error.message}`);
        return res.status(500).json({ error: "Failed to load video feed." });
    }
};
exports.getPublishedVideoFeed = getPublishedVideoFeed;
const deleteProjectByID = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId && req.user?.role !== "ADMIN")
        return res.status(401).json({ error: "Unauthorized" });
    const { projectId } = req.params;
    try {
        await projectService.deleteById(projectId);
        res.status(204).end();
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};
exports.deleteProjectByID = deleteProjectByID;
// GET /project/find-collaborator/:miniguruId
// Looks up another user by their MiniGuru ID (login email) so a child can
// add them as a project collaborator while planning. Returns only id+name —
// never anything sensitive. Excludes the requester themselves.
const findCollaborator = async (req, res) => {
    const requesterId = req.user?.userId;
    if (!requesterId)
        return res.status(401).json({ error: "Unauthorized" });
    const { miniguruId } = req.params;
    if (!miniguruId)
        return res.status(400).json({ error: "MiniGuru ID is required" });
    try {
        const user = await prismaClient_1.default.user.findUnique({
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
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.findCollaborator = findCollaborator;
