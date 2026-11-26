import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
  listBills,
  createBill,
  updateBill,
  setBillStatus,
  deleteBill,
} from '../controllers/billController.js';

const router = Router();

// Every bill route is scoped to the authenticated user.
router.use(auth);

router.get('/', listBills);
router.post('/', createBill);
router.put('/:id', updateBill);
router.patch('/:id/status', setBillStatus);
router.delete('/:id', deleteBill);

export default router;
