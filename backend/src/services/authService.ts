import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import prisma from '../utils/prismaClient';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

// Custom JWT Payload type
interface CustomJwtPayload {
  userId: string;
  role?: string;
  iat?: number;
  exp?: number;
}

// -------------------------------
// Generate Access Token
// -------------------------------
const generateAccessToken = (userId: string, role: string): string => {
    const secret = process.env.JWT_SECRET as Secret;
    const options: SignOptions = {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    };
    
    return jwt.sign({ userId, role }, secret, options);
};

// -------------------------------
// Generate Refresh Token
// -------------------------------
const generateRefreshToken = (userId: string): string => {
    const secret = process.env.REFRESH_TOKEN_SECRET as Secret;
    const options: SignOptions = {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
    };
    
    return jwt.sign({ userId }, secret, options);
};

// -------------------------------
// Verify Token
// -------------------------------
const verifyToken = (token: string, secret: string): Promise<CustomJwtPayload> => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, secret, (err, decoded) => {
            if (err) return reject(err);
            resolve(decoded as CustomJwtPayload);
        });
    });
};

// -------------------------------
// Authenticate user
// -------------------------------
const authenticateUser = async (email: string, password: string) => {
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
        throw new Error("Invalid credentials");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }

    return user;
};

export {
    generateAccessToken,
    generateRefreshToken,
    verifyToken,
    authenticateUser
};
