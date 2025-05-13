import { OAuth2Client } from 'google-auth-library';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

const clientId = process.env.GOOGLE_CLIENT_ID;
if (!clientId) {
    logger.error('GOOGLE_CLIENT_ID is not set in environment variables');
}

// Create a Google OAuth client
const client = new OAuth2Client(clientId);

export interface GoogleUserInfo {
    email: string;
    name: string;
    picture?: string;
    googleId: string;
}

/**
 * Verify Google ID token and extract user information
 * @param token Google ID token from client
 * @returns User information or null if invalid
 */
export const verifyGoogleToken = async (token: string): Promise<GoogleUserInfo | null> => {
    try {
        logger.info('Verifying Google ID token');

        // Verify the token against Google's API
        const ticket = await client.verifyIdToken({
            idToken: token,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        // Get the payload from the ticket
        const payload = ticket.getPayload();

        if (!payload || !payload.email) {
            logger.warn('Invalid Google token payload or missing email');
            return null;
        }

        logger.info(`Google authentication successful for user: ${payload.email}`);

        // Return user information
        return {
            email: payload.email,
            name: payload.name || '',
            picture: payload.picture,
            googleId: payload.sub // Google's user ID
        };
    } catch (error) {
        logger.error('Error verifying Google token:', error);
        return null;
    }
};
