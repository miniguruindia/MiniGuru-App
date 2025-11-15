import { Request, Response } from 'express';
import { getStats } from '../../services/admin/stats';
import logger from '../../logger';

export const fetchStats = async (req: Request, res: Response) => {
    try {
        const stats = await getStats();
        logger.info('Stats fetched successfully');
        res.status(200).json(stats);
    } catch (error) {
        logger.error(`Error in stats endpoint: ${(error as Error).message}`);
        res.status(500).json({ message: 'An error occurred while fetching stats.' });
    }
};
