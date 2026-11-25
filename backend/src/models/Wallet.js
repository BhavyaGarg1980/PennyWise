import mongoose from 'mongoose';

const walletSchema = new mongoose.Schema(
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
      maxlength: 60
    },

    type: {
      type: String,
      enum: ['cash', 'bank', 'digital'],
      required: true
    },

    openingBalanceCents: {
      type: Number,
      default: 0,
      min: 0
    }
  },
  {
    timestamps: true
  }
);

walletSchema.index(
  { userId: 1, name: 1 },
  { unique: true }
);

export default mongoose.model('Wallet', walletSchema);