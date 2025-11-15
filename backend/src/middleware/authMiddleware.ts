import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import JwtPayload from '../types/jwt';

const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401);

    jwt.verify(token, process.env.JWT_SECRET as string, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user as JwtPayload;
        next();
    });
};

const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role;

    if (userRole !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden' });
    }

    next();
};


export {authenticateToken, authorizeAdmin};
