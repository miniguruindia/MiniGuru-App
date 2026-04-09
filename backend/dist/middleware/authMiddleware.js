"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = exports.authorizeAdmin = exports.authenticateAdmin = exports.authenticateUser = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
// Authenticate any logged-in user
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized - No token provided' });
        }
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        // Fetch user from database
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            }
        });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized - User not found' });
        }
        req.user = { ...user, userId: user.id };
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
};
exports.authenticateUser = authenticateUser;
// Authenticate admin users only
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized - No token provided' });
        }
        const token = authHeader.substring(7);
        if (!process.env.JWT_SECRET) {
            throw new Error('JWT_SECRET not configured');
        }
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const user = await prismaClient_1.default.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
            }
        });
        if (!user) {
            return res.status(401).json({ error: 'Unauthorized - User not found' });
        }
        // Check if user is admin
        if (user.role !== 'ADMIN') {
            return res.status(403).json({ error: 'Forbidden - Admin access required' });
        }
        req.user = { ...user, userId: user.id };
        next();
    }
    catch (error) {
        console.error('Auth error:', error);
        return res.status(401).json({ error: 'Unauthorized - Invalid token' });
    }
};
exports.authenticateAdmin = authenticateAdmin;
// Middleware to check if authenticated user is admin (use after authenticateToken)
const authorizeAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ error: 'Unauthorized - No user found' });
    }
    if (req.user.role !== 'ADMIN') {
        return res.status(403).json({ error: 'Forbidden - Admin access required' });
    }
    next();
};
exports.authorizeAdmin = authorizeAdmin;
// Alias for existing routes that use authenticateToken
exports.authenticateToken = authenticateUser;
