import { Router } from 'express';
import userRoutes from './user.routes';
import saloonRoutes from './saloon.routes';
import appointmentRoutes from './appointment.routes';

import * as userController from '../controllers/user.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Authentication routes
router.post('/auth/register', userController.registerUser);
router.post('/auth/login', userController.login);
router.get('/auth/me', authenticate, userController.getCurrentUser);

router.use('/users', userRoutes);
router.use('/saloons', saloonRoutes);
router.use('/appointments', appointmentRoutes);

export default router;
