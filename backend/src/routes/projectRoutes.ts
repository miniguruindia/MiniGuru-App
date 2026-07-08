import express from 'express';
import { createProject, updateProject, getProjectById, getAllProjectsForUser , getAllProjects, findCollaborator} from '../controllers/project/projectController';
import { uploadThumbnailAndVideoMiddleware } from '../middleware/upload';
import { getProjectsByCategory, getAllProjectCategories, createProjectCategory, updateProjectCategory, deleteProjectCategory } from '../controllers/project/categoryController';
import { authenticateToken } from '../middleware/authMiddleware';
import { resolveSubject } from '../middleware/resolveSubject';
import { validateProject } from '../middleware/validationMiddleware';
import { likeProject } from '../controllers/project/likeController';
import { addProjectComment } from '../controllers/project/commentController';
import { idValidationRules } from '../middleware/validationMiddleware';
import { validateRequest } from '../middleware/validateRequest';



const projectRouter = express.Router();

// Create a project
// resolveSubject: when a mentor is inside a child's PIN session
// (X-Child-Profile-Id header set), attributes the project — and eventually
// its Goins on approval — to the CHILD's own account, not the mentor's.
// Previously missing here (only wired into goinsRoutes/userAnalyticsRoutes),
// which silently misattributed every upload made during a PIN session.
projectRouter.post('/', authenticateToken, resolveSubject, validateProject, uploadThumbnailAndVideoMiddleware, createProject);

projectRouter.get('/categories', getAllProjectCategories);
projectRouter.post('/categories', authenticateToken, createProjectCategory);
projectRouter.put('/categories/:id', authenticateToken, updateProjectCategory);
projectRouter.delete('/categories/:id', authenticateToken, deleteProjectCategory);

// List projects by category
projectRouter.get('/categories/:categoryName/', getProjectsByCategory);

// Shared/group projects — look up a friend by MiniGuru ID to add as collaborator.
// MUST be registered before get('/:id') below (Rule 28) or Express will
// match 'find-collaborator' as the :id param instead.
projectRouter.get('/find-collaborator/:miniguruId', authenticateToken, findCollaborator);


// Update a project
projectRouter.put('/:id', authenticateToken, validateProject,uploadThumbnailAndVideoMiddleware, updateProject);

projectRouter.get('/all',authenticateToken,getAllProjects);

// Get project details
projectRouter.get('/:id', authenticateToken, getProjectById);

// Get all projects for a user — same reasoning as POST '/' above: during a
// child PIN session this must list the CHILD's projects, not the mentor's.
projectRouter.get('/', authenticateToken, resolveSubject, getAllProjectsForUser);

projectRouter.post('/:id/comment', authenticateToken, idValidationRules(), validateRequest, addProjectComment);
projectRouter.post('/:id/like', authenticateToken, idValidationRules(), validateRequest, likeProject);



export default projectRouter;