import { Request, Response } from 'express';
import { RequestHandler } from 'express';
import pool from '../config/db';
import logger from '../utils/logger';
import { createSaloonSchema, createSaloonServiceSchema } from '../validations';
import {
    asyncHandler,
    NotFoundError,
    ValidationError,
    ConflictError,
    AuthorizationError,
    DatabaseError
} from '../utils/errors';

/**
 * Create a new saloon
 */
export const createSaloon: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { name, description, address, phone, email, website, opening_time, closing_time, latitude, longitude } = req.body;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    // Only owners can create saloons
    if (req.user.roleId !== 2) { // role_id 2 is for salon owners
        throw new AuthorizationError('Only salon owners can create saloons');
    }

    const ownerId = req.user.userId;
    logger.info(`Creating new salon for owner ID: ${ownerId}`);

    // Validate salon data
    const { error } = createSaloonSchema.validate({
        name, description, address, phone, email, website, opening_time, closing_time, latitude, longitude
    });

    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    try {
        // Check if owner already has a salon
        const [existingSaloon]: any = await pool.query(
            'SELECT id FROM saloons WHERE owner_id = ?',
            [ownerId]
        );

        if (existingSaloon && existingSaloon.length > 0) {
            throw new ConflictError('You already have a registered salon');
        }

        // Use default business hours if not provided
        const openingTime = opening_time || '09:00';
        const closingTime = closing_time || '17:00';

        const [result]: any = await pool.query(
            'INSERT INTO saloons (name, description, address, phone, email, website, owner_id, opening_time, closing_time, latitude, longitude) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [name, description || null, address, phone || null, email || null, website || null, ownerId, openingTime, closingTime, latitude || null, longitude || null]
        );

        logger.info(`Salon created successfully, ID: ${result.insertId}`);

        res.status(201).json({
            status: true,
            data: {
                message: 'Salon created successfully',
                saloonId: result.insertId
            }
        });
    } catch (error: any) {
        logger.error('Database error during salon creation', { error });

        if (error instanceof ConflictError) {
            throw error;
        }

        throw new DatabaseError('Failed to create salon');
    }
});

/**
 * Get all saloons with optional filtering and pagination
 */
export const getAllSaloons: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = req.query.search as string;

    logger.info(`Fetching salons with pagination: page=${page}, limit=${limit}${search ? ', search=' + search : ''}`);

    let query = 'SELECT id, name, description, address, phone, email, website, owner_id, opening_time, closing_time, latitude, longitude FROM saloons';
    const params = [];

    // Add search condition if search parameter is provided
    if (search) {
        query += ' WHERE name LIKE ? OR description LIKE ? OR address LIKE ?';
        params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    // Add pagination
    query += ' ORDER BY name LIMIT ? OFFSET ?';
    params.push(limit, offset);

    // Get total count for pagination metadata
    let countQuery = 'SELECT COUNT(*) as total FROM saloons';
    if (search) {
        countQuery += ' WHERE name LIKE ? OR description LIKE ? OR address LIKE ?';
    }

    try {
        const [rows] = await pool.query(query, params);

        // Get total count with the same filters
        const [countResult]: any = await pool.query(
            countQuery,
            search ? [`%${search}%`, `%${search}%`, `%${search}%`] : []
        );

        const total = countResult[0].total;
        const totalPages = Math.ceil(total / limit);

        res.sendSuccess({
            saloons: rows,
            pagination: {
                page,
                limit,
                total,
                totalPages
            }
        });
    } catch (error) {
        logger.error('Error fetching saloons:', error);
        throw new DatabaseError('Failed to fetch saloons');
    }
});

/**
 * Get a specific saloon by ID
 */
export const getSaloonById: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching salon with ID: ${id}`);

    try {
        // Get saloon details
        const [saloon]: any = await pool.query(
            'SELECT id, name, description, address, phone, email, website, owner_id, opening_time, closing_time, latitude, longitude FROM saloons WHERE id = ?',
            [id]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${id} not found`);
        }

        // Get services for this saloon
        const [services]: any = await pool.query(
            'SELECT id, name, description, price, duration FROM saloon_services WHERE saloon_id = ?',
            [id]
        );

        // Combine data
        const saloonData = {
            ...saloon[0],
            services: services || []
        };

        res.sendSuccess(saloonData);
    } catch (error) {
        logger.error(`Error fetching salon with ID ${id}:`, error);

        if (error instanceof NotFoundError) {
            throw error;
        }

        throw new DatabaseError('Failed to fetch salon details');
    }
});

