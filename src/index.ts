import express from 'express';
import dotenv from 'dotenv';
import routes from './routes';
import pool from './config/db';
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

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Load Swagger document
let swaggerPath;
try {
    // Try to load from the current directory (for development)
    swaggerPath = path.join(__dirname, './swagger/swagger.yaml');
    if (!require('fs').existsSync(swaggerPath)) {
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
app.use(responseHandler); // Add response handler middleware

// Request logging middleware
app.use((req, res, next) => {
    logger.info(`${req.method} ${req.url}`);
    next();
});

// Initialize database tables
const initializeDatabase = async () => {
    try {
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
        process.exit(1);
    }
};

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
    await initializeDatabase();

    app.listen(PORT, () => {
        logger.info(`Server running on port: http://localhost:${PORT}`);
        logger.info(`API Documentation: http://localhost:${PORT}/api-docs`);
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
