import { Request, Response } from 'express';
import pool from '../config/db';
import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { createUserSchema, updateUserSchema, loginSchema } from '../validations';
import { generateToken } from '../services/token.service';
import { sendLoginToken } from '../services/email.service';
import logger from '../utils/logger';
import {
    asyncHandler,
    NotFoundError,
    ValidationError,
    ConflictError,
    AuthenticationError,
    DatabaseError
} from '../utils/errors';

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

// New combined registration function
export const registerUser: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, phone, role } = req.body;
    logger.info(`Registering new user: ${email} with role: ${role || 'guest'}`);

    // Default role to 'guest' (role_id: 3) if not specified
    const roleId = role === 'owner' ? 2 : 3;

    // Validate request data using the imported schema
    const { error } = createUserSchema.validate({ name, email, password, phone });
    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    // Check if email already exists
    const [existingUser]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser && existingUser.length > 0) {
        throw new ConflictError('Email already exists');
    }

    // Hash the password before storing it
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        const [result]: any = await pool.query(
            'INSERT INTO users (name, email, password, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, roleId]
        );

        // Generate JWT token for the new user
        const token = generateToken({
            userId: result.insertId,
            email: email,
            roleId: roleId
        });

        // Store the token in the database
        await pool.query('UPDATE users SET token = ? WHERE id = ?', [token, result.insertId]);

        // Send token to user's email
        const emailSent = await sendLoginToken(email, name, token);
        const roleText = roleId === 2 ? 'owner' : 'guest';

        logger.info(`${roleText} registration successful, userId: ${result.insertId}, email sent: ${emailSent}`);

        res.status(201).json({
            status: true,
            data: {
                message: `${roleText} registered successfully` + (emailSent ? ', token sent to your email' : ''),
                userId: result.insertId,
                token,
                emailSent
            }
        });
    } catch (error: any) {
        logger.error('Database error during user registration', { error });
        throw new DatabaseError('Failed to create user account');
    }
});

export const getAllUsers: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const roleFilter = req.query.role ? parseInt(req.query.role as string) : null;

    logger.info('Fetching all users' + (roleFilter ? ` with role_id: ${roleFilter}` : ''));

    let query = 'SELECT id, name, email, phone, role_id, created_at, updated_at FROM users';
    const params = [];

    if (roleFilter) {
        query += ' WHERE role_id = ?';
        params.push(roleFilter);
    }

    const [rows] = await pool.query(query, params);
    res.sendSuccess(rows);
});

export const createUser: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { name, email, password, phone, role } = req.body;
    logger.info(`Creating new user: ${email} with role: ${role || 'guest'}`);

    // Default role to 'guest' (role_id: 3) if not specified
    const roleId = role === 'owner' ? 2 : 3;

    // Validate request data
    const { error } = createUserSchema.validate({ name, email, password, phone });
    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    try {
        const [result]: any = await pool.query(
            'INSERT INTO users (name, email, password, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, roleId]
        );

        logger.info(`User created successfully, userId: ${result.insertId}, role: ${roleId}`);
        res.status(201).json({
            status: true,
            data: {
                message: 'User created successfully',
                userId: result.insertId
            }
        });
    } catch (error: any) {
        logger.error('Database error during user creation', { error });

        if (error.code === 'ER_DUP_ENTRY') {
            throw new ConflictError('Email already exists');
        }

        throw new DatabaseError('Failed to create user account');
    }
});

