import prisma from "../../utils/prismaClient";
import { Project } from "@prisma/client";
import { NotFoundError } from "../../utils/error";

interface ProjectMaterial {
  productId: string;
  quantity: number;
  name?: string;
}

class ProjectService {
  private includeConditions = {
    category: {
      select: { name: true },
    },
    user: {
      select: { name: true },
    },
    comments:{
      select:{
        content :true,
        commentedBy :{
          select :{
            name:true,
            id:true,
                   }
        }

      }
    }
  };

  async create(userId: string, projectData): Promise<Project> {
    const {
      title,
      description,
      startDate,
      endDate,
      materials,
      categoryName,
      thumbnailPath,
      videoUrl,
      collaborators,
      challengeId,
      // AI first-pass video review result (optional — undefined when the
      // review was never run, e.g. GEMINI_API_KEY not configured).
      aiVerdict,
      aiReason,
      aiConfidence,
      aiReviewedAt,
      desiredPrivacyStatus,
      // YouTube's own reported status (Sept 2026) — a best-effort snapshot
      // taken right after upload in createProject. See checkVideoStatus()
      // in youtubeUploadService.js. Undefined when the check itself failed
      // or was skipped (e.g. YouTube service unavailable) — never blocks
      // project creation either way.
      youtubeUploadStatus,
      youtubeStatusReason,
      youtubeRegionsBlocked,
      youtubeStatusCheckedAt,
    } = projectData;

    const category = await prisma.projectCategory.findUnique({
      where: { name: categoryName },
    });
    if (!category) throw new NotFoundError("Category not found");

    const enrichedMaterials = await this.addNameToMaterials(materials);

    return await prisma.project.create({
      data: {
        title,
        description,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        thumbnail: thumbnailPath,
        video: { url: videoUrl },
        materials: enrichedMaterials,
        userId,
        categoryId: category.id,
        collaborators: collaborators && collaborators.length > 0 ? collaborators : undefined,
        challengeId: challengeId ?? undefined,
        aiVerdict: aiVerdict ?? undefined,
        aiReason: aiReason ?? undefined,
        aiConfidence: typeof aiConfidence === "number" ? aiConfidence : undefined,
        aiReviewedAt: aiReviewedAt ?? undefined,
        desiredPrivacyStatus: ["PUBLIC", "UNLISTED", "PRIVATE"].includes(desiredPrivacyStatus) ? desiredPrivacyStatus : "PUBLIC",
        youtubeUploadStatus: youtubeUploadStatus ?? undefined,
        youtubeStatusReason: youtubeStatusReason ?? undefined,
        youtubeRegionsBlocked: typeof youtubeRegionsBlocked === "number" ? youtubeRegionsBlocked : undefined,
        youtubeStatusCheckedAt: youtubeStatusCheckedAt ?? undefined,
      },
    });
  }

