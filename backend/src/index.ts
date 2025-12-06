import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import prisma from './utils/prismaClient';

import logger from './logger';
import { pinoHttp } from 'pino-http';

import authRouter from './routes/authRoutes';
import productRouter from './routes/productRoutes';
import orderRouter from './routes/orderRoutes';
import userRouter from './routes/userRoutes';
import projectRouter from './routes/projectRoutes';
import adminRouter from './routes/adminRoutes';
import { paymentRouter } from './routes/paymentRoutes';

dotenv.config();

const app = express();

// ✅ DISABLE X-Powered-By header
app.disable('x-powered-by');

// ✅ CRITICAL: Trust proxy (required for GitHub Codespaces)
app.set('trust proxy', 1);

// ✅ NUCLEAR CORS FIX: This MUST be the absolute first middleware
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '*';
  
  // Log all requests
  logger.info(`${req.method} ${req.path} from ${origin}`);
  
  // Set CORS headers for ALL requests
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie, Set-Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, Set-Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  // Handle preflight immediately
  if (req.method === 'OPTIONS') {
    logger.info(`✅ CORS Preflight handled for ${req.path}`);
    return res.status(200).end();
  }
  
  next();
});

// Logging middleware
app.use(pinoHttp({ logger }));

// Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoints
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MiniGuru API is running',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MiniGuru API is running',
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    env: process.env.NODE_ENV
  });
});

// API Routes
app.use('/auth', authRouter);
app.use('/order', orderRouter);
app.use('/products', productRouter);
app.use('/me', userRouter);
app.use('/project', projectRouter);
app.use('/admin', adminRouter);
app.use('/payment', paymentRouter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`
  });
});

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error(err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`🌐 CORS enabled for all origins (development mode)`);
  logger.info(`📡 Ready to accept requests`);
});

export { app, prisma };