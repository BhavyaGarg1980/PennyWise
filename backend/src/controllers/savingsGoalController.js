import mongoose from 'mongoose';
import SavingsGoal from '../models/SavingsGoal.js';
import SavingsContribution from '../models/SavingsContribution.js';
import Wallet from '../models/Wallet.js';
import { toCents } from '../utils/money.js';

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function resolveWallet(userId, walletId) {
  if (walletId === undefined || walletId === null || walletId === '') {
    return { ok: true, value: null };
  }
  if (!mongoose.isValidObjectId(walletId)) {
    return { ok: false };
  }
  const wallet = await Wallet.findOne({ _id: walletId, userId });
  if (!wallet) return { ok: false };
  return { ok: true, value: wallet._id };
}

function withProgress(goal) {
  const obj = goal.toObject ? goal.toObject() : goal;
  const progressPercent =
    obj.targetAmountCents > 0
      ? Math.round((obj.currentAmountCents / obj.targetAmountCents) * 10000) / 100
      : 0;

  return { ...obj, progressPercent };
}

// GET /api/savings-goals
export async function list(req, res, next) {
  try {
    const filter = { userId: req.user.id };
    if (['active', 'completed', 'archived'].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const goals = await SavingsGoal.find(filter).sort({
      status: 1,
      targetDate: 1,
      createdAt: -1
    });

    res.json(goals.map(withProgress));
  } catch (error) {
    next(error);
  }
}

// GET /api/savings-goals/summary
export async function summary(req, res, next) {
  try {
    const userId = req.user.id;

    const [totals] = await SavingsGoal.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: null,
          totalSavedCents: { $sum: '$currentAmountCents' },
          totalTargetCents: { $sum: '$targetAmountCents' },
          activeCount: {
            $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
          },
          completedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    const now = new Date();
    const upcoming = await SavingsGoal.find({
      userId,
      status: 'active',
      targetDate: { $gte: now }
    })
      .sort({ targetDate: 1 })
      .limit(5);

    res.json({
      totalSavedCents: totals?.totalSavedCents || 0,
      totalTargetCents: totals?.totalTargetCents || 0,
      activeCount: totals?.activeCount || 0,
      completedCount: totals?.completedCount || 0,
      upcomingDeadlines: upcoming.map(withProgress)
    });
  } catch (error) {
    next(error);
  }
}

// GET /api/savings-goals/activity  (recent deposits/withdrawals across goals)
export async function activity(req, res, next) {
  try {
    const items = await SavingsContribution.find({ userId: req.user.id })
      .populate('goalId', 'name')
      .populate('walletId', 'name')
      .sort({ date: -1, _id: -1 })
      .limit(20);

    res.json(items);
  } catch (error) {
    next(error);
  }
}

// POST /api/savings-goals
export async function create(req, res, next) {
  try {
    const { name, targetAmount, targetDate, description = '' } = req.body;

    if (!name || !String(name).trim()) {
      return badRequest(res, 'A goal name is required.');
    }

    let targetAmountCents;
    try {
      targetAmountCents = toCents(targetAmount);
    } catch (error) {
      return badRequest(res, error.message);
    }

    let targetDateValue = null;
    if (targetDate) {
      targetDateValue = parseDate(targetDate);
      if (!targetDateValue) {
        return badRequest(res, 'The target date is invalid.');
      }
    }

    const goal = await SavingsGoal.create({
      userId: req.user.id,
      name: String(name).trim(),
      targetAmountCents,
      currentAmountCents: 0,
      targetDate: targetDateValue,
      description: String(description || '').trim(),
      status: 'active'
    });

    res.status(201).json(withProgress(goal));
  } catch (error) {
    next(error);
  }
}

// PUT /api/savings-goals/:id
export async function update(req, res, next) {
  try {
    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!goal) {
      return res.status(404).json({ message: 'Savings goal not found.' });
    }

    if (req.body.name !== undefined) {
      if (!String(req.body.name).trim()) {
        return badRequest(res, 'A goal name is required.');
      }
      goal.name = String(req.body.name).trim();
    }

    if (req.body.targetAmount !== undefined) {
      let targetAmountCents;
      try {
        targetAmountCents = toCents(req.body.targetAmount);
      } catch (error) {
        return badRequest(res, error.message);
      }
      goal.targetAmountCents = targetAmountCents;
    }

    if (req.body.targetDate !== undefined) {
      if (!req.body.targetDate) {
        goal.targetDate = null;
      } else {
        const targetDateValue = parseDate(req.body.targetDate);
        if (!targetDateValue) {
          return badRequest(res, 'The target date is invalid.');
        }
        goal.targetDate = targetDateValue;
      }
    }

    if (req.body.description !== undefined) {
      goal.description = String(req.body.description || '').trim();
    }

    if (req.body.status !== undefined) {
      if (!['active', 'completed', 'archived'].includes(req.body.status)) {
        return badRequest(res, 'Invalid goal status.');
      }
      goal.status = req.body.status;
    }

    // Keep the derived status in sync with the amounts.
    if (
      goal.status !== 'archived' &&
      goal.currentAmountCents >= goal.targetAmountCents
    ) {
      goal.status = 'completed';
    }

    await goal.save();

    res.json(withProgress(goal));
  } catch (error) {
    next(error);
  }
}