  async update(userId: string, id: string, projectData): Promise<Project> {
    const {
      title,
      description,
      startDate,
      endDate,
      materials,
      categoryName,
      thumbnailPath,
      videoUrl,
      collaborators, // admin-only field — see adminUpdateProject in projectController.ts
      // Sept 2026 — video-replacement support. When a video is replaced,
      // the controller passes ALL of these together so the reset happens
      // atomically with the new video, never as a separate follow-up call:
      status,           // 'pending' on any video replacement — see controller
      aiVerdict,
      aiReason,
      aiConfidence,
      aiReviewedAt,
      desiredPrivacyStatus,
      // YouTube's own reported status (Sept 2026) — see create() above and
      // checkVideoStatus() in youtubeUploadService.js. On a video
      // replacement, callers pass explicit nulls here (the old video's
      // status no longer applies to the new file) alongside a fresh
      // post-upload snapshot, same "reset then re-fill" pattern already
      // used for aiVerdict/aiReason/aiConfidence above.
      youtubeUploadStatus,
      youtubeStatusReason,
      youtubeRegionsBlocked,
      youtubeStatusCheckedAt,
    } = projectData;

    let category;
    if (categoryName) {
      category = await prisma.projectCategory.findUnique({
        where: { name: categoryName },
      });
      if (!category) throw new NotFoundError("Category not found");
    }

    const enrichedMaterials = materials
      ? await this.addNameToMaterials(materials)
      : undefined;

    // BUGFIX (Sept 2026): this used to filter only by `id` — ANY
    // authenticated user could edit ANY other user's project by guessing
    // its id. `userId` is now part of the where clause too, so a mismatch
    // fails exactly like a genuinely missing project (never confirms
    // whether the id exists for someone else, which is the right call —
    // no need to leak that). Callers must pass the real owning userId:
    // updateProject resolves it the same way createProject does (child's
    // own id during a mentor's PIN session), adminUpdateProject already
    // fetches and passes the real project.userId, not the admin's own id.
    try {
      return await prisma.project.update({
        where: { id, userId },
        data: {
          title,
          description,
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          // Guard against wiping the existing thumbnail: only ever write a
          // new value when one was genuinely provided. This used to receive
          // "" on every edit that didn't touch the thumbnail, silently
          // deleting it — undefined here means "leave field untouched" to
          // Prisma, "" would have meant "set it to blank".
          thumbnail: thumbnailPath || undefined,
          video: videoUrl ? { url: videoUrl } : undefined,
          materials: enrichedMaterials,
          categoryId: category?.id,
          // undefined = leave untouched; an actual array (even []) replaces
          // it wholesale — matches how title/description already behave.
          collaborators: collaborators !== undefined ? collaborators : undefined,
          status: status || undefined,
          aiVerdict: aiVerdict !== undefined ? aiVerdict : undefined,
          aiReason: aiReason !== undefined ? aiReason : undefined,
          aiConfidence: typeof aiConfidence === "number" ? aiConfidence : undefined,
          aiReviewedAt: aiReviewedAt || undefined,
          desiredPrivacyStatus:
            desiredPrivacyStatus && ["PUBLIC", "UNLISTED", "PRIVATE"].includes(desiredPrivacyStatus)
              ? desiredPrivacyStatus
              : undefined,
          youtubeUploadStatus: youtubeUploadStatus !== undefined ? youtubeUploadStatus : undefined,
          youtubeStatusReason: youtubeStatusReason !== undefined ? youtubeStatusReason : undefined,
          youtubeRegionsBlocked: youtubeRegionsBlocked !== undefined ? youtubeRegionsBlocked : undefined,
          youtubeStatusCheckedAt: youtubeStatusCheckedAt !== undefined ? youtubeStatusCheckedAt : undefined,
        },
      });
    } catch (err: any) {
      // Prisma throws P2025 ("record to update not found") for a
      // where-clause mismatch — exactly what a wrong-owner attempt or a
      // genuinely missing id both look like from here.
      if (err?.code === "P2025") throw new NotFoundError("Project not found");
      throw err;
    }
  }

  async getById(userId: string, id: string) {
    const project = await prisma.project.findUnique({
      where: { id },
      include: this.includeConditions,
    });
    if (!project)
      throw new NotFoundError("Project not found");

    return project;
  }

  async getAllForUser(userId: string) {
    return await prisma.project.findMany({
      where: { userId },
      include: this.includeConditions,
    });
  }

  async getAll(page: number, limit: number) {
    const projects = await prisma.project.findMany({
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: this.includeConditions,
    });
    const totalProjects = await prisma.project.count();
    return { projects, totalProjects };
  }

  private async addNameToMaterials(materials: ProjectMaterial[]) {
    // BUGFIX: same root cause as the material refund bug in
    // videoApprovalController.ts — this used to query prisma.product (the
    // dead own-shop model), so material.name has likely been undefined on
    // every project ever created, even though a real name always existed
    // in the Material catalog under this same id.
    const materialIds = materials.map((material) => material.productId);
    const materialRecords = await prisma.material.findMany({
      where: { id: { in: materialIds } },
      select: { id: true, name: true },
    });

    const nameMap = new Map(materialRecords.map((m) => [m.id, m.name]));
    return materials.map((material) => ({
      productId: material.productId, // field name kept for schema compatibility
      quantity: material.quantity,
      name: nameMap.get(material.productId),
    }));
  }


  async deleteById(projectId: string){
    await prisma.project.delete({
      where: { id: projectId },
    });
  }

}

export default ProjectService;