// Smart Budget Alerts — pure threshold logic.
//
// This file holds only pure, dependency-free helpers (no database access) so
// the alert rules stay easy to reason about and re-use. The controller in
// ../controllers/budgetAlertsController.js combines these with the existing
// Category + Transaction data.
//
// Alert levels:
//   safe     -> below 75% of the budget
//   warning  -> 75% or more
//   critical -> 90% or more
//   limit    -> 100% reached (spent >= budget)
//   exceeded -> spending is above the budget (overspending)

export const THRESHOLDS = {
  warning: 75,
  critical: 90,
  limit: 100,
};

// Budget periods are keyed in UTC as "YYYY-MM" so monthly resets are exact and
// duplicate alerts can be prevented per (user, category, period, threshold).
export function currentPeriodKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function rupees(cents) {
  const value = Number(cents) || 0;
  return `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
}

// Which alert thresholds have been crossed for a given spend vs. limit.
export function triggeredThresholds(spentCents, limitCents) {
  const met = [];

  if (!(limitCents > 0)) return met;

  const percent = (spentCents / limitCents) * 100;

  if (percent >= THRESHOLDS.warning) met.push('warning');
  if (percent >= THRESHOLDS.critical) met.push('critical');
  if (spentCents >= limitCents) met.push('limit');
  if (spentCents > limitCents) met.push('exceeded');

  return met;
}

// The single, highest severity level currently in effect for a category.
export function levelFor(spentCents, limitCents) {
  if (!(limitCents > 0)) return 'safe';
  if (spentCents > limitCents) return 'exceeded';
  if (spentCents >= limitCents) return 'limit';

  const percent = (spentCents / limitCents) * 100;

  if (percent >= THRESHOLDS.critical) return 'critical';
  if (percent >= THRESHOLDS.warning) return 'warning';

  return 'safe';
}

// Human-readable message for a level/threshold key.
export function messageFor(level, { limitCents, overageCents }) {
  switch (level) {
    case 'exceeded':
      return `Overspending — ${rupees(overageCents)} over your ${rupees(limitCents)} budget.`;
    case 'limit':
      return 'Budget limit reached (100% used).';
    case 'critical':
      return 'Budget almost exhausted (90% used).';
    case 'warning':
      return 'Approaching budget limit (75% used).';
    default:
      return 'Spending is within budget.';
  }
}

// Build the full status object the frontend renders for one category.
export function evaluateCategoryBudget({
  categoryId,
  categoryName,
  categoryIcon,
  categoryColor,
  limitCents,
  spentCents,
  periodKey,
}) {
  const percent =
    limitCents > 0 ? Math.round((spentCents / limitCents) * 100) : 0;

  const remainingCents = limitCents - spentCents;
  const overageCents = Math.max(0, spentCents - limitCents);
  const level = levelFor(spentCents, limitCents);
  const triggered = triggeredThresholds(spentCents, limitCents);

  const context = { limitCents, spentCents, overageCents };

  return {
    categoryId: String(categoryId),
    categoryName,
    categoryIcon,
    categoryColor,
    periodKey,
    limitCents,
    spentCents,
    remainingCents,
    overageCents,
    percent,
    level,
    triggered,
    message: messageFor(level, context),
    messages: Object.fromEntries(
      triggered.map((threshold) => [threshold, messageFor(threshold, context)])
    ),
  };
}
