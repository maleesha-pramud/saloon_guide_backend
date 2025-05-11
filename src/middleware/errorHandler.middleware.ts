import { Request, Response, NextFunction } from 'express';
import { AppError, handleError } from '../utils/errors';

/**
 * Global error handling middleware
 */
export const errorHandler = (
    err: Error,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    // Process the error through our handler
    const appError = handleError(err);

    // Send a standardized error response
    res.status(appError.statusCode || 500).json({
        status: false,
        message: appError.message || 'Internal Server Error',
        ...(process.env.NODE_ENV !== 'production' ? { stack: appError.stack } : {})
    });
};

/**
 * Middleware to handle 404 Not Found for unmatched routes
 */
export const notFoundHandler = (req: Request, res: Response, next: NextFunction) => {
    const error = new AppError(`Not Found - ${req.originalUrl}`, 404);
    next(error);
};
