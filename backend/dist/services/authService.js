"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateUser = exports.verifyToken = exports.generateRefreshToken = exports.generateAccessToken = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prismaClient_1 = __importDefault(require("../utils/prismaClient"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// -------------------------------
// Generate Access Token
// -------------------------------
const generateAccessToken = (userId, role) => {
    const secret = process.env.JWT_SECRET;
    const options = {
        expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    };
    return jsonwebtoken_1.default.sign({ userId, role }, secret, options);
};
exports.generateAccessToken = generateAccessToken;
// -------------------------------
// Generate Refresh Token
// -------------------------------
const generateRefreshToken = (userId) => {
    const secret = process.env.REFRESH_TOKEN_SECRET;
    const options = {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRES_IN || '7d'
    };
    return jsonwebtoken_1.default.sign({ userId }, secret, options);
};
exports.generateRefreshToken = generateRefreshToken;
// -------------------------------
// Verify Token
// -------------------------------
const verifyToken = (token, secret) => {
    return new Promise((resolve, reject) => {
        jsonwebtoken_1.default.verify(token, secret, (err, decoded) => {
            if (err)
                return reject(err);
            resolve(decoded);
        });
    });
};
exports.verifyToken = verifyToken;
// -------------------------------
// Authenticate user
// -------------------------------
const authenticateUser = async (email, password) => {
    const user = await prismaClient_1.default.user.findUnique({ where: { email } });
    if (!user) {
        throw new Error("Invalid credentials");
    }
    const isMatch = await bcryptjs_1.default.compare(password, user.passwordHash);
    if (!isMatch) {
        throw new Error("Invalid credentials");
    }
    return user;
};
exports.authenticateUser = authenticateUser;
