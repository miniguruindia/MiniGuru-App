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
        desiredPrivacyStatus: desiredPrivacyStatus === "PRIVATE" ? "PRIVATE" : "PUBLIC",
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

    return await prisma.project.update({
      where: { id },
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
      },
    });
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