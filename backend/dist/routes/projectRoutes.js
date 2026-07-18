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
const resolveSubject_1 = require("../middleware/resolveSubject");
const validationMiddleware_1 = require("../middleware/validationMiddleware");
const likeController_1 = require("../controllers/project/likeController");
const commentController_1 = require("../controllers/project/commentController");
const validationMiddleware_2 = require("../middleware/validationMiddleware");
const validateRequest_1 = require("../middleware/validateRequest");
const projectRouter = express_1.default.Router();
// Create a project
// resolveSubject: when a mentor is inside a child's PIN session
// (X-Child-Profile-Id header set), attributes the project — and eventually
// its Goins on approval — to the CHILD's own account, not the mentor's.
// Previously missing here (only wired into goinsRoutes/userAnalyticsRoutes),
// which silently misattributed every upload made during a PIN session.
projectRouter.post('/', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, validationMiddleware_1.validateProject, projectController_1.createProject);
// Signed direct-to-Firebase-Storage upload URL — bypasses Cloud Run's
// hard 32MB request body limit for the actual video/thumbnail bytes.
// MUST be registered before get('/:id') below (Rule 28).
projectRouter.post('/request-upload-url', authMiddleware_1.authenticateToken, projectController_1.requestUploadUrl);
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
// Public video feed for the home screen — reads from MiniGuru's own DB,
// zero YouTube API calls (see getPublishedVideoFeed for why this replaced
// the old direct-YouTube-API approach). No auth required — same content a
// logged-out visitor could already see embedded from YouTube anyway.
// MUST be registered before get('/:id') below (Rule 28).
projectRouter.get('/feed', projectController_1.getPublishedVideoFeed);
// Update a project
projectRouter.put('/:id', authMiddleware_1.authenticateToken, validationMiddleware_1.validateProject, upload_1.uploadThumbnailAndVideoMiddleware, projectController_1.updateProject);
projectRouter.get('/all', authMiddleware_1.authenticateToken, projectController_1.getAllProjects);
// Get project details
projectRouter.get('/:id', authMiddleware_1.authenticateToken, projectController_1.getProjectById);
// Get all projects for a user — same reasoning as POST '/' above: during a
// child PIN session this must list the CHILD's projects, not the mentor's.
projectRouter.get('/', authMiddleware_1.authenticateToken, resolveSubject_1.resolveSubject, projectController_1.getAllProjectsForUser);
projectRouter.post('/:id/comment', authMiddleware_1.authenticateToken, (0, validationMiddleware_2.idValidationRules)(), validateRequest_1.validateRequest, commentController_1.addProjectComment);
projectRouter.post('/:id/like', authMiddleware_1.authenticateToken, (0, validationMiddleware_2.idValidationRules)(), validateRequest_1.validateRequest, likeController_1.likeProject);
exports.default = projectRouter;
