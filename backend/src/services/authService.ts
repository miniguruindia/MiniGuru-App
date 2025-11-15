import jwt from 'jsonwebtoken';
import prisma from '../utils/prismaClient';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

import JwtPayload from '../types/jwt';

dotenv.config();


const generateAccessToken = (userId: string, role: string) => {
    return jwt.sign({ userId, role }, process.env.JWT_SECRET as string, { expiresIn: process.env.JWT_EXPIRES_IN });
};

const generateRefreshToken = (userId: string) => {
    return jwt.sign({ userId }, process.env.REFRESH_TOKEN_SECRET as string, { expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN });
};

const verifyToken = (token: string, secret: string): Promise<JwtPayload> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded as JwtPayload);
        });
    });
};

const authenticateUser = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
        throw new Error('Invalid credentials');
    }
    return user;
};

export { generateAccessToken, generateRefreshToken, verifyToken, authenticateUser };
