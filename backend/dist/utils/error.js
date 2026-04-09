"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handlePrismaError = exports.handlePrismaKnownError = exports.ServiceError = exports.NotFoundError = void 0;
class NotFoundError extends Error {
    constructor(message) {
        super(message);
        this.name = "NotFoundError";
    }
}
exports.NotFoundError = NotFoundError;
class ServiceError extends Error {
    constructor(message) {
        super(message);
        this.name = "ServiceError";
    }
}
exports.ServiceError = ServiceError;
const library_1 = require("@prisma/client/runtime/library");
const handlePrismaKnownError = (error) => {
    // Common Prisma error codes
    switch (error.code) {
        case 'P2002':
            throw new ServiceError('Unique constraint failed on the field(s): ' + error.meta?.target);
        case 'P2025': // Record not found
            throw new NotFoundError('The requested resource could not be found.');
        default:
            throw new ServiceError('An unknown database error occurred.');
    }
};
exports.handlePrismaKnownError = handlePrismaKnownError;
const handlePrismaError = (error) => {
    if (error instanceof library_1.PrismaClientKnownRequestError) {
        switch (error.code) {
            case 'P2002': // Unique constraint violation
                return { code: 400, message: 'Duplicate field violation' };
            case 'P2025': // Record not found
                return { code: 404, message: 'Resource not found' };
            default:
                return { code: 500, message: 'Database error' };
        }
    }
    return { code: 500, message: 'Internal server error' };
};
exports.handlePrismaError = handlePrismaError;
