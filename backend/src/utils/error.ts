export class NotFoundError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "NotFoundError";
    }
}

export class ServiceError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ServiceError";
    }
}

import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';

type ErrorResponse = {
    code: number;
    message: string;
};

export const handlePrismaKnownError = (error: PrismaClientKnownRequestError) => {
    // Common Prisma error codes
    switch (error.code) {
        case 'P2002':
            throw new ServiceError('Unique constraint failed on the field(s): ' + error.meta?.target);
        case 'P2025':  // Record not found
            throw new NotFoundError('The requested resource could not be found.');
        default:
            throw new ServiceError('An unknown database error occurred.');
    }
};

export const handlePrismaError = (error: unknown): ErrorResponse => {
    if (error instanceof PrismaClientKnownRequestError) {
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
