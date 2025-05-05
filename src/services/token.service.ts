import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

// Get secret key from environment variables or use default (only for development)
const JWT_SECRET = process.env.JWT_SECRET || 'your_default_secret_key_for_development';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

export interface TokenPayload {
    userId: number;
    email: string;
    roleId: number;
}

/**
 * Generate a JWT token
 * @param payload User data to include in the token
 * @returns JWT token string
 */
export const generateToken = (payload: TokenPayload): string => {
    // Cast the secret key to the appropriate type
    const secretKey: Secret = JWT_SECRET;

    // Create options with proper type for expiresIn
    const options: SignOptions = {
        expiresIn: JWT_EXPIRES_IN as unknown as number
    };

    return jwt.sign(payload, secretKey, options);
};

/**
 * Verify and decode a JWT token
 * @param token JWT token to verify
 * @returns Decoded token payload or null if invalid
 */
export const verifyToken = (token: string): TokenPayload | null => {
    try {
        const secretKey: Secret = JWT_SECRET;
        const decoded = jwt.verify(token, secretKey) as TokenPayload;
        return decoded;
    } catch (error) {
        return null;
    }
};
