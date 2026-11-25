import mongoose from 'mongoose';
import Transaction from '../models/Transaction.js';
import Category from '../models/Category.js';
import User from '../models/User.js';
import { sendBudgetAlert } from './mailer.js';

function nextDate(date, recurrence) {
  const d = new Date(date);
  if (recurrence === 'daily') d.setUTCDate(d.getUTCDate() + 1);
  if (recurrence === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
  if (recurrence === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  if (recurrence === 'yearly') d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d;
}
export async function runScheduledTasks() {
  const now = new Date();
  const due = await Transaction.find({ isRecurring: true, recurrence: { $ne: null }, nextOccurrence: { $lte: now } });
  let created = 0;
  for (const original of due) {
    const occurrenceDate = new Date(original.nextOccurrence);
    const duplicate = await Transaction.findOne({ recurringKey: original.recurringKey, date: occurrenceDate, _id: { $ne: original._id } });
    if (!duplicate) {
      await Transaction.create({
        userId: original.userId, type: original.type, amountCents: original.amountCents,
        categoryId: original.categoryId, date: occurrenceDate, paymentMode: original.paymentMode,
        note: original.note, isRecurring: false, recurrence: null, recurringKey: original.recurringKey
      });
      created++;
    }
    original.nextOccurrence = nextDate(occurrenceDate, original.recurrence);
    await original.save();
  }

  const users = await User.find({}, { email: 1, name: 1 });
  let alerts = 0;
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  for (const user of users) {
    const budgets = await Category.find({ userId: user._id, budgetLimitCents: { $gt: 0 } });
    for (const category of budgets) {
      const [spent] = await Transaction.aggregate([
        { $match: { userId: user._id, categoryId: category._id, type: 'expense', date: { $gte: monthStart, $lt: monthEnd } } },
        { $group: { _id: null, total: { $sum: '$amountCents' } } }
      ]);
      if (spent && spent.total >= category.budgetLimitCents) {
        const sent = await sendBudgetAlert(user.email, user.name, category.name, spent.total, category.budgetLimitCents);
        if (sent) alerts++;
      }
    }
  }
  return { recurringTransactionsCreated: created, budgetAlertsSent: alerts };
}
