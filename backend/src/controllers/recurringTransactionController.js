import mongoose from 'mongoose';
import RecurringTransaction from '../models/RecurringTransaction.js';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import Wallet from '../models/Wallet.js';
import { toCents } from '../utils/money.js';
import { processDueRecurringTransactions } from '../jobs/recurringTransactionJob.js';

const FREQUENCIES = ['daily', 'weekly', 'monthly'];
const TYPES = ['income', 'expense'];
const STATUSES = ['active', 'paused'];

function badRequest(res, message) {
  return res.status(400).json({ message });
}

function parseDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

async function resolveCategory(userId, categoryId) {
  if (!mongoose.isValidObjectId(categoryId)) return null;
  return Category.findOne({ _id: categoryId, userId });
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

// GET /api/recurring-transactions
export async function list(req, res, next) {
  try {
    const filter = { userId: req.user.id };
    if (STATUSES.includes(req.query.status)) {
      filter.status = req.query.status;
    }

    const items = await RecurringTransaction.find(filter)
      .populate('categoryId', 'name icon color')
      .populate('walletId', 'name type')
      .sort({ createdAt: -1 });

    res.json(items);
  } catch (error) {
    next(error);
  }
}

// POST /api/recurring-transactions
export async function create(req, res, next) {
  try {
    const {
      title,
      amount,
      type,
      categoryId,
      walletId,
      frequency,
      startDate,
      endDate,
      note = '',
      status = 'active'
    } = req.body;

    if (!title || !String(title).trim()) {
      return badRequest(res, 'A title is required.');
    }
    if (!TYPES.includes(type)) {
      return badRequest(res, 'Type must be income or expense.');
    }
    if (!FREQUENCIES.includes(frequency)) {
      return badRequest(res, 'Frequency must be daily, weekly or monthly.');
    }

    const category = await resolveCategory(req.user.id, categoryId);
    if (!category) {
      return badRequest(res, 'Please choose a valid category.');
    }

    const wallet = await resolveWallet(req.user.id, walletId);
    if (!wallet.ok) {
      return badRequest(res, 'The selected wallet is invalid.');
    }

    const startDateValue = parseDate(startDate);
    if (!startDateValue) {
      return badRequest(res, 'A valid start date is required.');
    }

    let endDateValue = null;
    if (endDate) {
      endDateValue = parseDate(endDate);
      if (!endDateValue) {
        return badRequest(res, 'The end date is invalid.');
      }
      if (endDateValue < startDateValue) {
        return badRequest(res, 'The end date cannot be before the start date.');
      }
    }

    let amountCents;
    try {
      amountCents = toCents(amount);
    } catch (error) {
      return badRequest(res, error.message);
    }

    const recurring = await RecurringTransaction.create({
      userId: req.user.id,
      title: String(title).trim(),
      amountCents,
      type,
      categoryId: category._id,
      walletId: wallet.value,
      frequency,
      startDate: startDateValue,
      nextDueDate: startDateValue,
      endDate: endDateValue,
      note: String(note || '').trim(),
      status: STATUSES.includes(status) ? status : 'active'
    });

    const populated = await recurring.populate([
      { path: 'categoryId', select: 'name icon color' },
      { path: 'walletId', select: 'name type' }
    ]);

    res.status(201).json(populated);
  } catch (error) {
    next(error);
  }
}

// PUT /api/recurring-transactions/:id
export async function update(req, res, next) {
  try {
    const recurring = await RecurringTransaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!recurring) {
      return res.status(404).json({ message: 'Recurring transaction not found.' });
    }

    if (req.body.title !== undefined) {
      if (!String(req.body.title).trim()) {
        return badRequest(res, 'A title is required.');
      }
      recurring.title = String(req.body.title).trim();
    }

    if (req.body.type !== undefined) {
      if (!TYPES.includes(req.body.type)) {
        return badRequest(res, 'Type must be income or expense.');
      }
      recurring.type = req.body.type;
    }

    if (req.body.frequency !== undefined) {
      if (!FREQUENCIES.includes(req.body.frequency)) {
        return badRequest(res, 'Frequency must be daily, weekly or monthly.');
      }
      recurring.frequency = req.body.frequency;
    }

    if (req.body.amount !== undefined) {
      try {
        recurring.amountCents = toCents(req.body.amount);
      } catch (error) {
        return badRequest(res, error.message);
      }
    }

    if (req.body.categoryId !== undefined) {
      const category = await resolveCategory(req.user.id, req.body.categoryId);
      if (!category) {
        return badRequest(res, 'Please choose a valid category.');
      }
      recurring.categoryId = category._id;
    }

    if (req.body.walletId !== undefined) {
      const wallet = await resolveWallet(req.user.id, req.body.walletId);
      if (!wallet.ok) {
        return badRequest(res, 'The selected wallet is invalid.');
      }
      recurring.walletId = wallet.value;
    }

    if (req.body.startDate !== undefined) {
      const startDateValue = parseDate(req.body.startDate);
      if (!startDateValue) {
        return badRequest(res, 'A valid start date is required.');
      }
      recurring.startDate = startDateValue;
      // Restart the schedule from the new start date. Duplicate occurrences
      // are prevented by the idempotency index.
      recurring.nextDueDate = startDateValue;
    }

    if (req.body.endDate !== undefined) {
      if (!req.body.endDate) {
        recurring.endDate = null;
      } else {
        const endDateValue = parseDate(req.body.endDate);
        if (!endDateValue) {
          return badRequest(res, 'The end date is invalid.');
        }
        recurring.endDate = endDateValue;
      }
    }

    if (recurring.endDate && recurring.endDate < recurring.startDate) {
      return badRequest(res, 'The end date cannot be before the start date.');
    }

    if (req.body.note !== undefined) {
      recurring.note = String(req.body.note || '').trim();
    }

    if (req.body.status !== undefined) {
      if (!STATUSES.includes(req.body.status)) {
        return badRequest(res, 'Status must be active or paused.');
      }
      recurring.status = req.body.status;
    }

    await recurring.save();

    const populated = await recurring.populate([
      { path: 'categoryId', select: 'name icon color' },
      { path: 'walletId', select: 'name type' }
    ]);

    res.json(populated);
  } catch (error) {
    next(error);
  }
}

