import { Router } from 'express';
import mongoose from 'mongoose';

import Wallet from '../models/Wallet.js';
import WalletTransfer from '../models/WalletTransfer.js';
import Transaction from '../models/Transaction.js';

import auth from '../middleware/auth.js';
import { toCents } from '../utils/money.js';

const router = Router();

router.use(auth);

// GET ALL WALLETS
router.get('/', async (req, res, next) => {
  try {
    const userId = new mongoose.Types.ObjectId(req.user.id);

    const wallets = await Wallet.find({
      userId
    }).sort({ createdAt: 1 });

    const walletIds = wallets.map(wallet => wallet._id);

    const [transactionTotals, transferTotals] =
      await Promise.all([
        Transaction.aggregate([
          {
            $match: {
              userId,
              walletId: { $in: walletIds }
            }
          },
          {
            $group: {
              _id: {
                walletId: '$walletId',
                type: '$type'
              },
              totalCents: {
                $sum: '$amountCents'
              }
            }
          }
        ]),

        WalletTransfer.aggregate([
          {
            $match: {
              userId,
              $or: [
                { fromWalletId: { $in: walletIds } },
                { toWalletId: { $in: walletIds } }
              ]
            }
          },
          {
            $project: {
              fromWalletId: 1,
              toWalletId: 1,
              amountCents: 1
            }
          },
          {
            $facet: {
              outgoing: [
                {
                  $group: {
                    _id: '$fromWalletId',
                    totalCents: {
                      $sum: '$amountCents'
                    }
                  }
                }
              ],
              incoming: [
                {
                  $group: {
                    _id: '$toWalletId',
                    totalCents: {
                      $sum: '$amountCents'
                    }
                  }
                }
              ]
            }
          }
        ])
      ]);

    const totals = new Map();

    for (const wallet of wallets) {
      totals.set(String(wallet._id), {
        income: 0,
        expense: 0,
        incoming: 0,
        outgoing: 0
      });
    }

    for (const item of transactionTotals) {
      const wallet = totals.get(String(item._id.walletId));

      if (wallet) {
        wallet[item._id.type] = item.totalCents;
      }
    }

    const transfers = transferTotals[0] || {
      incoming: [],
      outgoing: []
    };

    for (const item of transfers.incoming) {
      const wallet = totals.get(String(item._id));
      if (wallet) wallet.incoming = item.totalCents;
    }

    for (const item of transfers.outgoing) {
      const wallet = totals.get(String(item._id));
      if (wallet) wallet.outgoing = item.totalCents;
    }

    const result = wallets.map(wallet => {
      const data = totals.get(String(wallet._id));

      const balanceCents =
        wallet.openingBalanceCents +
        data.income -
        data.expense +
        data.incoming -
        data.outgoing;

      return {
        ...wallet.toObject(),
        balanceCents
      };
    });

    res.json(result);

  } catch (error) {
    next(error);
  }
});


// CREATE WALLET
router.post('/', async (req, res, next) => {
  try {
    const { name, type, openingBalance = 0 } = req.body;

    if (!name?.trim()) {
      return res.status(400).json({
        message: 'Wallet name is required.'
      });
    }

    if (!['cash', 'bank', 'digital'].includes(type)) {
      return res.status(400).json({
        message: 'Invalid wallet type.'
      });
    }

    const balance = Number(openingBalance);

    if (!Number.isFinite(balance) || balance < 0) {
      return res.status(400).json({
        message: 'Enter a valid opening balance.'
      });
    }

    const wallet = await Wallet.create({
      userId: req.user.id,
      name: name.trim(),
      type,
      openingBalanceCents: Math.round(balance * 100)
    });

    res.status(201).json({
      ...wallet.toObject(),
      balanceCents: wallet.openingBalanceCents
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: 'A wallet with this name already exists.'
      });
    }

    next(error);
  }
});

export default router;