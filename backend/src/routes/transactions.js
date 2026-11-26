import { Router } from 'express';
import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import auth from '../middleware/auth.js';
import { toCents } from '../utils/money.js';
import { syncUserBudgetAlerts } from '../controllers/budgetAlertsController.js';
const router = Router();
router.use(auth);

// Recompute in-app budget alerts after a transaction changes. Errors here must
// never break the transaction request itself.
async function refreshBudgetAlerts(userId) {
  try {
    await syncUserBudgetAlerts(userId);
  } catch (error) {
    console.error('Budget alert sync failed:', error.message);
  }
}

router.get('/', async (req, res, next) => {
  try {
    const { from, to, type, category, page = 1, limit = 10 } = req.query;
    const filter = { userId: req.user.id };
    if (from || to) filter.date = {};
    if (from) filter.date.$gte = new Date(from);
    if (to) filter.date.$lt = new Date(to);
    if (['income', 'expense'].includes(type)) filter.type = type;
    if (category && mongoose.isValidObjectId(category)) filter.categoryId = category;
    const safeLimit = Math.min(50, Math.max(1, Number(limit) || 10));
    const [items, total] = await Promise.all([
      Transaction.find(filter).populate('categoryId', 'name icon color').sort({ date: -1, _id: -1 }).skip((Math.max(1, Number(page)) - 1) * safeLimit).limit(safeLimit),
      Transaction.countDocuments(filter)
    ]);
    res.json({ items, total, page: Math.max(1, Number(page)), pages: Math.ceil(total / safeLimit) });
  } catch (e) { next(e); }
});

router.post('/', async (req, res, next) => {
  try {
    const { type, amount, categoryId, date, note = '', paymentMode = 'Other', isRecurring = false, recurrence = null } = req.body;
    if (!['income', 'expense'].includes(type) || !date || !mongoose.isValidObjectId(categoryId))
      return res.status(400).json({ message: 'Valid type, category, and date are required' });
    const category = await Category.findOne({ _id: categoryId, userId: req.user.id });
    if (!category) return res.status(400).json({ message: 'Invalid category' });
    const amountCents = toCents(amount);
    const transaction = await Transaction.create({
      userId: req.user.id, type, amountCents, categoryId, date: new Date(date), note, paymentMode,
      isRecurring: Boolean(isRecurring), recurrence: isRecurring ? recurrence : null,
      nextOccurrence: isRecurring ? new Date(date) : null,
      recurringKey: isRecurring ? new mongoose.Types.ObjectId().toString() : null
    });
    await refreshBudgetAlerts(req.user.id);
    res.status(201).json(await transaction.populate('categoryId', 'name icon color'));
  } catch (e) { next(e); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const updates = {};
    for (const key of ['type', 'categoryId', 'date', 'note', 'paymentMode']) if (req.body[key] !== undefined) updates[key] = req.body[key];
    if (req.body.amount !== undefined) updates.amountCents = toCents(req.body.amount);
    const tx = await Transaction.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, updates, { new: true, runValidators: true }).populate('categoryId', 'name icon color');
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    await refreshBudgetAlerts(req.user.id);
    res.json(tx);
  } catch (e) { next(e); }
});
router.delete('/:id', async (req, res, next) => {
  try {
    const tx = await Transaction.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!tx) return res.status(404).json({ message: 'Transaction not found' });
    await refreshBudgetAlerts(req.user.id);
    res.json({ message: 'Transaction deleted' });
  } catch (e) { next(e); }
});
export default router;
