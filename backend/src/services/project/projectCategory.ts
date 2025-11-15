import { Project, ProjectCategory } from "@prisma/client";
import prisma from "../../utils/prismaClient";
import BaseService from "../baseCategory";
import logger from "../../logger";
import { NotFoundError, ServiceError } from "../../utils/error";

export default class ProjectCategoryService extends BaseService<ProjectCategory> {
  constructor() {
    super(prisma.projectCategory);
  }

  async getProjectsByCategory(categoryName: string): Promise<Project[]> {
    try {
      logger.info(`Fetching projects for category name: ${categoryName}`);
      const category = await prisma.projectCategory.findUnique({
        where: { name: categoryName },
      });

      if (!category) {
        throw new NotFoundError("Category not found");
      }

      const projects = await prisma.project.findMany({
        where: { categoryId: category.id },
        include: {
          category: true,
        },
      });
      if (projects.length === 0) {
        throw new NotFoundError("No projects found for the given category");
      }

      logger.info(
        `Fetched ${projects.length} projects for category Name: ${categoryName}`
      );
      return projects;
    } catch (error) {
      logger.error(
        `Error fetching projects for category ID: ${categoryName}: ${(error as Error).message}`
      );
      throw new ServiceError("Unable to fetch projects for category");
    }
  }
}
