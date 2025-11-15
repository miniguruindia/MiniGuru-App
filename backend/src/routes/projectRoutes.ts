import express from 'express';
import { createProject, updateProject, getProjectById, getAllProjectsForUser , getAllProjects} from '../controllers/project/projectController';
import { uploadThumbnailAndVideoMiddleware } from '../middleware/upload';
import {  getProjectsByCategory, getAllProjectCategories, } from '../controllers/project/categoryController';
import { authenticateToken } from '../middleware/authMiddleware';
import { validateProject } from '../middleware/validationMiddleware';
import { likeProject } from '../controllers/project/likeController';
import { addProjectComment } from '../controllers/project/commentController';
import { idValidationRules } from '../middleware/validationMiddleware';
import { validateRequest } from '../middleware/validateRequest';



const projectRouter = express.Router();

// Create a project
projectRouter.post('/', authenticateToken, validateProject, uploadThumbnailAndVideoMiddleware, createProject);

// projectRouter.post('/categories', authenticateToken, authorizeAdmin, createProjectCategory);
// projectRouter.delete('/categories/:id',authenticateToken,authorizeAdmin,deleteProjectCategory)
projectRouter.get('/categories', getAllProjectCategories);

// List projects by category
projectRouter.get('/categories/:categoryName/', getProjectsByCategory);


// Update a project
projectRouter.put('/:id', authenticateToken, validateProject,uploadThumbnailAndVideoMiddleware, updateProject);

projectRouter.get('/all',authenticateToken,getAllProjects);

// Get project details
projectRouter.get('/:id', authenticateToken, getProjectById);

// Get all projects for a user
projectRouter.get('/', authenticateToken, getAllProjectsForUser);

projectRouter.post('/:id/comment', authenticateToken, idValidationRules(), validateRequest, addProjectComment);
projectRouter.post('/:id/like', authenticateToken, idValidationRules(), validateRequest, likeProject);



export default projectRouter;
