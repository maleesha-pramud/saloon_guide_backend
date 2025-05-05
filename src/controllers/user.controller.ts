import { Request, Response } from 'express';
import pool from '../config/db';
import { RequestHandler } from 'express';
import bcrypt from 'bcrypt';
import { createUserSchema, updateUserSchema, loginSchema } from '../validations';
import { generateToken } from '../services/token.service';
import { sendLoginToken } from '../services/email.service';

// Salt rounds for bcrypt
const SALT_ROUNDS = 10;

export const getAllOwnerUsers: RequestHandler = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, email, phone, created_at, updated_at FROM users WHERE role_id = 2');
        res.sendSuccess(rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.sendError('Error fetching users', 500);
    }
};

export const getAllGuestUsers: RequestHandler = async (req, res) => {
    try {
        const [rows] = await pool.query('SELECT id, name, email, phone, created_at, updated_at FROM users WHERE role_id = 3');
        res.sendSuccess(rows);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.sendError('Error fetching users', 500);
    }
};

export const getUserById: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const [rows]: any = await pool.query(
            'SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = ?',
            [id]
        );

        if (!rows || rows.length === 0) {
            res.sendError('User not found', 404);
            return;
        }

        res.sendSuccess(rows[0]);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.sendError('Error fetching user', 500);
    }
};

export const signupOwner: RequestHandler = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validate request data using the imported schema
        const { error } = createUserSchema.validate({ name, email, password, phone });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Check if email already exists
        const [existingUser]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser && existingUser.length > 0) {
            res.sendError('Email already exists', 409);
            return;
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const [result]: any = await pool.query(
            'INSERT INTO users (name, email, password, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, 2]
        );

        // Generate JWT token for the new user
        const token = generateToken({
            userId: result.insertId,
            email: email,
            roleId: 2
        });

        // Store the token in the database
        await pool.query('UPDATE users SET token = ? WHERE id = ?', [token, result.insertId]);

        // Send token to user's email
        const emailSent = await sendLoginToken(email, name, token);

        res.status(201).json({
            status: true,
            data: {
                message: 'Owner registered successfully' + (emailSent ? ', token sent to your email' : ''),
                userId: result.insertId,
                token,
                emailSent
            }
        });
    } catch (error: any) {
        console.error('Error during signup:', error);
        res.sendError('Error during signup', 500);
    }
};

export const signupGuest: RequestHandler = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validate request data using the imported schema
        const { error } = createUserSchema.validate({ name, email, password, phone });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Check if email already exists
        const [existingUser]: any = await pool.query('SELECT id FROM users WHERE email = ?', [email]);
        if (existingUser && existingUser.length > 0) {
            res.sendError('Email already exists', 409);
            return;
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const [result]: any = await pool.query(
            'INSERT INTO users (name, email, password, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, 3]
        );

        // Generate JWT token for the new user
        const token = generateToken({
            userId: result.insertId,
            email: email,
            roleId: 3
        });

        // Store the token in the database
        await pool.query('UPDATE users SET token = ? WHERE id = ?', [token, result.insertId]);

        // Send token to user's email
        const emailSent = await sendLoginToken(email, name, token);

        res.status(201).json({
            status: true,
            data: {
                message: 'Guest user registered successfully' + (emailSent ? ', token sent to your email' : ''),
                userId: result.insertId,
                token,
                emailSent
            }
        });
    } catch (error: any) {
        console.error('Error during signup:', error);
        res.sendError('Error during signup', 500);
    }
};

export const login: RequestHandler = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate request data
        const { error } = loginSchema.validate({ email, password });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Find user by email
        const [users]: any = await pool.query(
            'SELECT id, name, email, password, phone, role_id FROM users WHERE email = ?',
            [email]
        );

        // Check if user exists
        if (!users || users.length === 0) {
            res.sendError('Invalid email or password', 401);
            return;
        }

        const user = users[0];

        // Verify password
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            res.sendError('Invalid email or password', 401);
            return;
        }

        // Generate JWT token
        const token = generateToken({
            userId: user.id,
            email: user.email,
            roleId: user.role_id
        });

        const [result]: any = await pool.query('UPDATE users SET token = ? WHERE email = ?', [token, email]);

        // Don't send password back to client
        delete user.password;

        res.sendSuccess({
            message: 'Login successful',
            token,
            user
        });
    } catch (error) {
        console.error('Error during login:', error);
        res.sendError('Error during login', 500);
    }
};

