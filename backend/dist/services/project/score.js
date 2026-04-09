"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.decreaseScoreByProjectId = exports.decreaseScoreByUserId = exports.increaseScoreByProjectId = exports.increaseScoreByUserId = exports.getUserIdByProjectId = void 0;
const prismaClient_1 = __importDefault(require("../../utils/prismaClient"));
const logger_1 = __importDefault(require("../../logger"));
// Utility function to log and rethrow errors
const handleError = (error, context) => {
    logger_1.default.error(`${context}: ${error.message}`);
    throw error;
};
// Function to get the userId from projectId
const getUserIdByProjectId = async (projectId) => {
    try {
        const project = await prismaClient_1.default.project.findUnique({
            where: { id: projectId },
            select: { userId: true },
        });
        if (!project) {
            throw new Error('Project not found');
        }
        return project.userId; // Return the userId associated with the project
    }
    catch (error) {
        logger_1.default.error(`Error fetching userId for project ${projectId}: ${error.message}`);
        throw new Error(`Could not fetch user for project ${projectId}`);
    }
};
exports.getUserIdByProjectId = getUserIdByProjectId;
const increaseScoreByUserId = async (userId, incrementValue) => {
    if (incrementValue <= 0) {
        throw new Error('Increment value must be greater than 0');
    }
    try {
        const updatedUser = await prismaClient_1.default.$transaction(async (prisma) => {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { score: true },
            });
            if (!currentUser) {
                throw new Error('User not found');
            }
            const newScore = currentUser.score + incrementValue;
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    score: newScore,
                    scoreHistory: {
                        push: {
                            time: new Date(),
                            updatedScore: newScore,
                        },
                    },
                },
            });
            return user;
        });
        logger_1.default.info(`Successfully increased score for user: ${userId}`);
        return updatedUser;
    }
    catch (error) {
        handleError(error, `Error increasing score for user ${userId}`);
    }
};
exports.increaseScoreByUserId = increaseScoreByUserId;
const increaseScoreByProjectId = async (projectId, incrementValue) => {
    try {
        const userId = await (0, exports.getUserIdByProjectId)(projectId); // Fetch userId from projectId
        return await (0, exports.increaseScoreByUserId)(userId, incrementValue); // Call existing function
    }
    catch (error) {
        handleError(error, `Error increasing score for project ${projectId}`);
    }
};
exports.increaseScoreByProjectId = increaseScoreByProjectId;
const decreaseScoreByUserId = async (userId, decrementValue) => {
    if (decrementValue <= 0) {
        throw new Error('Decrement value must be greater than 0');
    }
    try {
        const updatedUser = await prismaClient_1.default.$transaction(async (prisma) => {
            const currentUser = await prisma.user.findUnique({
                where: { id: userId },
                select: { score: true },
            });
            if (!currentUser) {
                throw new Error('User not found');
            }
            const newScore = Math.max(currentUser.score - decrementValue, 0);
            const user = await prisma.user.update({
                where: { id: userId },
                data: {
                    score: newScore,
                    scoreHistory: {
                        push: {
                            time: new Date(),
                            updatedScore: newScore,
                        },
                    },
                },
            });
            return user;
        });
        logger_1.default.info(`Successfully decreased score for user: ${userId}`);
        return updatedUser;
    }
    catch (error) {
        handleError(error, `Error decreasing score for user ${userId}`);
    }
};
exports.decreaseScoreByUserId = decreaseScoreByUserId;
const decreaseScoreByProjectId = async (projectId, decrementValue) => {
    try {
        const userId = await (0, exports.getUserIdByProjectId)(projectId); // Fetch userId from projectId
        return await (0, exports.decreaseScoreByUserId)(userId, decrementValue); // Call existing function
    }
    catch (error) {
        handleError(error, `Error decreasing score for project ${projectId}`);
    }
};
exports.decreaseScoreByProjectId = decreaseScoreByProjectId;
