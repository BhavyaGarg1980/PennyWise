import mongoose from 'mongoose';
const transactionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, enum: ['income', 'expense'], required: true },
  amountCents: { type: Number, required: true, min: 1 },
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  date: { type: Date, required: true, index: true },
  paymentMode: { type: String, default: 'Other', enum: ['Cash', 'Card', 'UPI', 'Bank Transfer', 'Other'] },
  note: { type: String, trim: true, maxlength: 300, default: '' },
  isRecurring: { type: Boolean, default: false },
  recurrence: { type: String, enum: ['daily', 'weekly', 'monthly', 'yearly', null], default: null },
  recurringKey: { type: String, default: null },
  walletId: {
  type: mongoose.Schema.Types.ObjectId,
  ref: 'Wallet',
  default: null,
  index: true
},
  nextOccurrence: { type: Date, default: null }
}, { timestamps: true });
transactionSchema.index({ userId: 1, date: -1 });
transactionSchema.index({ userId: 1, type: 1, date: -1 });
transactionSchema.index({ recurringKey: 1, date: 1 }, { sparse: true });
export default mongoose.model('Transaction', transactionSchema);
