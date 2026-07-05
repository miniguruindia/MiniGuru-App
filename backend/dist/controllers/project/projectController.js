"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.findCollaborator = exports.deleteProjectByID = exports.getAllProjects = exports.getAllProjectsForUser = exports.getProjectById = exports.updateProject = exports.createProject = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const project_1 = __importDefault(require("../../services/project/project"));
const error_1 = require("../../utils/error");
const upload_1 = require("../../middleware/upload");
const logger_1 = __importDefault(require("../../logger"));
// ✅ Import YouTube upload service (optional)
let uploadToYouTube = null;
try {
    const youtubeService = require("../../services/youtubeUploadService");
    uploadToYouTube = youtubeService.uploadToYouTube;
    logger_1.default.info('YouTube service loaded in project controller');
}
catch (error) {
    logger_1.default.warn({ error: error.message }, 'YouTube service not available in project controller - YouTube features will be disabled');
}
const projectService = new project_1.default();
const createProject = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { title, description, startDate, endDate, materials, categoryName, collaboratorIds } = req.body;
    if (!title || !description || !startDate || !endDate || !materials || !categoryName) {
        return res.status(400).json({ error: "All fields are required" });
    }
    // ── Shared/group projects — collaborators (optional) ────────────────
    // Collaborators can ONLY be set here, at upload time. There is no
    // endpoint to add one after the Project exists — this is intentional
    // (confirmed product decision: planning-only, instant-add, equal split).
    let collaborators = [];
    if (collaboratorIds) {
        let parsedIds = [];
        try {
            parsedIds = typeof collaboratorIds === "string"
                ? JSON.parse(collaboratorIds)
                : collaboratorIds;
            if (!Array.isArray(parsedIds))
                parsedIds = [];
        }
        catch {
            parsedIds = [];
        }
        // de-dupe, drop the owner if they somehow added themselves
        parsedIds = [...new Set(parsedIds)].filter((cid) => cid !== userId);
        if (parsedIds.length > 0) {
            const collaboratorUsers = await prismaClient_1.default.user.findMany({
                where: { id: { in: parsedIds } },
                select: { id: true, name: true },
            });
            collaborators = collaboratorUsers.map((u) => ({ userId: u.id, name: u.name }));
        }
    }
    let parsedMaterials = [];
    try {
        if (typeof materials === "string") {
            parsedMaterials = JSON.parse(materials);
            if (!Array.isArray(parsedMaterials)) {
                return res.status(400).json({ error: "Materials must be an array" });
            }
        }
        else if (Array.isArray(materials)) {
            parsedMaterials = materials;
        }
        else {
            return res.status(400).json({ error: "Invalid materials format" });
        }
    }
    catch (error) {
        logger_1.default.error(error);
        return res.status(400).json({ error: "Invalid materials format" });
    }
    const files = req.files;
    const thumbnailFile = files?.thumbnail?.[0];
    const videoFile = files?.video?.[0];
    if (!videoFile) {
        return res.status(400).json({ error: "Video file is required" });
    }
    // ✅ Upload thumbnail as before (local storage)
    const thumbnailPath = thumbnailFile ? await (0, upload_1.uploadThumbnail)(thumbnailFile) : "";
    // ✅ Upload video to YouTube as UNLISTED (optional - falls back to local if unavailable)
    let videoUrl = "";
    if (uploadToYouTube) {
        try {
            logger_1.default.info(`📤 Uploading video to YouTube for project: "${title}"`);
            const result = await uploadToYouTube(videoFile.path, // multer diskStorage sets file.path to the full local path
            {
                title: title,
                description: description || "",
                tags: ["MiniGuru", "STEM", "Education", "India"],
            });
            videoUrl = result.url; // e.g. https://www.youtube.com/watch?v=ABC123
            logger_1.default.info(`✅ YouTube upload successful. Video ID: ${result.videoId}`);
        }
        catch (error) {
            logger_1.default.error(`❌ YouTube upload failed: ${error.message}`);
            return res.status(500).json({
                error: "Failed to upload video to YouTube. Please try again.",
            });
        }
    }
    else {
        logger_1.default.warn('YouTube service not available, skipping video upload');
        // For now, we'll store an empty videoUrl - this might need to be handled differently
        // depending on how the frontend expects to handle videos without YouTube
        videoUrl = ""; // Or you could return an error here
    }
    try {
        const project = await projectService.create(userId, {
            title,
            description,
            startDate,
            endDate,
            materials: parsedMaterials,
            categoryName,
            thumbnailPath,
            videoUrl, // ✅ Now a YouTube URL, stored in project.video.url
            collaborators,
        });
        // NOTE: Goins are awarded ONLY on admin approval (see approveProject in
        // videoApprovalController.ts) — never at upload time. Previously this
        // line awarded +100 Goins immediately on upload, which double-paid
        // every child (once here, again on approval) and paid out even for
        // videos that were later rejected. Removed — do not re-add.
        res.status(201).json(project);
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        logger_1.default.error(error);
        res.status(500).json({ error: error.message });
    }
};
exports.createProject = createProject;
const updateProject = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    const { title, description, startDate, endDate, materials, categoryName, } = req.body;
    const thumbnailPath = req.file ? await (0, upload_1.uploadThumbnail)(req.file) : "";
    // NOTE: updateProject doesn't re-upload to YouTube (keep existing video URL)
    // If you need video replacement, add YouTube upload logic here similarly
    const videoUrl = "";
    try {
        const project = await projectService.update(userId, id, {
            title,
            description,
            startDate,
            endDate,
            materials,
            categoryName,
            thumbnailPath,
            videoUrl,
        });
        res.json(project);
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        logger_1.default.error(`Error ${error}`);
        res.status(500).json({ error: error.message });
    }
};
exports.updateProject = updateProject;
const getProjectById = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    const { id } = req.params;
    try {
        const project = await projectService.getById(userId, id);
        res.json(project);
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};
exports.getProjectById = getProjectById;
const getAllProjectsForUser = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: "Unauthorized" });
    try {
        const projects = await projectService.getAllForUser(userId);
        res.json(projects);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllProjectsForUser = getAllProjectsForUser;
const getAllProjects = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
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
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.getAllProjects = getAllProjects;
const deleteProjectByID = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId && req.user?.role !== "ADMIN")
        return res.status(401).json({ error: "Unauthorized" });
    const { projectId } = req.params;
    try {
        await projectService.deleteById(projectId);
        res.status(204).end();
    }
    catch (error) {
        if (error instanceof error_1.NotFoundError) {
            return res.status(404).json({ error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
};
exports.deleteProjectByID = deleteProjectByID;
// GET /project/find-collaborator/:miniguruId
// Looks up another user by their MiniGuru ID (login email) so a child can
// add them as a project collaborator while planning. Returns only id+name —
// never anything sensitive. Excludes the requester themselves.
const findCollaborator = async (req, res) => {
    const requesterId = req.user?.userId;
    if (!requesterId)
        return res.status(401).json({ error: "Unauthorized" });
    const { miniguruId } = req.params;
    if (!miniguruId)
        return res.status(400).json({ error: "MiniGuru ID is required" });
    try {
        const user = await prismaClient_1.default.user.findUnique({
            where: { email: miniguruId.trim().toLowerCase() },
            select: { id: true, name: true },
        });
        if (!user) {
            return res.status(404).json({ error: "No MiniGuru account found with that ID" });
        }
        if (user.id === requesterId) {
            return res.status(400).json({ error: "You can't add yourself as a collaborator" });
        }
        return res.status(200).json({ id: user.id, name: user.name });
    }
    catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
exports.findCollaborator = findCollaborator;
