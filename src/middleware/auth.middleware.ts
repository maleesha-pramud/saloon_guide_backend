import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/token.service';

// Extend Express Request interface to include user property
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId: number;
                email: string;
                roleId: number;
            };
        }
    }
}

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
    try {
        // Get the auth header
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.sendError('Unauthorized - No token provided', 401);
        }

        // Extract token from header
        const token = authHeader.split(' ')[1];

        // Verify the token
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.sendError('Unauthorized - Invalid token', 401);
        }

        // Attach user data to request
        req.user = {
            userId: decoded.userId,
            email: decoded.email,
            roleId: decoded.roleId
        };

        next();
    } catch (error) {
        console.error('Authentication error:', error);
        return res.sendError('Unauthorized - Authentication failed', 401);
    }
};

/**
 * Authorization middleware to check if user has admin role
 */
export const authorizeAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.sendError('Unauthorized - Authentication required', 401);
    }

    // Check if user has admin role (role_id = 1)
    if (req.user.roleId !== 1) {
        return res.sendError('Forbidden - Admin access required', 403);
    }

    next();
};

/**
 * Authorization middleware to check if user has owner role
 */
export const authorizeOwner = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
        return res.sendError('Unauthorized - Authentication required', 401);
    }

    // Check if user has owner role (role_id = 1)
    if (req.user.roleId !== 2) {
        return res.sendError('Forbidden - Owner access required', 403);
    }

    next();
};
