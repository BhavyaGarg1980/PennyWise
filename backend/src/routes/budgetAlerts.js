import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
  getBudgetAlerts,
  syncBudgetAlerts,
} from '../controllers/budgetAlertsController.js';

const router = Router();

// All budget alert routes require an authenticated user.
router.use(auth);

router.get('/', getBudgetAlerts);
router.post('/sync', syncBudgetAlerts);

export default router;