// PATCH /api/recurring-transactions/:id/status
export async function updateStatus(req, res, next) {
  try {
    const { status } = req.body;
    if (!STATUSES.includes(status)) {
      return badRequest(res, 'Status must be active or paused.');
    }

    const recurring = await RecurringTransaction.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { status } },
      { new: true, runValidators: true }
    )
      .populate('categoryId', 'name icon color')
      .populate('walletId', 'name type');

    if (!recurring) {
      return res.status(404).json({ message: 'Recurring transaction not found.' });
    }

    res.json(recurring);
  } catch (error) {
    next(error);
  }
}

// DELETE /api/recurring-transactions/:id
export async function remove(req, res, next) {
  try {
    const recurring = await RecurringTransaction.findOneAndDelete({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!recurring) {
      return res.status(404).json({ message: 'Recurring transaction not found.' });
    }

    // Generated transactions are intentionally kept (they are normal
    // transactions and remain part of the user's history / reports).
    res.json({ message: 'Recurring transaction deleted.' });
  } catch (error) {
    next(error);
  }
}

// GET /api/recurring-transactions/:id/history
export async function history(req, res, next) {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return badRequest(res, 'Invalid recurring transaction id.');
    }

    const recurring = await RecurringTransaction.findOne({
      _id: req.params.id,
      userId: req.user.id
    });

    if (!recurring) {
      return res.status(404).json({ message: 'Recurring transaction not found.' });
    }

    const items = await Transaction.find({
      userId: req.user.id,
      recurringSourceId: recurring._id
    })
      .populate('categoryId', 'name icon color')
      .sort({ date: -1, _id: -1 })
      .limit(100);

    res.json(items);
  } catch (error) {
    next(error);
  }
}

// POST /api/recurring-transactions/run-due
// Manual trigger (useful for testing / on-demand processing for a user).
export async function runDue(req, res, next) {
  try {
    const result = await processDueRecurringTransactions({
      userId: req.user.id
    });
    res.json({ message: 'Due recurring transactions processed.', result });
  } catch (error) {
    next(error);
  }
}
