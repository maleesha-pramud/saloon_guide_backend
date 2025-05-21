import { Router } from 'express';
import * as saloonController from '../controllers/saloon.controller';
import { authenticate, authorizeOwner } from '../middleware/auth.middleware';

const router = Router();

// Saloon management routes
router.post('', authenticate, authorizeOwner, saloonController.createSaloon);
router.get('', saloonController.getAllSaloons);
router.get('/owner/:userId', saloonController.getSaloonByOwnerId);
router.get('/:id', saloonController.getSaloonById);
router.get('/:id/services', saloonController.getSaloonServices);
router.get('/:id/availability', saloonController.getSaloonAvailability);
router.get('/nearby', saloonController.getNearbySaloons);
router.post('/:id/services', authenticate, authorizeOwner, saloonController.addServiceToSaloon);
router.put('/:id', authenticate, authorizeOwner, saloonController.updateSaloon);
router.delete('/:id', authenticate, authorizeOwner, saloonController.deleteSaloon);

export default router;
