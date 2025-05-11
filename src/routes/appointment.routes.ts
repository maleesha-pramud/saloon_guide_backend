import { Router } from 'express';
import * as appointmentController from '../controllers/appointment.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Appointment routes
router.post('', authenticate, appointmentController.bookAppointment);
router.get('', authenticate, appointmentController.getUserAppointments);
router.patch('/:id', authenticate, appointmentController.updateAppointmentStatus);

export default router;
