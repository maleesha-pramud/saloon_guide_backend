import { Request, Response, NextFunction } from 'express';

// Extend Express Response interface to include custom methods
declare global {
    namespace Express {
        interface Response {
            sendSuccess(data: any): void;
            sendError(message: string, statusCode?: number): void;
        }
    }
}

/**
 * Middleware to add custom response methods to Express Response object
 */
export const responseHandler = (req: Request, res: Response, next: NextFunction) => {
    // Method for successful responses
    res.sendSuccess = function (data: any): void {
        this.status(200).json({
            status: true,
            data
        });
    };

    // Method for error responses
    res.sendError = function (message: string, statusCode: number = 400): void {
        this.status(statusCode).json({
            status: false,
            message
        });
    };

    next();
};
