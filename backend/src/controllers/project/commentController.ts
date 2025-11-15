import { Request, Response } from 'express';
import prisma from '../../utils/prismaClient';
import { increaseScoreByProjectId } from '../../services/project/score';

const addProjectComment = async (req: Request, res: Response) => {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const projectId = req.params.id; 
    const { content } = req.body;

    try {
        const comment = await prisma.comment.create({
            data: {
                content,
                projectId,
                commentedById: userId, 
            },
        });
        await increaseScoreByProjectId(projectId,5)
        res.status(201).json(comment);
    } catch (error) {
        res.status(500).json({ error: (error as Error).message });
    }
};

export { addProjectComment };
