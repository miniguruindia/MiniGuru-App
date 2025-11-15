import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import dotenv from "dotenv"
import { increaseScoreByProjectId, decreaseScoreByProjectId } from '../../services/project/score';
dotenv.config()


const likeProject = async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const  projectId  = req.params.id;

    try {
        // Check if the user has already liked the project
        const existingLike = await prisma.like.findUnique({
            where: {
                projectId_likedById: {
                    projectId,
                    likedById:userId,
                },
            },
        });

        if (existingLike) {
            await prisma.like.delete({
                where: {
                    id: existingLike.id,
                },
            });
            await decreaseScoreByProjectId(projectId,5)
            return res.status(200).json({ message: 'Like removed' });
        }

        // Add a new like
        await prisma.like.create({
            data: {
                projectId,
                likedById:userId,
            },
        });
        await increaseScoreByProjectId(projectId,5)
        res.status(201).json({ message: 'Project liked' });
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

export { likeProject };
