"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadVideo = exports.uploadThumbnailAndVideoMiddleware = exports.uploadThumbnail = exports.uploadImages = exports.uploadVideoMiddleware = exports.uploadThumbnailMiddleware = exports.uploadImagesMiddleware = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const error_1 = require("../utils/error");
// Utility to check and create upload directories
const createUploadDirectory = (uploadPath) => {
    if (!fs_1.default.existsSync(uploadPath)) {
        fs_1.default.mkdirSync(uploadPath, { recursive: true });
    }
};
// Function to configure Multer storage
const configureStorage = (folder) => multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path_1.default.join(__dirname, `../../uploads/${folder}`);
        createUploadDirectory(uploadPath); // Create folder if not exists
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, fileName);
    },
});
// Function to filter valid file types (for images)
const imageFileFilter = (req, file, cb) => {
    const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
    if (!allowedMimeTypes.includes(file.mimetype)) {
        return cb(new Error("Invalid file type. Only JPEG, PNG, and JPG allowed."));
    }
    cb(null, true);
};
// Function to filter valid video types
const videoFileFilter = (req, file, cb) => {
    const allowedVideoMimeTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
    if (!allowedVideoMimeTypes.includes(file.mimetype)) {
        return cb(new Error("Invalid file type. Only MP4, MOV, AVI, and MKV allowed."));
    }
    cb(null, true);
};
// Middleware to handle multiple images upload for products
exports.uploadImagesMiddleware = (0, multer_1.default)({
    storage: configureStorage("product-images"),
    fileFilter: imageFileFilter,
}).array("images", 10); // Max limit of 10 files at once
// Middleware to handle single image upload for thumbnail
exports.uploadThumbnailMiddleware = (0, multer_1.default)({
    storage: configureStorage("thumbnails"),
    fileFilter: imageFileFilter,
}).single("thumbnail");
// Middleware to handle single video upload
exports.uploadVideoMiddleware = (0, multer_1.default)({
    storage: configureStorage("videos"),
    fileFilter: videoFileFilter,
    // limits: { fileSize: 100 * 1024 * 1024 }, // Optional: limit file size to 100MB
}).single("video");
// Function to handle image paths after upload
const uploadImages = async (files) => {
    const imagePaths = files?.map(file => `uploads/product-images/${file.filename}`);
    return imagePaths; // Return image paths for storing in the database
};
exports.uploadImages = uploadImages;
// Function to handle thumbnail path after upload
const uploadThumbnail = async (file) => {
    if (!file) {
        throw new error_1.ServiceError('No thumbnail uploaded.');
    }
    const thumbnailPath = `uploads/thumbnails/${file.filename}`;
    return thumbnailPath; // Return thumbnail path for storing in the database
};
exports.uploadThumbnail = uploadThumbnail;
// Function to configure Multer storage for thumbnails and videos
const configureDynamicStorage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        let uploadPath;
        if (file.fieldname === "thumbnail") {
            uploadPath = path_1.default.join(__dirname, "../../uploads/thumbnails"); // Directory for thumbnails
        }
        else if (file.fieldname === "video") {
            uploadPath = path_1.default.join(__dirname, "../../uploads/videos"); // Directory for videos
        }
        else {
            return;
        }
        createUploadDirectory(uploadPath); // Create folder if not exists
        cb(null, uploadPath); // Set the upload path dynamically
    },
    filename: (req, file, cb) => {
        const fileName = `${Date.now()}-${file.originalname}`;
        cb(null, fileName);
    },
});
exports.uploadThumbnailAndVideoMiddleware = (0, multer_1.default)({
    storage: configureDynamicStorage,
    // 300MB matches the AI review service's own safety cap (aiVideoReviewService.ts).
    // Cloud Run's writable filesystem is backed by container RAM, not real disk —
    // an unbounded upload can consume enough memory to get the whole container
    // killed with no response at all (which the browser then misreports as a
    // CORS error). This limit turns that into a fast, clear error instead.
    limits: { fileSize: 300 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === "thumbnail") {
            return imageFileFilter(req, file, cb); // Apply image file filter for thumbnail
        }
        else if (file.fieldname === "video") {
            return videoFileFilter(req, file, cb); // Apply video file filter for video
        }
        cb(new Error("Unexpected field"));
    },
}).fields([
    { name: 'thumbnail', maxCount: 1 },
    { name: 'video', maxCount: 1 }
]);
// Function to handle video path after upload
const uploadVideo = async (file) => {
    if (!file) {
        throw new error_1.ServiceError('No video uploaded.');
    }
    const videoPath = `uploads/videos/${file.filename}`;
    return videoPath; // Return video path for storing in the database
};
exports.uploadVideo = uploadVideo;
