import { Request, Response } from 'express';
import { RequestHandler } from 'express';
import pool from '../config/db';
import logger from '../utils/logger';
import { createAppointmentSchema, updateAppointmentStatusSchema } from '../validations';
import {
    asyncHandler,
    NotFoundError,
    ValidationError,
    ConflictError,
    AuthorizationError,
    DatabaseError
} from '../utils/errors';
import { AppointmentStatus } from '../models/appointment.model';

/**
 * Book a new appointment (for guests)
 */
export const bookAppointment: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { saloon_id, service_id, appointment_date, notes } = req.body;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    // Guests can book appointments (role_id = 3)
    if (req.user.roleId !== 3) {
        throw new AuthorizationError('Only guests can book appointments');
    }

    const guestId = req.user.userId;
    logger.info(`Creating new appointment for guest ID: ${guestId}, salon ID: ${saloon_id}`);

    // Validate request data
    const { error } = createAppointmentSchema.validate({
        saloon_id,
        service_id,
        appointment_date,
        notes
    });

    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    try {
        // Check if salon exists
        const [saloon]: any = await pool.query('SELECT id FROM saloons WHERE id = ?', [saloon_id]);

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${saloon_id} not found`);
        }

        // Check if service exists and belongs to the salon
        const [service]: any = await pool.query(
            'SELECT id FROM saloon_services WHERE id = ? AND saloon_id = ?',
            [service_id, saloon_id]
        );

        if (!service || service.length === 0) {
            throw new NotFoundError(`Service with ID ${service_id} not found in this salon`);
        }

        // Book the appointment
        const [result]: any = await pool.query(
            `INSERT INTO appointments 
       (guest_id, saloon_id, service_id, appointment_date, status, notes) 
       VALUES (?, ?, ?, ?, ?, ?)`,
            [guestId, saloon_id, service_id, new Date(appointment_date), AppointmentStatus.PENDING, notes || null]
        );

        logger.info(`Appointment booked successfully, ID: ${result.insertId}`);

        res.status(201).json({
            status: true,
            data: {
                message: 'Appointment booked successfully',
                appointmentId: result.insertId
            }
        });
    } catch (error) {
        logger.error('Error booking appointment:', error);

        if (error instanceof NotFoundError) {
            throw error;
        }

        throw new DatabaseError('Failed to book appointment');
    }
});

/**
 * Get user's appointments with pagination (for both guests and owners)
 */
export const getUserAppointments: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const status = req.query.status as string;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    const userId = req.user.userId;
    const isOwner = req.user.roleId === 2;
    const isGuest = req.user.roleId === 3;

    if (!isOwner && !isGuest) {
        throw new AuthorizationError('Only salon owners and guests can view appointments');
    }

    logger.info(`Fetching appointments for user ID: ${userId}, role: ${isOwner ? 'owner' : 'guest'}`);

    try {
        let query, countQuery, queryParams = [];

        if (isOwner) {
            // For salon owners, get appointments for their salon
            query = `
        SELECT a.*, 
               u.name as guest_name, 
               u.email as guest_email,
               ss.name as service_name, 
               ss.price as service_price
        FROM appointments a
        JOIN saloons s ON a.saloon_id = s.id
        JOIN users u ON a.guest_id = u.id
        JOIN saloon_services ss ON a.service_id = ss.id
        WHERE s.owner_id = ?
      `;

            countQuery = `
        SELECT COUNT(*) as total
        FROM appointments a
        JOIN saloons s ON a.saloon_id = s.id
        WHERE s.owner_id = ?
      `;

            queryParams.push(userId);
        } else {
            // For guests, get their own appointments
            query = `
        SELECT a.*,
               s.name as saloon_name,
               s.address as saloon_address,
               ss.name as service_name,
               ss.price as service_price
        FROM appointments a
        JOIN saloons s ON a.saloon_id = s.id
        JOIN saloon_services ss ON a.service_id = ss.id
        WHERE a.guest_id = ?
      `;

            countQuery = `
        SELECT COUNT(*) as total
        FROM appointments a
        WHERE a.guest_id = ?
      `;

            queryParams.push(userId);
        }

        // Add status filter if provided
        if (status && Object.values(AppointmentStatus).includes(status as AppointmentStatus)) {
            query += ' AND a.status = ?';
            countQuery += ' AND a.status = ?';
            queryParams.push(status);
        }

        // Add sorting and pagination
        query += ' ORDER BY a.appointment_date DESC LIMIT ? OFFSET ?';
        queryParams.push(limit, offset);

        // Execute queries
        const [appointments] = await pool.query(query, queryParams);

        // Get total count with the same filters (excluding limit and offset)
        const [countResult]: any = await pool.query(
            countQuery,
            queryParams.slice(0, status ? 2 : 1)
        );

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        res.sendSuccess({
            appointments,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (error) {
        logger.error('Error fetching appointments:', error);
        throw new DatabaseError('Failed to fetch appointments');
    }
});

/**
 * Update appointment status (for both owners and guests)
 */
export const updateAppointmentStatus: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    const userId = req.user.userId;
    const isOwner = req.user.roleId === 2;
    const isGuest = req.user.roleId === 3;

    logger.info(`Updating appointment ID: ${id} status to: ${status}`);

    // Validate request data
    const { error } = updateAppointmentStatusSchema.validate({ status, notes });
    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    try {
        // Get the appointment with salon information
        const [appointments]: any = await pool.query(
            `SELECT a.*, s.owner_id 
       FROM appointments a
       JOIN saloons s ON a.saloon_id = s.id
       WHERE a.id = ?`,
            [id]
        );

        if (!appointments || appointments.length === 0) {
            throw new NotFoundError(`Appointment with ID ${id} not found`);
        }

        const appointment = appointments[0];

        // Check authorization
        const canUpdate =
            (isOwner && appointment.owner_id === userId) ||
            (isGuest && appointment.guest_id === userId);

        if (!canUpdate) {
            throw new AuthorizationError('You can only update your own appointments');
        }

        // Check valid state transitions
        if (!isValidStatusTransition(appointment.status, status as AppointmentStatus, isOwner)) {
            throw new ValidationError(`Cannot change status from '${appointment.status}' to '${status}' with your role`);
        }

        // Update the appointment
        const updateFields = ['status = ?'];
        const updateValues = [status];

        if (notes !== undefined) {
            updateFields.push('notes = ?');
            updateValues.push(notes);
        }

        updateValues.push(id); // For the WHERE clause

        const [result]: any = await pool.query(
            `UPDATE appointments SET ${updateFields.join(', ')}, updated_at = NOW() WHERE id = ?`,
            updateValues
        );

        if (result.affectedRows === 0) {
            throw new DatabaseError('Failed to update appointment status');
        }

        logger.info(`Appointment ID: ${id} status updated to ${status}`);

        res.sendSuccess({
            message: 'Appointment status updated successfully',
            appointmentId: parseInt(id),
            status
        });
    } catch (error) {
        logger.error(`Error updating appointment status:`, error);

        if (error instanceof NotFoundError ||
            error instanceof ValidationError ||
            error instanceof AuthorizationError) {
            throw error;
        }

        throw new DatabaseError('Failed to update appointment status');
    }
});

/**
 * Helper function to validate appointment status transitions
 */
function isValidStatusTransition(
    currentStatus: AppointmentStatus,
    newStatus: AppointmentStatus,
    isOwner: boolean
): boolean {
    // Owners can change pending to confirmed or cancelled
    if (isOwner) {
        if (currentStatus === AppointmentStatus.PENDING) {
            return [AppointmentStatus.CONFIRMED, AppointmentStatus.CANCELLED].includes(newStatus);
        }

        if (currentStatus === AppointmentStatus.CONFIRMED) {
            return [AppointmentStatus.COMPLETED, AppointmentStatus.CANCELLED].includes(newStatus);
        }

        // Cannot change from cancelled or completed
        return false;
    }
    // Guests can only cancel their appointments
    else {
        if ([AppointmentStatus.PENDING, AppointmentStatus.CONFIRMED].includes(currentStatus)) {
            return newStatus === AppointmentStatus.CANCELLED;
        }

        return false;
    }
}