/**
 * Get a saloon by owner's user ID
 */
export const getSaloonByOwnerId: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { userId } = req.params;
    logger.info(`Fetching salon for owner with ID: ${userId}`);

    try {
        // Get saloon details by owner ID
        const [saloon]: any = await pool.query(
            'SELECT id, name, description, address, phone, email, website, owner_id, opening_time, closing_time, latitude, longitude FROM saloons WHERE owner_id = ?',
            [userId]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`No salon found for owner`);
        }

        // Get services for this saloon
        const [services]: any = await pool.query(
            'SELECT id, name, description, price, duration FROM saloon_services WHERE saloon_id = ?',
            [saloon[0].id]
        );

        // Combine data
        const saloonData = {
            ...saloon[0],
            services: services || []
        };

        res.sendSuccess(saloonData);
    } catch (error) {
        logger.error(`Error fetching salon for owner with ID ${userId}:`, error);

        if (error instanceof NotFoundError) {
            throw error;
        }

        throw new DatabaseError('Failed to fetch salon details');
    }
});

/**
 * Add a service to a saloon
 */
export const addServiceToSaloon: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, price, duration } = req.body;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    logger.info(`Adding service to salon ID: ${id}`);

    // Validate the service data
    const { error } = createSaloonServiceSchema.validate({
        name, description, price, duration
    });

    if (error) {
        throw new ValidationError(error.details[0].message);
    }

    try {
        // Check if salon exists
        const [saloon]: any = await pool.query(
            'SELECT owner_id FROM saloons WHERE id = ?',
            [id]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${id} not found`);
        }

        // Check if user is the owner of this salon
        if (saloon[0].owner_id !== req.user.userId) {
            throw new AuthorizationError('You can only add services to your own salon');
        }

        // Add service
        const [result]: any = await pool.query(
            'INSERT INTO saloon_services (saloon_id, name, description, price, duration) VALUES (?, ?, ?, ?, ?)',
            [id, name, description || null, price, duration || null]
        );

        logger.info(`Service added successfully to salon ID: ${id}, service ID: ${result.insertId}`);

        res.status(201).json({
            status: true,
            data: {
                message: 'Service added successfully',
                serviceId: result.insertId
            }
        });
    } catch (error) {
        logger.error(`Error adding service to salon ID ${id}:`, error);

        if (error instanceof NotFoundError || error instanceof AuthorizationError) {
            throw error;
        }

        throw new DatabaseError('Failed to add service to salon');
    }
});

/**
 * Get all services for a specific saloon
 */
export const getSaloonServices: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    logger.info(`Fetching services for salon ID: ${id}`);

    try {
        // First check if the saloon exists
        const [saloon]: any = await pool.query(
            'SELECT id FROM saloons WHERE id = ?',
            [id]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${id} not found`);
        }

        // Get services for this saloon
        const [services]: any = await pool.query(
            'SELECT id, name, description, price, duration, created_at FROM saloon_services WHERE saloon_id = ?',
            [id]
        );

        res.sendSuccess({
            saloonId: parseInt(id),
            services: services || []
        });
    } catch (error) {
        logger.error(`Error fetching services for salon ID ${id}:`, error);

        if (error instanceof NotFoundError) {
            throw error;
        }

        throw new DatabaseError('Failed to fetch salon services');
    }
});

/**
 * Get saloon's available time slots for booking
 */
