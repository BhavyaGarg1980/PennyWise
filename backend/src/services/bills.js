// Bill Reminders — pure helper logic (no database access).

export const BILL_CATEGORIES = [
  'Electricity',
  'Mobile',
  'Internet',
  'House Rent',
  'Water',
  'Credit Card',
  'Other',
];

export const BILL_FREQUENCIES = ['none', 'daily', 'weekly', 'monthly', 'yearly'];

const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDayUtc(date) {
  const d = new Date(date);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// Whole days from `now` until `dueDate` (negative when the date has passed).
export function daysUntilDue(dueDate, now = new Date()) {
  return Math.round((startOfDayUtc(dueDate) - startOfDayUtc(now)) / DAY_MS);
}

// Move a due date one interval forward. Returns null for one-off bills.
export function nextDueDate(dueDate, frequency) {
  const d = new Date(dueDate);
  switch (frequency) {
    case 'daily':
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case 'weekly':
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case 'monthly':
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case 'yearly':
      d.setUTCFullYear(d.getUTCFullYear() + 1);
      break;
    default:
      return null;
  }
  return d;
}

// Derive the display state for a bill from its due date and status.
export function deriveBillState(bill, now = new Date()) {
  const days = daysUntilDue(bill.dueDate, now);
  const paid = bill.status === 'paid';

  const isOverdue = !paid && days < 0;
  const isDueToday = !paid && days === 0;
  const isDueSoon = !paid && days > 0 && days <= 7;

  // Whether the user-set reminder date has arrived (or passed) and the bill is
  // still unpaid — the bill should surface as an active reminder.
  const reminderActive =
    !paid &&
    bill.reminderDate != null &&
    startOfDayUtc(bill.reminderDate) <= startOfDayUtc(now);

  let reminder;
  if (paid) reminder = 'Paid';
  else if (isOverdue)
    reminder = `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`;
  else if (isDueToday) reminder = 'Due today';
  else if (isDueSoon) reminder = `Due in ${days} day${days === 1 ? '' : 's'}`;
  else reminder = `Due in ${days} days`;

  return {
    daysUntilDue: days,
    isOverdue,
    isDueToday,
    isDueSoon,
    reminderActive,
    reminder,
  };
}

// Aggregate counts and totals for the dashboard / page summary.
export function summarizeBills(bills, now = new Date()) {
  const monthKey = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const currentMonth = monthKey(now);

  const summary = {
    totalBills: bills.length,
    pendingCount: 0,
    paidCount: 0,
    overdueCount: 0,
    dueTodayCount: 0,
    dueSoonCount: 0,
    totalPendingCents: 0,
    totalPaidCents: 0,
    month: { key: currentMonth, count: 0, totalCents: 0, paidCents: 0, pendingCents: 0 },
  };

  for (const bill of bills) {
    const state = deriveBillState(bill, now);

    if (bill.status === 'paid') {
      summary.paidCount += 1;
      summary.totalPaidCents += bill.amountCents;
    } else {
      summary.pendingCount += 1;
      summary.totalPendingCents += bill.amountCents;
    }

    if (state.isOverdue) summary.overdueCount += 1;
    if (state.isDueToday) summary.dueTodayCount += 1;
    if (state.isDueSoon) summary.dueSoonCount += 1;

    if (monthKey(new Date(bill.dueDate)) === currentMonth) {
      summary.month.count += 1;
      summary.month.totalCents += bill.amountCents;
      if (bill.status === 'paid') summary.month.paidCents += bill.amountCents;
      else summary.month.pendingCents += bill.amountCents;
    }
  }

  return summary;
}
