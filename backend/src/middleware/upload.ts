import multer from "multer";
import path from "path";
import fs from "fs";
import { ServiceError } from "../utils/error";

// Utility to check and create upload directories
const createUploadDirectory = (uploadPath: string) => {
  if (!fs.existsSync(uploadPath)) {
    fs.mkdirSync(uploadPath, { recursive: true });
  }
};

// Function to configure Multer storage
const configureStorage = (folder: string) => multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, `../../uploads/${folder}`);
    createUploadDirectory(uploadPath); // Create folder if not exists
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const fileName = `${Date.now()}-${file.originalname}`;
    cb(null, fileName);
  },
});


// Function to filter valid file types (for images)
const imageFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimeTypes = ["image/jpeg", "image/png", "image/jpg"];
  if (!allowedMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Only JPEG, PNG, and JPG allowed."));
  }
  cb(null, true);
};

// Function to filter valid video types
const videoFileFilter = (req: Express.Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedVideoMimeTypes = ["video/mp4", "video/quicktime", "video/x-msvideo", "video/x-matroska"];
  if (!allowedVideoMimeTypes.includes(file.mimetype)) {
    return cb(new Error("Invalid file type. Only MP4, MOV, AVI, and MKV allowed."));
  }
  cb(null, true);
};

// Middleware to handle multiple images upload for products
export const uploadImagesMiddleware = multer({
  storage: configureStorage("product-images"),
  fileFilter: imageFileFilter,
}).array("images", 10);  // Max limit of 10 files at once

// Middleware to handle single image upload for thumbnail
export const uploadThumbnailMiddleware = multer({
  storage: configureStorage("thumbnails"),
  fileFilter: imageFileFilter,
}).single("thumbnail");

// Middleware to handle single video upload
export const uploadVideoMiddleware = multer({
  storage: configureStorage("videos"),
  fileFilter: videoFileFilter,
  // limits: { fileSize: 100 * 1024 * 1024 }, // Optional: limit file size to 100MB
}).single("video");

// Function to handle image paths after upload
export const uploadImages = async (files: Express.Multer.File[] | undefined) => {
  const imagePaths = files?.map(file => `${process.env.BASE_URL}uploads/product-images/${file.filename}`);
  return imagePaths; // Return image paths for storing in the database
};

// Function to handle thumbnail path after upload
export const uploadThumbnail = async (file: Express.Multer.File | undefined) => {
  if (!file) {
    throw new ServiceError('No thumbnail uploaded.');
  }

  const thumbnailPath = `${process.env.BASE_URL}uploads/thumbnails/${file.filename}`;
  return thumbnailPath; // Return thumbnail path for storing in the database
};


// Function to configure Multer storage for thumbnails and videos
const configureDynamicStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath: string;
    if (file.fieldname === "thumbnail") {
      uploadPath = path.join(__dirname, "../../uploads/thumbnails"); // Directory for thumbnails
    } else if (file.fieldname === "video") {
      uploadPath = path.join(__dirname, "../../uploads/videos"); // Directory for videos
    } else {
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

export const uploadThumbnailAndVideoMiddleware = multer({
  storage: configureDynamicStorage,
  fileFilter: (req, file, cb) => {
    if (file.fieldname === "thumbnail") {
      return imageFileFilter(req, file, cb); // Apply image file filter for thumbnail
    } else if (file.fieldname === "video") {
      return videoFileFilter(req, file, cb); // Apply video file filter for video
    }
    cb(new Error("Unexpected field"));
  },
}).fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'video', maxCount: 1 }
]);

// Function to handle video path after upload
export const uploadVideo = async (file: Express.Multer.File | undefined) => {
  if (!file) {
    throw new ServiceError('No video uploaded.');
  }

  const videoPath = `${process.env.BASE_URL}uploads/videos/${file.filename}`;
  return videoPath; // Return video path for storing in the database
};
