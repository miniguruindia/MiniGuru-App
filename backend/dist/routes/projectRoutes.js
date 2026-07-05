"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const projectController_1 = require("../controllers/project/projectController");
const upload_1 = require("../middleware/upload");
const categoryController_1 = require("../controllers/project/categoryController");
const authMiddleware_1 = require("../middleware/authMiddleware");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const likeController_1 = require("../controllers/project/likeController");
const commentController_1 = require("../controllers/project/commentController");
const validationMiddleware_2 = require("../middleware/validationMiddleware");
const validateRequest_1 = require("../middleware/validateRequest");
const projectRouter = express_1.default.Router();
// Create a project
projectRouter.post('/', authMiddleware_1.authenticateToken, validationMiddleware_1.validateProject, upload_1.uploadThumbnailAndVideoMiddleware, projectController_1.createProject);
projectRouter.get('/categories', categoryController_1.getAllProjectCategories);
projectRouter.post('/categories', authMiddleware_1.authenticateToken, categoryController_1.createProjectCategory);
projectRouter.put('/categories/:id', authMiddleware_1.authenticateToken, categoryController_1.updateProjectCategory);
projectRouter.delete('/categories/:id', authMiddleware_1.authenticateToken, categoryController_1.deleteProjectCategory);
// List projects by category
projectRouter.get('/categories/:categoryName/', categoryController_1.getProjectsByCategory);
// Shared/group projects — look up a friend by MiniGuru ID to add as collaborator.
// MUST be registered before get('/:id') below (Rule 28) or Express will
// match 'find-collaborator' as the :id param instead.
projectRouter.get('/find-collaborator/:miniguruId', authMiddleware_1.authenticateToken, projectController_1.findCollaborator);
// Update a project
projectRouter.put('/:id', authMiddleware_1.authenticateToken, validationMiddleware_1.validateProject, upload_1.uploadThumbnailAndVideoMiddleware, projectController_1.updateProject);
projectRouter.get('/all', authMiddleware_1.authenticateToken, projectController_1.getAllProjects);
// Get project details
projectRouter.get('/:id', authMiddleware_1.authenticateToken, projectController_1.getProjectById);
// Get all projects for a user
projectRouter.get('/', authMiddleware_1.authenticateToken, projectController_1.getAllProjectsForUser);
projectRouter.post('/:id/comment', authMiddleware_1.authenticateToken, (0, validationMiddleware_2.idValidationRules)(), validateRequest_1.validateRequest, commentController_1.addProjectComment);
projectRouter.post('/:id/like', authMiddleware_1.authenticateToken, (0, validationMiddleware_2.idValidationRules)(), validateRequest_1.validateRequest, likeController_1.likeProject);
exports.default = projectRouter;