export const updateUser: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, phone, password } = req.body;
    logger.info(`Updating user with ID: ${id}`);

    // Check if user can update (either admin or the user themselves)
    if (req.user?.roleId !== 1 && req.user?.userId !== parseInt(id)) {
        throw new ConflictError('You can only update your own account unless you are an admin');
    }

    // Validate update data
    const { error } = updateUserSchema.validate({ name, email, phone, password });
    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    // Check if the user exists
    const [userCheck]: any = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
    if (!userCheck || userCheck.length === 0) {
        throw new NotFoundError(`User with ID ${id} not found`);
    }

    // Hash password if provided
    let hashedPassword;
    if (password) {
        hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    }

    // Build dynamic update query
    let updateQuery = 'UPDATE users SET ';
    const updateValues = [];

    if (name) {
        updateQuery += 'name = ?, ';
        updateValues.push(name);
    }

    if (email) {
        updateQuery += 'email = ?, ';
        updateValues.push(email);
    }

    if (phone !== undefined) {
        updateQuery += 'phone = ?, ';
        updateValues.push(phone || null);
    }

    if (hashedPassword) {
        updateQuery += 'password = ?, ';
        updateValues.push(hashedPassword);
    }

    // Remove trailing comma and space
    updateQuery = updateQuery.slice(0, -2);

    // Add WHERE clause
    updateQuery += ' WHERE id = ?';
    updateValues.push(id);

    const [result]: any = await pool.query(updateQuery, updateValues);

    if (result.affectedRows > 0) {
        logger.info(`User with ID ${id} updated successfully`);
        res.sendSuccess({ message: 'User updated successfully' });
    } else {
        throw new NotFoundError(`User with ID ${id} not found`);
    }
});

// New function to get current authenticated user
export const getCurrentUser: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    if (!req.user) {
        throw new AuthenticationError('Authentication required');
    }

    const userId = req.user.userId;
    logger.info(`Fetching profile for current user ID: ${userId}`);

    const [rows]: any = await pool.query(
        'SELECT id, name, email, phone, role_id, created_at, updated_at FROM users WHERE id = ?',
        [userId]
    );

    if (!rows || rows.length === 0) {
        throw new NotFoundError(`User with ID ${userId} not found`);
    }

    res.sendSuccess(rows[0]);
});

// Keep these existing functions
export const login: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    logger.info(`Login attempt for: ${email}`);

    // Validate request data
    const { error } = loginSchema.validate({ email, password });
    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    // Find user by email
    const [users]: any = await pool.query(
        'SELECT id, name, email, password, phone, role_id FROM users WHERE email = ?',
        [email]
    );

    // Check if user exists
    if (!users || users.length === 0) {
        logger.warn(`Login failed: no user found with email ${email}`);
        throw new AuthenticationError('Invalid email or password');
    }

    const user = users[0];

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        logger.warn(`Login failed: invalid password for user ${email}`);
        throw new AuthenticationError('Invalid email or password');
    }

    // Generate JWT token
    const token = generateToken({
        userId: user.id,
        email: user.email,
        roleId: user.role_id
    });

    await pool.query('UPDATE users SET token = ? WHERE email = ?', [token, email]);

    // Don't send password back to client
    delete user.password;

    logger.info(`User logged in successfully: ${email}`);
    res.sendSuccess({
        message: 'Login successful',
        token,
        user
    });
});

export const getUserById: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching user with ID: ${id}`);

    const [rows]: any = await pool.query(
        'SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = ?',
        [id]
    );

    if (!rows || rows.length === 0) {
        throw new NotFoundError(`User with ID ${id} not found`);
    }

    res.sendSuccess(rows[0]);
});

export const deleteUser: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info(`Attempting to delete user with ID: ${id}`);

    const [result]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
        throw new NotFoundError(`User with ID ${id} not found`);
    }

    logger.info(`User with ID ${id} deleted successfully`);
    res.sendSuccess({ message: 'User deleted successfully' });
});

// These functions are no longer needed but kept for backward compatibility
export const getAllOwnerUsers = asyncHandler(async (req: Request, res: Response) => {
    req.query.role = '2';
    return getAllUsers(req, res, () => { });
});
export const getAllGuestUsers = asyncHandler(async (req: Request, res: Response) => {
    req.query.role = '3';
    return getAllUsers(req, res, () => { });
});