// DELETE /api/savings-goals/:id
export async function remove(req, res, next) {
  try {
    const goal = await SavingsGoal.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!goal) {
      return res.status(404).json({ message: 'Savings goal not found.' });
    }

    // Cascade: remove the goal's contribution history too.
    await SavingsContribution.deleteMany({
      userId: req.user.id,
      goalId: goal._id
    });

    res.json({ message: 'Savings goal deleted.' });
  } catch (error) {
    next(error);
  }
}

// GET /api/savings-goals/:id/contributions
export async function contributions(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return badRequest(res, 'Invalid goal id.');
    }

    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!goal) {
      return res.status(404).json({ message: 'Savings goal not found.' });
    }

    const items = await SavingsContribution.find({
      userId: req.user.id,
      goalId: goal._id
    })
      .populate('walletId', 'name')
      .sort({ date: -1, _id: -1 });

    res.json(items);
  } catch (error) {
    next(error);
  }
}

// POST /api/savings-goals/:id/contribute
// body: { amount, type: 'deposit' | 'withdrawal', walletId?, note? }
export async function contribute(req, res, next) {
  try {
    const goal = await SavingsGoal.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!goal) {
      return res.status(404).json({ message: 'Savings goal not found.' });
    }

    if (goal.status === 'archived') {
      return badRequest(res, 'This goal is archived and cannot be changed.');
    }

    const type = req.body.type === 'withdrawal' ? 'withdrawal' : 'deposit';

    let amountCents;
    try {
      amountCents = toCents(req.body.amount);
    } catch (error) {
      return badRequest(res, error.message);
    }

    const wallet = await resolveWallet(req.user.id, req.body.walletId);
    if (!wallet.ok) {
      return badRequest(res, 'The selected wallet is invalid.');
    }

    const note = String(req.body.note || '').trim();

    let updated;

    if (type === 'deposit') {
      // Atomic increment. Contributions above the target are allowed safely.
      updated = await SavingsGoal.findOneAndUpdate(
        { _id: goal._id, userId: req.user.id },
        { $inc: { currentAmountCents: amountCents } },
        { new: true, runValidators: true }
      );
    } else {
      // Atomic decrement guarded by a balance check, preventing negatives
      // even under concurrent requests.
      updated = await SavingsGoal.findOneAndUpdate(
        {
          _id: goal._id,
          userId: req.user.id,
          currentAmountCents: { $gte: amountCents }
        },
        { $inc: { currentAmountCents: -amountCents } },
        { new: true, runValidators: true }
      );

      if (!updated) {
        return badRequest(
          res,
          'Withdrawal amount is greater than the amount saved in this goal.'
        );
      }
    }

    // Keep the derived status in sync.
    if (updated.currentAmountCents >= updated.targetAmountCents) {
      if (updated.status !== 'completed') {
        updated.status = 'completed';
        await updated.save();
      }
    } else if (updated.status === 'completed') {
      updated.status = 'active';
      await updated.save();
    }

    const contribution = await SavingsContribution.create({
      userId: req.user.id,
      goalId: updated._id,
      walletId: wallet.value,
      type,
      amountCents,
      balanceAfterCents: updated.currentAmountCents,
      note
    });

    res.status(201).json({
      goal: withProgress(updated),
      contribution
    });
  } catch (error) {
    next(error);
  }
}