export const getSaloonAvailability: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { date, service_id } = req.query;

    // Default to today's date if not provided
    const targetDate = date ? new Date(date as string) : new Date();
    // Ensure date is valid
    if (isNaN(targetDate.getTime())) {
        throw new ValidationError('Invalid date format. Please use YYYY-MM-DD');
    }

    logger.info(`Fetching availability for salon ID: ${id}, date: ${targetDate.toISOString().split('T')[0]}`);

    try {
        // First check if the saloon exists and get its business hours
        const [saloon]: any = await pool.query(
            'SELECT id, name, opening_time, closing_time FROM saloons WHERE id = ?',
            [id]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${id} not found`);
        }

        // Parse business hours from the database
        const openingTime = saloon[0].opening_time;
        const closingTime = saloon[0].closing_time;

        // Extract hours and minutes
        const openingHour = parseInt(openingTime.split(':')[0]);
        const openingMinute = parseInt(openingTime.split(':')[1]);
        const closingHour = parseInt(closingTime.split(':')[0]);
        const closingMinute = parseInt(closingTime.split(':')[1]);

        // If service_id is provided, check if it's valid
        let service;
        let serviceDuration = 60; // Default duration in minutes
        if (service_id) {
            const [serviceResult]: any = await pool.query(
                'SELECT id, name, duration FROM saloon_services WHERE id = ? AND saloon_id = ?',
                [service_id, id]
            );

            if (!serviceResult || serviceResult.length === 0) {
                throw new NotFoundError(`Service with ID ${service_id} not found in this salon`);
            }

            service = serviceResult[0];
            // Use the service's duration or default to 60 minutes
            serviceDuration = service.duration || 60;
        }

        // Format the date for SQL query
        const dateString = targetDate.toISOString().split('T')[0];

        // Get all existing appointments for this saloon and date
        let query = `
      SELECT appointment_date, 
             TIMESTAMPDIFF(MINUTE, appointment_date, 
                          DATE_ADD(appointment_date, INTERVAL 
                            (SELECT COALESCE(ss.duration, 60) 
                             FROM saloon_services ss 
                             WHERE ss.id = a.service_id) MINUTE)) AS duration
      FROM appointments a
      WHERE a.saloon_id = ? 
        AND DATE(a.appointment_date) = ? 
        AND a.status IN ('pending', 'confirmed')
    `;

        const queryParams = [id, dateString];

        // If specific service_id is provided, only consider that service's duration
        if (service_id) {
            query += ' AND a.service_id = ?';
            queryParams.push(service_id as string);
        }

        query += ' ORDER BY a.appointment_date';

        const [appointments]: any = await pool.query(query, queryParams);

        // Generate available time slots
        const availableSlots = [];
        const slotInterval = 30; // 30-minute intervals

        // Generate time slots for the business day using salon's business hours
        for (let hour = openingHour; hour <= closingHour; hour++) {
            // For each hour, determine the minute intervals
            let startMinute = 0;
            let endMinute = 59;

            // Adjust for opening hour
            if (hour === openingHour) {
                startMinute = openingMinute;
            }

            // Adjust for closing hour
            if (hour === closingHour) {
                endMinute = closingMinute - 1; // -1 because we don't want to include the exact closing time

                // Skip this hour if we're already past the closing minute
                if (startMinute > endMinute) continue;
            }

            // Round up to the nearest slot interval
            startMinute = Math.ceil(startMinute / slotInterval) * slotInterval;

            // Generate slots for this hour
            for (let minute = startMinute; minute <= endMinute; minute += slotInterval) {
                const slotDate = new Date(targetDate);
                slotDate.setHours(hour, minute, 0, 0);

                // Skip time slots in the past (for today)
                const now = new Date();
                if (isSameDay(slotDate, now) && slotDate < now) {
                    continue;
                }

                // Check if the time slot is available (doesn't overlap with existing appointments)
                if (isTimeSlotAvailable(slotDate, serviceDuration, appointments)) {
                    availableSlots.push({
                        time: slotDate.toISOString(),
                        formatted_time: formatTime(slotDate)
                    });
                }
            }
        }

        res.sendSuccess({
            saloon_id: parseInt(id),
            saloon_name: saloon[0].name,
            service_id: service_id ? parseInt(service_id as string) : null,
            service_name: service ? service.name : null,
            date: dateString,
            business_hours: {
                opening_time: formatTime(new Date(new Date(targetDate).setHours(openingHour, openingMinute))),
                closing_time: formatTime(new Date(new Date(targetDate).setHours(closingHour, closingMinute)))
            },
            available_slots: availableSlots
        });
    } catch (error) {
        logger.error(`Error fetching availability for salon ID ${id}:`, error);

        if (error instanceof NotFoundError || error instanceof ValidationError) {
            throw error;
        }

        throw new DatabaseError('Failed to fetch salon availability');
    }
});

/**
 * Helper function to check if a time slot is available
 */
function isTimeSlotAvailable(
    slotTime: Date,
    slotDuration: number,
    existingAppointments: any[]
): boolean {
    // Calculate the end time for this slot
    const slotEndTime = new Date(slotTime);
    slotEndTime.setMinutes(slotEndTime.getMinutes() + slotDuration);

    // Check against all existing appointments
    for (const appointment of existingAppointments) {
        const appointmentTime = new Date(appointment.appointment_date);
        const appointmentEndTime = new Date(appointmentTime);
        appointmentEndTime.setMinutes(appointmentEndTime.getMinutes() + appointment.duration);

        // If there's an overlap between the slot and an existing appointment
        if (
            (slotTime >= appointmentTime && slotTime < appointmentEndTime) ||
            (slotEndTime > appointmentTime && slotEndTime <= appointmentEndTime) ||
            (slotTime <= appointmentTime && slotEndTime >= appointmentEndTime)
        ) {
            return false;
        }
    }

    return true;
}

/**
 * Helper function to format time for display
 */
function formatTime(date: Date): string {
    let hours = date.getHours();
    const minutes = date.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // Convert 0 to 12

    const formattedMinutes = minutes < 10 ? '0' + minutes : minutes;

    return `${hours}:${formattedMinutes} ${ampm}`;
}

/**
 * Helper function to check if two dates are on the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
    return date1.getFullYear() === date2.getFullYear() &&
        date1.getMonth() === date2.getMonth() &&
        date1.getDate() === date2.getDate();
}

/**
 * Update a saloon (owner only)
 */
export const updateSaloon: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, description, address, phone, email, website, opening_time, closing_time, latitude, longitude } = req.body;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    logger.info(`Updating salon with ID: ${id}`);

    try {
        // Check if salon exists and if the user is the owner
        const [saloon]: any = await pool.query(
            'SELECT owner_id FROM saloons WHERE id = ?',
            [id]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${id} not found`);
        }

        // Verify ownership
        if (saloon[0].owner_id !== req.user.userId) {
            throw new AuthorizationError('You can only update your own salon');
        }

        // Validate update data if provided
        if (opening_time || closing_time) {
            const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

            if (opening_time && !timePattern.test(opening_time)) {
                throw new ValidationError('Opening time must be in HH:MM format (24-hour)');
            }

            if (closing_time && !timePattern.test(closing_time)) {
                throw new ValidationError('Closing time must be in HH:MM format (24-hour)');
            }

            // Check if closing time is after opening time
            if (opening_time && closing_time) {
                const [openingHour, openingMinute] = opening_time.split(':').map(Number);
                const [closingHour, closingMinute] = closing_time.split(':').map(Number);

                if (openingHour > closingHour ||
                    (openingHour === closingHour && openingMinute >= closingMinute)) {
                    throw new ValidationError('Closing time must be after opening time');
                }
            }
        }

        // Build dynamic update query
        let updateQuery = 'UPDATE saloons SET ';
        const updateValues = [];

        if (name) {
            updateQuery += 'name = ?, ';
            updateValues.push(name);
        }

        if (description !== undefined) {
            updateQuery += 'description = ?, ';
            updateValues.push(description || null);
        }

        if (address) {
            updateQuery += 'address = ?, ';
            updateValues.push(address);
        }

        if (phone !== undefined) {
            updateQuery += 'phone = ?, ';
            updateValues.push(phone || null);
        }

        if (email !== undefined) {
            updateQuery += 'email = ?, ';
            updateValues.push(email || null);
        }

        if (website !== undefined) {
            updateQuery += 'website = ?, ';
            updateValues.push(website || null);
        }

        if (opening_time) {
            updateQuery += 'opening_time = ?, ';
            updateValues.push(opening_time);
        }

        if (closing_time) {
            updateQuery += 'closing_time = ?, ';
            updateValues.push(closing_time);
        }

        if (latitude !== undefined) {
            updateQuery += 'latitude = ?, ';
            updateValues.push(latitude || null);
        }

        if (longitude !== undefined) {
            updateQuery += 'longitude = ?, ';
            updateValues.push(longitude || null);
        }

        // Check if there are any fields to update
        if (updateValues.length === 0) {
            throw new ValidationError('At least one field must be provided for update');
        }

        // Remove trailing comma and space
        updateQuery = updateQuery.slice(0, -2);

        // Add WHERE clause
        updateQuery += ' WHERE id = ?';
        updateValues.push(id);

        const [result]: any = await pool.query(updateQuery, updateValues);

        if (result.affectedRows > 0) {
            logger.info(`Salon with ID ${id} updated successfully`);
            res.sendSuccess({
                message: 'Salon updated successfully',
                saloonId: parseInt(id)
            });
        } else {
            throw new DatabaseError('Failed to update salon');
        }
    } catch (error) {
        logger.error(`Error updating salon with ID ${id}:`, error);

        if (error instanceof NotFoundError ||
            error instanceof ValidationError ||
            error instanceof AuthorizationError) {
            throw error;
        }

        throw new DatabaseError('Failed to update salon');
    }
});

