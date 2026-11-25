import mongoose from 'mongoose';
const categorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  icon: { type: String, default: '📌' },
  color: { type: String, default: '#64748b' },
  budgetLimitCents: { type: Number, default: 0, min: 0 }
}, { timestamps: true });
categorySchema.index({ userId: 1, name: 1 }, { unique: true });
export default mongoose.model('Category', categorySchema);
