import { Router } from 'express';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import auth from '../middleware/auth.js';
const router = Router();
router.use(auth);
router.get('/', async (req, res, next) => {
  try {
    const now = new Date();
    const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
    const categories = await Category.find({ userId: req.user.id }).sort({ name: 1 });
    const spend = await Transaction.aggregate([
      { $match: { userId: (await import('mongoose')).default.Types.ObjectId.createFromHexString(req.user.id), type: 'expense', date: { $gte: from, $lt: to } } },
      { $group: { _id: '$categoryId', spentCents: { $sum: '$amountCents' } } }
    ]);
    const map = new Map(spend.map(x => [String(x._id), x.spentCents]));
    res.json(categories.map(c => ({ ...c.toObject(), spentCents: map.get(String(c._id)) || 0, remainingCents: c.budgetLimitCents - (map.get(String(c._id)) || 0) })));
  } catch (e) { next(e); }
});
router.put('/:categoryId', async (req, res, next) => {
  try {
    const limit = Number(req.body.budgetLimit);
    if (!Number.isFinite(limit) || limit < 0) return res.status(400).json({ message: 'Budget must be zero or greater' });
    const category = await Category.findOneAndUpdate(
      { _id: req.params.categoryId, userId: req.user.id },
      { budgetLimitCents: Math.round(limit * 100) }, { new: true, runValidators: true }
    );
    if (!category) return res.status(404).json({ message: 'Category not found' });
    res.json(category);
  } catch (e) { next(e); }
});
export default router;