/**
 * Delete a saloon (owner only)
 */
export const deleteSaloon: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!req.user) {
        throw new AuthorizationError('Authentication required');
    }

    logger.info(`Attempting to delete salon with ID: ${id}`);

    try {
        // Check if salon exists and if the user is the owner
        const [saloon]: any = await pool.query(
            'SELECT owner_id FROM saloons WHERE id = ?',
            [id]
        );

        if (!saloon || saloon.length === 0) {
            throw new NotFoundError(`Salon with ID ${id} not found`);
        }

        // Verify ownership
        if (saloon[0].owner_id !== req.user.userId) {
            throw new AuthorizationError('You can only delete your own salon');
        }

        // Delete the salon (cascade will handle related services)
        const [result]: any = await pool.query('DELETE FROM saloons WHERE id = ?', [id]);

        if (result.affectedRows > 0) {
            logger.info(`Salon with ID ${id} deleted successfully`);
            res.sendSuccess({
                message: 'Salon deleted successfully'
            });
        } else {
            throw new DatabaseError('Failed to delete salon');
        }
    } catch (error) {
        logger.error(`Error deleting salon with ID ${id}:`, error);

        if (error instanceof NotFoundError || error instanceof AuthorizationError) {
            throw error;
        }

        throw new DatabaseError('Failed to delete salon');
    }
});

