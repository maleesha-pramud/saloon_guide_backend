import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth.middleware';

const router = Router();

// User management routes
router.get('', authenticate, authorizeAdmin, userController.getAllUsers);
router.get('/:id', authenticate, userController.getUserById);
router.put('/:id', authenticate, userController.updateUser);
router.delete('/:id', authenticate, authorizeAdmin, userController.deleteUser);

// Legacy routes for backward compatibility
router.post('/owner/signup', userController.registerUser);
router.post('/guest/signup', userController.registerUser);
router.post('/login', userController.login);
router.get('/owner', authenticate, authorizeAdmin, userController.getAllOwnerUsers);
router.post('/owner', authenticate, authorizeAdmin, userController.createUser);
router.put('/owner/:id', authenticate, userController.updateUser);
router.get('/guest', authenticate, authorizeAdmin, userController.getAllGuestUsers);
router.post('/guest', authenticate, authorizeAdmin, userController.createUser);
router.put('/guest/:id', authenticate, userController.updateUser);

export default router;
