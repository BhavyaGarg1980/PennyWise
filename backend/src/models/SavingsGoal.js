import mongoose from 'mongoose';

/**
 * SavingsGoal
 * ------------------------------------------------------------------
 * A savings target (e.g. "Buy a Laptop" with a ₹80,000 target). The
 * `currentAmountCents` field is only ever mutated through atomic updates
 * in the savings controller, so the goal balance stays consistent with
 * the SavingsContribution ledger.
 * ------------------------------------------------------------------
 */
const savingsGoalSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100
    },

    targetAmountCents: {
      type: Number,
      required: true,
      min: 1
    },

    currentAmountCents: {
      type: Number,
      default: 0,
      min: 0
    },

    targetDate: {
      type: Date,
      default: null
    },

    description: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    },

    status: {
      type: String,
      enum: ['active', 'completed', 'archived'],
      default: 'active'
    }
  },
  { timestamps: true }
);

savingsGoalSchema.index({ userId: 1, status: 1 });
savingsGoalSchema.index({ userId: 1, targetDate: 1 });

export default mongoose.model('SavingsGoal', savingsGoalSchema);
