import { Product, ProductCategory } from "@prisma/client";
import prisma from "../../utils/prismaClient";
import BaseService from "../baseCategory";
import logger from "../../logger";
import { NotFoundError, ServiceError } from "../../utils/error";

export default class ProductCategoryService extends BaseService<ProductCategory> {
  constructor() {
    super(prisma.productCategory);
  }

  async getProductsByCategory(categoryName: string): Promise<Product[]> {
    try {
      logger.info(`Fetching products for category Name: ${categoryName}`);
      const category = await prisma.projectCategory.findUnique({
        where: { name: categoryName },
      });

      const products = await prisma.product.findMany({
        where: { categoryId: category?.id },
      });

      if (products.length === 0) {
        throw new NotFoundError("No products found for the given category");
      }

      logger.info(
        `Fetched ${products.length} products for category ID: ${categoryName}`
      );
      return products;
    } catch (error) {
      logger.error(
        `Error fetching products for category ID: ${categoryName}: ${(error as Error).message}`
      );
      throw new ServiceError("Unable to fetch products for category");
    }
  }
}
