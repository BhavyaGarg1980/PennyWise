import mongoose from 'mongoose';

// Persisted Smart Budget Alert record.
//
// One document is stored per (user, category, budget period, threshold). The
// compound unique index below provides database-level idempotency, so the same
// threshold can never be recorded twice for the same budget period — this is
// what prevents duplicate alerts.
const budgetAlertSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    // UTC budget period, e.g. "2026-11".
    periodKey: { type: String, required: true },
    threshold: {
      type: String,
      required: true,
      enum: ['warning', 'critical', 'limit', 'exceeded'],
    },
    percentUsed: { type: Number, required: true, default: 0 },
    spentCents: { type: Number, required: true, default: 0 },
    limitCents: { type: Number, required: true, default: 0 },
    overageCents: { type: Number, default: 0 },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

budgetAlertSchema.index(
  { userId: 1, categoryId: 1, periodKey: 1, threshold: 1 },
  { unique: true }
);

budgetAlertSchema.index({ userId: 1, periodKey: 1, createdAt: -1 });

export default mongoose.model('BudgetAlert', budgetAlertSchema);
