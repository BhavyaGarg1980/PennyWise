import { Router } from 'express';
import Category from '../models/Category.js';
import auth from '../middleware/auth.js';
const router = Router();
router.use(auth);
router.get('/', async (req, res, next) => {
  try {
    let categories = await Category.find({ userId: req.user.id }).sort({ name: 1 });
    if (!categories.length) {
      const defaults = [
        ['Food & Dining','🍜','#f97316'], ['Transport','🚗','#0ea5e9'], ['Housing','🏠','#8b5cf6'],
        ['Shopping','🛍️','#ec4899'], ['Health','💊','#14b8a6'], ['Entertainment','🎬','#eab308'],
        ['Salary','💼','#22c55e'], ['Education','📚','#6366f1'], ['Other','📌','#64748b']
      ];
      await Category.insertMany(defaults.map(([name, icon, color]) => ({ userId: req.user.id, name, icon, color })));
      categories = await Category.find({ userId: req.user.id }).sort({ name: 1 });
    }
    res.json(categories);
  } catch (e) { next(e); }
});
router.post('/', async (req, res, next) => {
  try {
    const category = await Category.create({ userId: req.user.id, name: req.body.name, icon: req.body.icon, color: req.body.color });
    res.status(201).json(category);
  } catch (e) { next(e); }
});

// Update a category's monthly budget limit.
router.patch('/:id/budget', async (req, res, next) => {
  try {
    const budgetLimit = Number(req.body.budgetLimit);

    if (
      !Number.isFinite(budgetLimit) ||
      budgetLimit < 0 ||
      budgetLimit > 100000000
    ) {
      return res.status(400).json({
        message: 'Enter a valid, non-negative budget amount.',
      });
    }

    const category = await Category.findOneAndUpdate(
      {
        _id: req.params.id,
        userId: req.user.id,
      },
      {
        $set: {
          budgetLimitCents: Math.round(budgetLimit * 100),
        },
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!category) {
      return res.status(404).json({
        message: 'Category not found.',
      });
    }

    res.json(category);
  } catch (error) {
    next(error);
  }
});

export default router;
