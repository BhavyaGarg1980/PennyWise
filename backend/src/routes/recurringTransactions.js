import { Router } from 'express';
import auth from '../middleware/auth.js';
import * as recurringController from '../controllers/recurringTransactionController.js';

const router = Router();

// Reuse the existing authentication middleware for the whole feature.
router.use(auth);

router.get('/', recurringController.list);
router.post('/', recurringController.create);

// Manual processing trigger (also runs automatically in the background).
router.post('/run-due', recurringController.runDue);

router.get('/:id/history', recurringController.history);
router.put('/:id', recurringController.update);
router.patch('/:id/status', recurringController.updateStatus);
router.delete('/:id', recurringController.remove);

export default router;
