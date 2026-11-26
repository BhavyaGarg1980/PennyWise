import mongoose from 'mongoose';

// Bill Reminders — one document per bill for a user.
//
// `status` only ever stores 'pending' or 'paid'. The transient states the UI
// shows (overdue, due today, due soon) are derived from `dueDate` at read time
// so they always stay correct without any background job.
const billSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    category: { type: String, default: 'Other', trim: true },
    amountCents: { type: Number, required: true, min: 1 },
    dueDate: { type: Date, required: true, index: true },
    reminderDate: { type: Date, default: null },
    frequency: {
      type: String,
      enum: ['none', 'daily', 'weekly', 'monthly', 'yearly'],
      default: 'none',
    },
    status: {
      type: String,
      enum: ['pending', 'paid'],
      default: 'pending',
    },
    notes: { type: String, trim: true, maxlength: 300, default: '' },
    paidAt: { type: Date, default: null },
    lastPaidAt: { type: Date, default: null },
  },
  { timestamps: true }
);

billSchema.index({ userId: 1, dueDate: 1 });
billSchema.index({ userId: 1, status: 1 });

export default mongoose.model('Bill', billSchema);
