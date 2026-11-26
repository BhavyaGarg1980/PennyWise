import mongoose from 'mongoose';

/**
 * RecurringTransaction
 * ------------------------------------------------------------------
 * A reusable "template" for income/expense transactions that repeat on
 * a schedule. It is intentionally a SEPARATE collection from the normal
 * `Transaction` collection, so the existing transaction system stays
 * untouched. When an occurrence becomes due, the recurring job creates a
 * NORMAL `Transaction` document (reusing the existing transaction model).
 * ------------------------------------------------------------------
 */
const recurringTransactionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120
    },

    amountCents: {
      type: Number,
      required: true,
      min: 1
    },

    type: {
      type: String,
      enum: ['income', 'expense'],
      required: true
    },

    categoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true
    },

    // Optional wallet the generated transactions should be linked to.
    walletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      default: null
    },

    frequency: {
      type: String,
      enum: ['daily', 'weekly', 'monthly'],
      required: true
    },

    startDate: {
      type: Date,
      required: true
    },

    // Date of the next occurrence that still has to be generated.
    // `null` means the schedule has ended (or was never started).
    nextDueDate: {
      type: Date,
      default: null
    },

    // Optional end date. No occurrence is generated after this date.
    endDate: {
      type: Date,
      default: null
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    },

    status: {
      type: String,
      enum: ['active', 'paused'],
      default: 'active'
    }
  },
  { timestamps: true }
);

recurringTransactionSchema.index({ userId: 1, nextDueDate: 1 });
recurringTransactionSchema.index({ userId: 1, status: 1 });
recurringTransactionSchema.index({ status: 1, nextDueDate: 1 });

export default mongoose.model(
  'RecurringTransaction',
  recurringTransactionSchema
);