/**
 * Get nearby saloons based on latitude and longitude (within 10km radius)
 */
export const getNearbySaloons: RequestHandler = asyncHandler(async (req: Request, res: Response) => {
    const { latitude, longitude } = req.query;

    if (!latitude || !longitude) {
        throw new ValidationError('latitude and longitude are required');
    }

    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);

    if (isNaN(lat) || isNaN(lng)) {
        throw new ValidationError('latitude and longitude must be valid numbers');
    }

    // 10km radius
    const radius = 10;

    // Haversine formula in SQL (distance in km)
    const query = `
        SELECT id, name, description, address, phone, email, website, owner_id, opening_time, closing_time, latitude, longitude,
            (6371 * acos(
                cos(radians(?)) * cos(radians(latitude)) *
                cos(radians(longitude) - radians(?)) +
                sin(radians(?)) * sin(radians(latitude))
            )) AS distance
        FROM saloons
        WHERE latitude IS NOT NULL AND longitude IS NOT NULL
        HAVING distance <= ?
        ORDER BY distance ASC
        LIMIT 50
    `;

    try {
        const [rows]: any = await pool.query(query, [lat, lng, lat, radius]);
        res.sendSuccess({
            saloons: rows
        });
    } catch (error) {
        logger.error('Error fetching nearby saloons:', error);
        throw new DatabaseError('Failed to fetch nearby saloons');
    }
});
