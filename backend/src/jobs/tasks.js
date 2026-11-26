import Transaction from '../models/Transaction.js';

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

  return { recurringTransactionsCreated: created };
}