export const createOwnerUser: RequestHandler = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validate request data using the imported schema
        const { error } = createUserSchema.validate({ name, email, password, phone });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const [result]: any = await pool.query(
            'INSERT INTO users (name, email, password, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, 2]
        );

        res.status(201).json({
            status: true,
            data: {
                message: 'User created successfully',
                userId: result.insertId
            }
        });
    } catch (error: any) {
        console.error('Error creating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.sendError('Email already exists', 409);
            return;
        }

        res.sendError('Error creating user', 500);
    }
};

export const createGuestUser: RequestHandler = async (req, res) => {
    try {
        const { name, email, password, phone } = req.body;

        // Validate request data using the imported schema
        const { error } = createUserSchema.validate({ name, email, password, phone });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Hash the password before storing it
        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const [result]: any = await pool.query(
            'INSERT INTO users (name, email, password, phone, role_id) VALUES (?, ?, ?, ?, ?)',
            [name, email, hashedPassword, phone || null, 3]
        );

        res.status(201).json({
            status: true,
            data: {
                message: 'User created successfully',
                userId: result.insertId
            }
        });
    } catch (error: any) {
        console.error('Error creating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.sendError('Email already exists', 409);
            return;
        }

        res.sendError('Error creating user', 500);
    }
};

export const updateOwnerUser: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, password } = req.body;

        // Validate update data using the imported schema
        const { error } = updateUserSchema.validate({ name, email, phone, password });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Check if the user exists before updating
        const [userCheck]: any = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (!userCheck || userCheck.length === 0) {
            res.sendError('User not found', 404);
            return;
        }

        // If password is being updated, hash it
        let hashedPassword;
        if (password) {
            hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        }

        // Build dynamic update query based on provided fields
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
        updateQuery += ' WHERE id = ? AND role_id = 2';
        updateValues.push(id);

        const [result]: any = await pool.query(updateQuery, updateValues);

        if (result.affectedRows > 0) {
            res.sendSuccess({ message: 'User updated successfully' });
        } else {
            res.sendError('User not found', 404);
        }

    } catch (error: any) {
        console.error('Error updating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.sendError('Email already exists', 409);
            return;
        }

        res.sendError('Error updating user', 500);
    }
};

export const updateGuestUser: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, email, phone, password } = req.body;

        // Validate update data using the imported schema
        const { error } = updateUserSchema.validate({ name, email, phone, password });
        if (error) {
            res.sendError(error.details[0].message, 400);
            return;
        }

        // Check if the user exists before updating
        const [userCheck]: any = await pool.query('SELECT id FROM users WHERE id = ?', [id]);
        if (!userCheck || userCheck.length === 0) {
            res.sendError('User not found', 404);
            return;
        }

        // If password is being updated, hash it
        let hashedPassword;
        if (password) {
            hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
        }

        // Build dynamic update query based on provided fields
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
        updateQuery += ' WHERE id = ? AND role_id = 3';
        updateValues.push(id);

        const [result]: any = await pool.query(updateQuery, updateValues);

        if (result.affectedRows > 0) {
            res.sendSuccess({ message: 'User updated successfully' });
        } else {
            res.sendError('User not found', 404);
        }

    } catch (error: any) {
        console.error('Error updating user:', error);

        if (error.code === 'ER_DUP_ENTRY') {
            res.sendError('Email already exists', 409);
            return;
        }

        res.sendError('Error updating user', 500);
    }
};

export const deleteUser: RequestHandler = async (req, res) => {
    try {
        const { id } = req.params;
        const [result]: any = await pool.query('DELETE FROM users WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            res.sendError('User not found', 404);
            return;
        }

        res.sendSuccess({ message: 'User deleted successfully' });
    } catch (error) {
        console.error('Error deleting user:', error);
        res.sendError('Error deleting user', 500);
    }
};
