import { Request, Response } from "express";
import ProjectService from "../../services/project/project";
import { NotFoundError } from "../../utils/error";
import { uploadVideo, uploadThumbnail } from "../../middleware/upload";
import { increaseScoreByProjectId } from "../../services/project/score";
import logger from "../../logger";

const projectService = new ProjectService();

export const createProject = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) return res.status(401).json({ error: "Unauthorized" });

  const {
    title, description, startDate, endDate, materials, categoryName
  } = req.body;

  if (!title || !description || !startDate || !endDate || !materials || !categoryName) {
    return res.status(400).json({ error: "All fields are required" });
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
    return res.status(400).json({ error: "Invalid materials format" });
    console.log(error as Error)
  }
  interface MulterFileMap {
    thumbnail?: Express.Multer.File[];
    video?: Express.Multer.File[];
  }
  const files = req.files as MulterFileMap;

  const thumbnailFile = files?.thumbnail?.[0]; // Access the uploaded thumbnail
  const videoFile = files?.video?.[0]; // Access the uploaded video
  
  const thumbnailPath = thumbnailFile ? await uploadThumbnail(thumbnailFile) : "";
  const videoUrl = videoFile ? await uploadVideo(videoFile) : "";

  try {
    const project = await projectService.create(userId, {
      title, description, startDate, endDate, materials: parsedMaterials, categoryName, thumbnailPath ,videoUrl
    });
    await increaseScoreByProjectId(project.id,100)
    res.status(201).json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    logger.error(error);
    res.status(500).json({ error: (error as Error).message });
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
  const videoUrl = req.file ? await uploadVideo(req.file) : "";

  try {
    const project = await projectService.update(userId, id, {
      title,
      description,
      startDate,
      endDate,
      materials,
      categoryName,
      thumbnailPath,
      videoUrl
    });

    res.json(project);
  } catch (error) {
    if (error instanceof NotFoundError) {
      return res.status(404).json({ error: error.message });
    }
    logger.error(`Error ${error}`)
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

  try {
    const projects = await projectService.getAllForUser(userId);
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

export const deleteProjectByID = async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId && req.user?.role!=="ADMIN") return res.status(401).json({ error: "Unauthorized" });

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
