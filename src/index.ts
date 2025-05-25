import express from 'express';
import dotenv from 'dotenv';
import routes from './routes';
import pool, { testConnection } from './config/db';
import { userTableQuery } from './models/user.model';
import { userRoleTableQuery, insertDefaultRolesQuery } from './models/userRole.model';
import { saloonTableQuery, saloonServiceTableQuery } from './models/saloon.model';
import { appointmentTableQuery } from './models/appointment.model';
import { responseHandler } from './utils/responseHandler';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.middleware';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';
import logger from './utils/logger';
import fs from 'fs';

// Load environment variables
dotenv.config();

// Check for required environment variables
const requiredEnvVars = ['PORT', 'DB_HOST', 'DB_USER', 'DB_PASS', 'DB_NAME', 'DB_PORT', 'JWT_EXPIRES_IN', 'JWT_SECRET', 'EMAIL_HOST', 'EMAIL_PORT', 'EMAIL_SECURE', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM', 'EMAIL_FROM_NAME', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'];
const missingEnvVars = requiredEnvVars.filter(envVar => !process.env[envVar]);

if (missingEnvVars.length > 0) {
    logger.warn(`Missing required environment variables: ${missingEnvVars.join(', ')}`);
    logger.warn('Please check your .env file or set these environment variables.');
}

// Initialize Express and CORS
const app = express();
const cors = require('cors');
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'http://localhost';

// Load Swagger document
let swaggerPath;
try {
    // Try to load from the current directory (for development)
    swaggerPath = path.join(__dirname, './swagger/swagger.yaml');
    if (!fs.existsSync(swaggerPath)) {
        // Try to load from parent directory (for production build)
        swaggerPath = path.join(__dirname, '../src/swagger/swagger.yaml');
    }
    logger.info(`Loading Swagger document from ${swaggerPath}`);
    const swaggerDocument = YAML.load(swaggerPath);

    // Swagger UI
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
} catch (error) {
    logger.error(`Failed to load Swagger document: ${error}`);
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseHandler);

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Initialize database tables
const initializeDatabase = async () => {
    try {
        // Test database connection with retries
        const isConnected = await testConnection();
        if (!isConnected) {
            throw new Error('Failed to connect to database after multiple attempts');
        }

        // Create user roles table first since users table references it
        await pool.query(userRoleTableQuery);
        // Insert default roles
        await pool.query(insertDefaultRolesQuery);
        // Create users table with foreign key to roles
        await pool.query(userTableQuery);
        // Create saloon tables
        await pool.query(saloonTableQuery);
        await pool.query(saloonServiceTableQuery);
        // Create appointments table
        await pool.query(appointmentTableQuery);

        logger.info('Database tables initialized successfully');
    } catch (error) {
        logger.error('Error initializing database tables:', error);
        logger.error('Application will start without database initialization. Some features may not work.');
    }
};

// Configure CORS before your routes
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
}));

// API Routes
app.use('/api/v1', routes);

// Health check route
app.get('/health', (req, res) => {
    res.sendSuccess({ status: 'ok' });
});

// 404 handler for unmatched routes
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        await initializeDatabase();
    } catch (error) {
        logger.error('Database initialization failed, but server will continue to start:', error);
    }

    app.listen(PORT, () => {
        const env = process.env.NODE_ENV === 'production' ? 'production' : 'development';
        const baseUrl = env === 'production' ? HOST : `${HOST}:${PORT}`;
        logger.info(`Running in ${env} mode`);
        logger.info(`Server running on: ${baseUrl}`);
        logger.info(`API Documentation: ${baseUrl}/api-docs`);
    });
};

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    process.exit(1);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

startServer().catch(err => {
    logger.error('Failed to start server:', err);
    process.exit(1);
});
