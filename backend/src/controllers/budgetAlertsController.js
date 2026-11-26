import mongoose from 'mongoose';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import BudgetAlert from '../models/BudgetAlert.js';
import {
  currentPeriodKey,
  evaluateCategoryBudget,
} from '../services/budgetAlerts.js';

// Recompute live budget usage for the current UTC month, mirroring the
// existing GET /api/budgets aggregation so both stay consistent.
async function computeStatuses(userId) {
  const now = new Date();
  const from = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  const periodKey = currentPeriodKey(now);

  const categories = await Category.find({ userId }).sort({ name: 1 });

  const spend = await Transaction.aggregate([
    {
      $match: {
        userId: new mongoose.Types.ObjectId(userId),
        type: 'expense',
        date: { $gte: from, $lt: to },
      },
    },
    { $group: { _id: '$categoryId', spentCents: { $sum: '$amountCents' } } },
  ]);

  const spentMap = new Map(
    spend.map((row) => [String(row._id), row.spentCents])
  );

  const statuses = categories
    .filter((category) => Number(category.budgetLimitCents) > 0)
    .map((category) =>
      evaluateCategoryBudget({
        categoryId: category._id,
        categoryName: category.name,
        categoryIcon: category.icon,
        categoryColor: category.color,
        limitCents: Number(category.budgetLimitCents),
        spentCents: spentMap.get(String(category._id)) || 0,
        periodKey,
      })
    );

  return { periodKey, statuses };
}

function summarize(statuses) {
  const counts = { safe: 0, warning: 0, critical: 0, limit: 0, exceeded: 0 };

  let totalLimitCents = 0;
  let totalSpentCents = 0;

  for (const status of statuses) {
    counts[status.level] += 1;
    totalLimitCents += status.limitCents;
    totalSpentCents += status.spentCents;
  }

  return {
    tracked: statuses.length,
    totalLimitCents,
    totalSpentCents,
    totalRemainingCents: totalLimitCents - totalSpentCents,
    counts,
    alertCount:
      counts.warning + counts.critical + counts.limit + counts.exceeded,
  };
}

// Store any newly-crossed thresholds. Idempotent: the unique index + upsert
// guarantee each threshold is recorded at most once per category per period.
async function recordNewAlerts(userId, statuses) {
  let created = 0;

  for (const status of statuses) {
    for (const threshold of status.triggered) {
      const result = await BudgetAlert.updateOne(
        {
          userId,
          categoryId: status.categoryId,
          periodKey: status.periodKey,
          threshold,
        },
        {
          $setOnInsert: {
            userId,
            categoryId: status.categoryId,
            periodKey: status.periodKey,
            threshold,
            percentUsed: status.percent,
            spentCents: status.spentCents,
            limitCents: status.limitCents,
            overageCents: status.overageCents,
            message: status.messages[threshold],
          },
        },
        { upsert: true }
      );

      if (result.upsertedCount > 0) {
        created += 1;
      }
    }
  }

  return created;
}

async function loadStoredAlerts(userId, periodKey) {
  return BudgetAlert.find({ userId, periodKey })
    .sort({ createdAt: -1 })
    .populate('categoryId', 'name icon color')
    .lean();
}

// GET /api/budget-alerts — read-only view of the current period.
export async function getBudgetAlerts(req, res, next) {
  try {
    const { periodKey, statuses } = await computeStatuses(req.user.id);
    const alerts = await loadStoredAlerts(req.user.id, periodKey);

    res.json({
      periodKey,
      statuses,
      summary: summarize(statuses),
      alerts,
    });
  } catch (error) {
    next(error);
  }
}

// Recompute a user's budget usage and persist any newly-crossed thresholds.
// Reusable from both the HTTP handler and the transaction CRUD hooks.
export async function syncUserBudgetAlerts(userId) {
  const { periodKey, statuses } = await computeStatuses(userId);
  const newAlertCount = await recordNewAlerts(userId, statuses);
  const alerts = await loadStoredAlerts(userId, periodKey);

  return {
    periodKey,
    statuses,
    summary: summarize(statuses),
    alerts,
    newAlertCount,
  };
}

// POST /api/budget-alerts/sync — recompute usage and persist newly-crossed
// alerts. Called after transactions change so alerts stay up to date.
export async function syncBudgetAlerts(req, res, next) {
  try {
    res.json(await syncUserBudgetAlerts(req.user.id));
  } catch (error) {
    next(error);
  }
}
