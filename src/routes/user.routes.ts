import { Router } from 'express';
import * as userController from '../controllers/user.controller';
import { authenticate, authorizeAdmin } from '../middleware/auth.middleware';

const router = Router();

// Public authentication routes
router.post('/owner/signup', userController.signupOwner);
router.post('/guest/signup', userController.signupGuest);
router.post('/login', userController.login);

router.get('/owner', authenticate, authorizeAdmin, userController.getAllOwnerUsers);
router.post('/owner', authenticate, authorizeAdmin, userController.createOwnerUser);
router.put('/owner/:id', authenticate, userController.updateOwnerUser);

router.get('/guest', authenticate, authorizeAdmin, userController.getAllGuestUsers);
router.post('/guest', authenticate, authorizeAdmin, userController.createGuestUser);
router.put('/guest/:id', authenticate, userController.updateGuestUser);

// Protected routes - require authentication
router.get('/:id', authenticate, userController.getUserById);
router.delete('/:id', authenticate, authorizeAdmin, userController.deleteUser);

export default router;
