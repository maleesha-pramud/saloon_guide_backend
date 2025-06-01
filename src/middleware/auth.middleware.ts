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
export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
    // Get the auth header
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            status: false,
            message: 'Unauthorized - No token provided',
            error: 'NO_TOKEN'
        });
        return;
    }

    // Extract token from header
    const token = authHeader.split(' ')[1];

    try {
        // Verify the token
        const decoded = verifyToken(token);

        // Check if token is valid
        if (!decoded) {
            res.status(401).json({
                status: false,
                message: 'Unauthorized - Invalid token',
                error: 'INVALID_TOKEN'
            });
            return;
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
        res.status(401).json({
            status: false,
            message: 'Unauthorized - Invalid or expired token',
            error: 'INVALID_TOKEN'
        });
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
