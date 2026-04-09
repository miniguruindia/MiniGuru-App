"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.addProjectComment = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const score_1 = require("../../services/project/score");
const addProjectComment = async (req, res) => {
    const userId = req.user?.userId;
    if (!userId)
        return res.status(401).json({ error: 'Unauthorized' });
    const projectId = req.params.id;
    const { content } = req.body;
    try {
        const comment = await prismaClient_1.default.comment.create({
            data: {
                content,
                projectId,
                commentedById: userId,
            },
        });
        await (0, score_1.increaseScoreByProjectId)(projectId, 5);
        res.status(201).json(comment);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.addProjectComment = addProjectComment;
