import Bill from '../models/Bill.js';
import { toCents } from '../utils/money.js';
import {
  BILL_FREQUENCIES,
  deriveBillState,
  nextDueDate,
  summarizeBills,
} from '../services/bills.js';

const FREQUENCIES = new Set(BILL_FREQUENCIES);

function toDateOrNull(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Attach the derived (overdue / due today / due soon) state to a bill.
function withState(bill, now) {
  const plain = bill.toObject ? bill.toObject() : bill;
  return { ...plain, ...deriveBillState(plain, now) };
}

function applyView(bills, view) {
  switch (view) {
    case 'pending':
      return bills.filter((b) => b.status === 'pending');
    case 'paid':
      return bills.filter((b) => b.status === 'paid');
    case 'overdue':
      return bills.filter((b) => b.isOverdue);
    case 'upcoming':
      return bills.filter((b) => b.status === 'pending' && !b.isOverdue);
    case 'dueToday':
      return bills.filter((b) => b.isDueToday);
    case 'reminders':
      return bills.filter((b) => b.reminderActive || b.isDueToday || b.isOverdue);
    default:
      return bills;
  }
}

// GET /api/bills
export async function listBills(req, res, next) {
  try {
    const now = new Date();
    const bills = await Bill.find({ userId: req.user.id }).sort({ dueDate: 1 });

    const enriched = bills.map((bill) => withState(bill, now));
    const view = String(req.query.view || 'all');
    const filtered = applyView(enriched, view);

    res.json({
      bills: filtered,
      allBills: enriched,
      summary: summarizeBills(enriched, now),
      view,
    });
  } catch (error) {
    next(error);
  }
}

// POST /api/bills
export async function createBill(req, res, next) {
  try {
    const { name, category = 'Other', amount, dueDate, reminderDate, frequency = 'none', notes = '' } = req.body;

    if (!name || !String(name).trim()) {
      return res.status(400).json({ message: 'Bill name is required.' });
    }

    const due = toDateOrNull(dueDate);
    if (!due) {
      return res.status(400).json({ message: 'A valid due date is required.' });
    }

    let amountCents;
    try {
      amountCents = toCents(amount);
    } catch (error) {
      return res.status(400).json({ message: 'Enter a valid bill amount.' });
    }

    if (!FREQUENCIES.has(frequency)) {
      return res.status(400).json({ message: 'Invalid recurring frequency.' });
    }

    const bill = await Bill.create({
      userId: req.user.id,
      name: String(name).trim(),
      category: String(category || 'Other').trim(),
      amountCents,
      dueDate: due,
      reminderDate: toDateOrNull(reminderDate),
      frequency,
      notes: String(notes || '').trim(),
      status: 'pending',
    });

    const now = new Date();
    res.status(201).json(withState(bill, now));
  } catch (error) {
    next(error);
  }
}

// PUT /api/bills/:id
export async function updateBill(req, res, next) {
  try {
    const updates = {};
    const body = req.body;

    if (body.name !== undefined) {
      if (!String(body.name).trim()) {
        return res.status(400).json({ message: 'Bill name is required.' });
      }
      updates.name = String(body.name).trim();
    }
    if (body.category !== undefined) updates.category = String(body.category || 'Other').trim();
    if (body.notes !== undefined) updates.notes = String(body.notes || '').trim();
    if (body.amount !== undefined) {
      try {
        updates.amountCents = toCents(body.amount);
      } catch (error) {
        return res.status(400).json({ message: 'Enter a valid bill amount.' });
      }
    }
    if (body.dueDate !== undefined) {
      const due = toDateOrNull(body.dueDate);
      if (!due) return res.status(400).json({ message: 'A valid due date is required.' });
      updates.dueDate = due;
    }
    if (body.reminderDate !== undefined) updates.reminderDate = toDateOrNull(body.reminderDate);
    if (body.frequency !== undefined) {
      if (!FREQUENCIES.has(body.frequency)) {
        return res.status(400).json({ message: 'Invalid recurring frequency.' });
      }
      updates.frequency = body.frequency;
    }

    const bill = await Bill.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      updates,
      { new: true, runValidators: true }
    );

    if (!bill) return res.status(404).json({ message: 'Bill not found.' });

    res.json(withState(bill, new Date()));
  } catch (error) {
    next(error);
  }
}

// PATCH /api/bills/:id/status  { status: 'paid' | 'pending' }
export async function setBillStatus(req, res, next) {
  try {
    const { status } = req.body;

    if (!['paid', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Status must be "paid" or "pending".' });
    }

    const bill = await Bill.findOne({ _id: req.params.id, userId: req.user.id });
    if (!bill) return res.status(404).json({ message: 'Bill not found.' });

    const now = new Date();

    if (status === 'pending') {
      bill.status = 'pending';
      bill.paidAt = null;
      await bill.save();
      return res.json({ bill: withState(bill, now), nextBill: null });
    }

    // Mark as paid.
    bill.status = 'paid';
    bill.paidAt = now;
    bill.lastPaidAt = now;
    await bill.save();

    // Recurring bills spawn the next occurrence so reminders keep working.
    let nextBill = null;
    const next = nextDueDate(bill.dueDate, bill.frequency);
    if (next) {
      nextBill = await Bill.create({
        userId: bill.userId,
        name: bill.name,
        category: bill.category,
        amountCents: bill.amountCents,
        dueDate: next,
        reminderDate: bill.reminderDate ? nextDueDate(bill.reminderDate, bill.frequency) : null,
        frequency: bill.frequency,
        notes: bill.notes,
        status: 'pending',
      });
    }

    res.json({
      bill: withState(bill, now),
      nextBill: nextBill ? withState(nextBill, now) : null,
    });
  } catch (error) {
    next(error);
  }
}

// DELETE /api/bills/:id
export async function deleteBill(req, res, next) {
  try {
    const bill = await Bill.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!bill) return res.status(404).json({ message: 'Bill not found.' });
    res.json({ message: 'Bill deleted.' });
  } catch (error) {
    next(error);
  }
}
