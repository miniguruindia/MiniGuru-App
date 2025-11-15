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
        thumbnail: thumbnailPath,
        video: videoUrl ? { url: videoUrl } : undefined,
        materials: enrichedMaterials,
        categoryId: category?.id,
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
      include: this.includeConditions,
    });
    const totalProjects = await prisma.project.count();
    return { projects, totalProjects };
  }

  private async addNameToMaterials(materials: ProjectMaterial[]) {
    const productIds = materials.map((material) => material.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true },
    });

    const productMap = new Map(products.map((product) => [product.id, product.name]));
    return materials.map((material) => ({
      productId: material.productId, // Use `productId` instead of `id`
      quantity: material.quantity,
      name: productMap.get(material.productId),
    }));
  }


  async deleteById(projectId: string){
    await prisma.project.delete({
      where: { id: projectId },
    });
  }

}

export default ProjectService;
