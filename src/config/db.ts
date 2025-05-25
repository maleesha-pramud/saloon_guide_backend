import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import logger from '../utils/logger';

dotenv.config();

// Database configuration with defaults
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    database: process.env.DB_NAME || 'saloon_guide',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
};

// Create connection pool
const pool = mysql.createPool(dbConfig);

// Test database connection
export const testConnection = async (retries = 5, delay = 5000): Promise<boolean> => {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.info(`Attempting to connect to database (attempt ${attempt}/${retries})...`);
            const connection = await pool.getConnection();
            connection.release();
            logger.info('Database connection successful');
            return true;
        } catch (error) {
            logger.error(`Database connection failed (attempt ${attempt}/${retries}):`, error);

            if (attempt < retries) {
                logger.info(`Retrying in ${delay / 1000} seconds...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    return false;
};

export default pool;
