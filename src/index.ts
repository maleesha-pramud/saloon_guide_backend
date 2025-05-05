import express from 'express';
import dotenv from 'dotenv';
import routes from './routes';
import pool from './config/db';
import { userTableQuery } from './models/user.model';
import { userRoleTableQuery, insertDefaultRolesQuery } from './models/userRole.model';
import { responseHandler } from './utils/responseHandler';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yamljs';
import path from 'path';

// Load environment variables
dotenv.config();

// Initialize Express
const app = express();
const PORT = process.env.PORT || 3000;

// Load Swagger document
const swaggerDocument = YAML.load(path.join(__dirname, './swagger/swagger.yaml'));

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(responseHandler); // Add response handler middleware

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

// Initialize database tables
const initializeDatabase = async () => {
    try {
        // Create user roles table first since users table references it
        await pool.query(userRoleTableQuery);
        // Insert default roles
        await pool.query(insertDefaultRolesQuery);
        // Create users table with foreign key to roles
        await pool.query(userTableQuery);
        console.log('Database tables initialized');
    } catch (error) {
        console.error('Error initializing database tables:', error);
        process.exit(1);
    }
};

// API Routes
app.use('/api/v1', routes);

// Health check route
app.get('/health', (req, res) => {
    res.sendSuccess({ status: 'ok' });
});

// Start server
const startServer = async () => {
    await initializeDatabase();

    app.listen(PORT, () => {
        console.log(`Server running on port: http://localhost:${PORT}`);
        console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
    });
};

startServer().catch(err => {
    console.error('Failed to start server:', err);
    process.exit(1);
});
