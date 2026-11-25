import { Router } from 'express';
import mongoose from 'mongoose';
import { stringify } from 'csv-stringify/sync';
import Transaction from '../models/Transaction.js';
import auth from '../middleware/auth.js';
const router = Router();
router.use(auth);
const uid = req => new mongoose.Types.ObjectId(req.user.id);
function monthRange(value) {
  const [y, m] = String(value || new Date().toISOString().slice(0, 7)).split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) throw Object.assign(new Error('month must use YYYY-MM'), { status: 400 });
  return { from: new Date(Date.UTC(y, m - 1, 1)), to: new Date(Date.UTC(y, m, 1)) };
}
router.get('/summary', async (req, res, next) => {
  try {
    const { from, to } = monthRange(req.query.month);
    const [rows] = await Transaction.aggregate([
      { $match: { userId: uid(req), date: { $gte: from, $lt: to } } },
      { $group: { _id: '$type', totalCents: { $sum: '$amountCents' }, count: { $sum: 1 } } },
      { $group: { _id: null, totals: { $push: { type: '$_id', totalCents: '$totalCents', count: '$count' } } } },
      { $project: { _id: 0, totals: 1 } }
    ]);
    const totals = rows?.totals || [];
    const incomeCents = totals.find(x => x.type === 'income')?.totalCents || 0;
    const expenseCents = totals.find(x => x.type === 'expense')?.totalCents || 0;
    res.json({ month: req.query.month || new Date().toISOString().slice(0, 7), incomeCents, expenseCents, balanceCents: incomeCents - expenseCents, savingsRate: incomeCents ? Math.round(((incomeCents - expenseCents) / incomeCents) * 10000) / 100 : 0, transactionCount: totals.reduce((n, x) => n + x.count, 0) });
  } catch (e) { next(e); }
});
router.get('/by-category', async (req, res, next) => {
  try {
    const { from, to } = req.query.from && req.query.to ? { from: new Date(req.query.from), to: new Date(req.query.to) } : monthRange(req.query.month);
    const data = await Transaction.aggregate([
      { $match: { userId: uid(req), type: 'expense', date: { $gte: from, $lt: to } } },
      { $group: { _id: '$categoryId', totalCents: { $sum: '$amountCents' } } },
      { $lookup: { from: 'categories', localField: '_id', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, categoryId: '$_id', name: { $ifNull: ['$category.name', 'Uncategorized'] }, color: '$category.color', totalCents: 1 } },
      { $sort: { totalCents: -1 } }
    ]);
    res.json(data);
  } catch (e) { next(e); }
});
router.get('/monthly-trend', async (req, res, next) => {
  try {
    const year = Number(req.query.year) || new Date().getUTCFullYear();
    const from = new Date(Date.UTC(year, 0, 1)), to = new Date(Date.UTC(year + 1, 0, 1));
    const data = await Transaction.aggregate([
      { $match: { userId: uid(req), date: { $gte: from, $lt: to } } },
      { $group: { _id: { month: { $month: '$date' }, type: '$type' }, totalCents: { $sum: '$amountCents' } } },
      { $project: { _id: 0, month: '$_id.month', type: '$_id.type', totalCents: 1 } },
      { $sort: { month: 1 } }
    ]);
    const result = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, incomeCents: 0, expenseCents: 0 }));
    data.forEach(r => { if (r.type === 'income') result[r.month - 1].incomeCents = r.totalCents; else result[r.month - 1].expenseCents = r.totalCents; });
    res.json(result);
  } catch (e) { next(e); }
});
router.get('/export', async (req, res, next) => {
  try {
    const { from, to } = req.query.from && req.query.to ? { from: new Date(req.query.from), to: new Date(req.query.to) } : monthRange(req.query.month);
    const rows = await Transaction.aggregate([
      { $match: { userId: uid(req), date: { $gte: from, $lt: to } } },
      { $lookup: { from: 'categories', localField: 'categoryId', foreignField: '_id', as: 'category' } },
      { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
      { $project: { _id: 0, date: 1, type: 1, amount: { $divide: ['$amountCents', 100] }, category: { $ifNull: ['$category.name', 'Uncategorized'] }, paymentMode: 1, note: 1 } },
      { $sort: { date: -1 } }
    ]);
    const csv = stringify(rows, { header: true, columns: ['date', 'type', 'amount', 'category', 'paymentMode', 'note'] });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="finance-report-${req.query.month || 'custom'}.csv"`);
    res.send(csv);
  } catch (e) { next(e); }
});
export default router;
