import logger from './logger';

/**
 * Validates required environment variables and logs warnings
 * @param requiredVars Array of environment variable names that must be present
 * @returns Boolean indicating if all required variables are set
 */
export const validateEnv = (requiredVars: string[]): boolean => {
    const missing: string[] = [];

    requiredVars.forEach(varName => {
        if (!process.env[varName]) {
            missing.push(varName);
        }
    });

    if (missing.length) {
        logger.warn(`Missing required environment variables: ${missing.join(', ')}`);
        logger.warn('Please check your .env file or set these environment variables.');
        return false;
    }

    return true;
};

/**
 * Gets an environment variable with a fallback value
 * @param name Environment variable name
 * @param fallback Default value if the environment variable is not set
 * @param required Whether to log a warning if the variable is not set
 * @returns The environment variable value or fallback
 */
export const getEnv = (name: string, fallback: string = '', required: boolean = false): string => {
    const value = process.env[name] || fallback;

    if (required && !process.env[name]) {
        logger.warn(`Required environment variable ${name} is not set, using fallback value`);
    }

    return value;
};
