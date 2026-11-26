import { Router } from 'express';
import auth from '../middleware/auth.js';
import * as savingsController from '../controllers/savingsGoalController.js';

const router = Router();

// Reuse the existing authentication middleware for the whole feature.
router.use(auth);

router.get('/', savingsController.list);
router.post('/', savingsController.create);

// Static paths must be declared before the dynamic "/:id" routes.
router.get('/summary', savingsController.summary);
router.get('/activity', savingsController.activity);

router.get('/:id/contributions', savingsController.contributions);
router.post('/:id/contribute', savingsController.contribute);
router.put('/:id', savingsController.update);
router.delete('/:id', savingsController.remove);

export default router;
