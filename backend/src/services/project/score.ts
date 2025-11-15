import prisma from '../../utils/prismaClient';
import logger from '../../logger';

// Utility function to log and rethrow errors
const handleError = (error: Error, context: string): never => {
    logger.error(`${context}: ${error.message}`);
    throw error;
};

// Function to get the userId from projectId
export const getUserIdByProjectId = async (projectId: string): Promise<string> => {
    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { userId: true },
        });

        if (!project) {
            throw new Error('Project not found');
        }

        return project.userId; // Return the userId associated with the project
    } catch (error) {
        logger.error(`Error fetching userId for project ${projectId}: ${(error as Error).message}`);
        throw new Error(`Could not fetch user for project ${projectId}`);
    }
};
export const increaseScoreByUserId = async (userId: string, incrementValue: number) => {
    if (incrementValue <= 0) {
        throw new Error('Increment value must be greater than 0');
    }

    try {
        const updatedUser = await prisma.$transaction(async (prisma) => {
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

        logger.info(`Successfully increased score for user: ${userId}`);
        return updatedUser;
    } catch (error) {
        handleError(error as Error, `Error increasing score for user ${userId}`);
    }
};

export const increaseScoreByProjectId = async (projectId: string, incrementValue: number) => {
    try {
        const userId = await getUserIdByProjectId(projectId); // Fetch userId from projectId
        return await increaseScoreByUserId(userId, incrementValue); // Call existing function
    } catch (error) {
        handleError(error as Error, `Error increasing score for project ${projectId}`);
    }
};

export const decreaseScoreByUserId = async (userId: string, decrementValue: number) => {
    if (decrementValue <= 0) {
        throw new Error('Decrement value must be greater than 0');
    }

    try {
        const updatedUser = await prisma.$transaction(async (prisma) => {
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

        logger.info(`Successfully decreased score for user: ${userId}`);
        return updatedUser;
    } catch (error) {
        handleError(error as Error, `Error decreasing score for user ${userId}`);
    }
};

export const decreaseScoreByProjectId = async (projectId: string, decrementValue: number) => {
    try {
        const userId = await getUserIdByProjectId(projectId); // Fetch userId from projectId
        return await decreaseScoreByUserId(userId, decrementValue); // Call existing function
    } catch (error) {
        handleError(error as Error, `Error decreasing score for project ${projectId}`);
    }
};

