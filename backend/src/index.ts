import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import morgan from 'morgan';

import authRouter from './routes/auth';
import costsRouter from './routes/costs';
import dashboardRouter from './routes/dashboard';
import analyticsRouter from './routes/analytics';
import aiRouter from './routes/ai';                 // ← NEW
import { errorHandler } from './middleware/error';

if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');

const app = express();

app.use(helmet());
app.use(compression());
app.use(cors({
  origin: (process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:4200']),
  credentials: true
}));
app.use(morgan('dev'));
app.use(express.json());

// API routes
app.use('/api/auth', authRouter);
app.use('/api/costs', costsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/ai', aiRouter);                       // ← NEW

// Health check for frontend
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    apiUrl: process.env.PUBLIC_API_URL ?? 'http://localhost:4000/api',
    checkedAt: new Date().toISOString(),
    message: 'Connected'
  });
});


// Global error handler
app.use(errorHandler);

const PORT = Number(process.env.PORT ?? 4001);
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));


