import Joi from 'joi';
import { AppointmentStatus } from '../../models/appointment.model';

// Appointment creation validation schema
export const createAppointmentSchema = Joi.object({
    saloon_id: Joi.number().integer().positive().required(),
    service_id: Joi.number().integer().positive().required(),
    appointment_date: Joi.date().iso().greater('now').required(),
    notes: Joi.string().allow(null, '').max(500).optional()
});

// Appointment status update validation schema
export const updateAppointmentStatusSchema = Joi.object({
    status: Joi.string()
        .valid(...Object.values(AppointmentStatus))
        .required(),
    notes: Joi.string().allow(null, '').max(500).optional()
});
