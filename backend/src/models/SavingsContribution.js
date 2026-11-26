import mongoose from 'mongoose';

/**
 * SavingsContribution
 * ------------------------------------------------------------------
 * An immutable ledger entry for money moved into (deposit) or out of
 * (withdrawal) a savings goal. It is NOT a fake income/expense
 * transaction, so it never appears in transaction reports and cannot be
 * double-counted. When a wallet is provided, the wallet balance is
 * adjusted by the savings aggregation in `routes/wallets.js`.
 * ------------------------------------------------------------------
 */
const savingsContributionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    goalId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'SavingsGoal',
      required: true,
      index: true
    },

    // Optional wallet the money was taken from / returned to.
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null
    },

    type: {
      type: String,
      enum: ['deposit', 'withdrawal'],
      required: true
    },

    amountCents: {
      type: Number,
      required: true,
      min: 1
    },

    // Snapshot of the goal balance after this entry (useful for history).
    balanceAfterCents: {
      type: Number,
      required: true,
      min: 0
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    },

    date: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

savingsContributionSchema.index({ userId: 1, goalId: 1, date: -1 });
savingsContributionSchema.index({ userId: 1, walletId: 1 });

export default mongoose.model(
  'SavingsContribution',
  savingsContributionSchema
);
