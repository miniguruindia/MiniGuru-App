"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.likeProject = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const dotenv_1 = __importDefault(require("dotenv"));
const score_1 = require("../../services/project/score");
dotenv_1.default.config();
const likeProject = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const projectId = req.params.id;
    try {
        // Check if the user has already liked the project
        const existingLike = await prismaClient_1.default.like.findUnique({
            where: {
                projectId_likedById: {
                    projectId,
                    likedById: userId,
                },
            },
        });
        if (existingLike) {
            await prismaClient_1.default.like.delete({
                where: {
                    id: existingLike.id,
                },
            });
            await (0, score_1.decreaseScoreByProjectId)(projectId, 5);
            return res.status(200).json({ message: 'Like removed' });
        }
        // Add a new like
        await prismaClient_1.default.like.create({
            data: {
                projectId,
                likedById: userId,
            },
        });
        await (0, score_1.increaseScoreByProjectId)(projectId, 5);
        res.status(201).json({ message: 'Project liked' });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.likeProject = likeProject;
