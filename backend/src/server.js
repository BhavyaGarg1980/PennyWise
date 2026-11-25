import 'dotenv/config';
import dotenv from "dotenv";
dotenv.config();
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import mongoose from 'mongoose';
import cookieParser from 'cookie-parser';
import walletRoutes from './routes/wallets.js';
import authRoutes from './routes/auth.js';
import categoryRoutes from './routes/categories.js';
import transactionRoutes from './routes/transactions.js';
import budgetRoutes from './routes/budgets.js';
import reportRoutes from './routes/reports.js';

import { runScheduledTasks } from './jobs/tasks.js';

const app = express();

const allowedOrigins = (
  process.env.CLIENT_ORIGIN || 'http://localhost:5173'
)
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

// CORS must allow credentials for HTTP-only authentication cookies.
app.use(cors({
  origin: allowedOrigins,
  credentials: true,
}));

// Parse request bodies and cookies BEFORE registering routes.
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

// Health-check endpoint.
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

// Authentication routes.
app.use(
  '/api/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
  }),
  authRoutes
);

// Application routes.
app.use('/api/categories', categoryRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/wallets', walletRoutes);

// Scheduled jobs endpoint.
app.post('/api/jobs/run', async (req, res) => {
  if (
    !process.env.CRON_SECRET ||
    req.get('x-cron-secret') !== process.env.CRON_SECRET
  ) {
    return res.status(401).json({
      message: 'Unauthorized cron request',
    });
  }

  try {
    const result = await runScheduledTasks();

    return res.json({
      message: 'Scheduled tasks completed',
      result,
    });
  } catch (error) {
    console.error('Scheduled task failed:', error);

    return res.status(500).json({
      message: 'Scheduled task failed',
    });
  }
});

// Central error handler.
app.use((err, _req, res, _next) => {
  console.error(err);

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

const port = process.env.PORT || 5000;

if (!process.env.MONGO_URI) {
  console.error('MONGO_URI is missing from your .env file.');
  process.exit(1);
}

if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is missing from your .env file.');
  process.exit(1);
}

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('MongoDB connected successfully.');

    app.listen(port, () => {
      console.log(`API listening on port ${port}`);
    });
  })
  .catch(error => {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  });