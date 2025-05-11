import logger from './logger';

/**
 * Base application error class that extends Error
 */
export class AppError extends Error {
    statusCode: number;
    isOperational: boolean;

    constructor(message: string, statusCode: number) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true; // Mark as operational error for handling

        // Maintains proper stack trace
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error for not found resources (404)
 */
export class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}

/**
 * Error for validation failures (400)
 */
export class ValidationError extends AppError {
    constructor(message = 'Validation failed') {
        super(message, 400);
    }
}

/**
 * Error for authentication failures (401)
 */
export class AuthenticationError extends AppError {
    constructor(message = 'Authentication failed') {
        super(message, 401);
    }
}

/**
 * Error for authorization failures (403)
 */
export class AuthorizationError extends AppError {
    constructor(message = 'Not authorized to perform this action') {
        super(message, 403);
    }
}

/**
 * Error for duplicate/conflict records (409)
 */
export class ConflictError extends AppError {
    constructor(message = 'Resource already exists') {
        super(message, 409);
    }
}

/**
 * Error for database operation failures
 */
export class DatabaseError extends AppError {
    constructor(message = 'Database operation failed', statusCode = 500) {
        super(message, statusCode);
    }
}

/**
 * Function to handle error logging and classification
 */
export const handleError = (error: Error): AppError => {
    // Log the error
    logger.error(error.message, {
        stack: error.stack,
        name: error.name,
        isOperational: error instanceof AppError ? (error as AppError).isOperational : false
    });

    // If it's already an AppError, return it
    if (error instanceof AppError) {
        return error;
    }

    // If it's a MySQL duplicate entry error
    if ((error as any).code === 'ER_DUP_ENTRY') {
        return new ConflictError('Resource already exists');
    }

    // Default to internal server error
    return new AppError('Internal Server Error', 500);
};

/**
 * Async handler to wrap async route handlers and avoid try-catch blocks
 */
export const asyncHandler = (fn: Function) => {
    return (req: any, res: any, next: any) => {
        Promise.resolve(fn(req, res, next)).catch((err) => {
            const appError = handleError(err);
            res.sendError(appError.message, appError.statusCode);
        });
    };
};
