import mongoose from 'mongoose';

const walletTransferSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },

    fromWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true
    },

    toWalletId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Wallet',
      required: true
    },

    amountCents: {
      type: Number,
      required: true,
      min: 1
    },

    date: {
      type: Date,
      default: Date.now
    },

    note: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ''
    }
  },
  {
    timestamps: true
  }
);

walletTransferSchema.index({
  userId: 1,
  date: -1
});

export default mongoose.model(
  'WalletTransfer',
  walletTransferSchema
);