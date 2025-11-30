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

app.use(pinoHttp({ logger }));

// CORS for localhost
app.use(cors({
  origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'MiniGuru API is running',
    timestamp: new Date().toISOString()
  });
});

app.use('/auth', authRouter);
app.use('/order', orderRouter);
app.use('/products', productRouter);
app.use('/me', userRouter);
app.use('/project', projectRouter);
app.use('/admin', adminRouter);
app.use('/payment', paymentRouter);

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use((req, res) => {
  res.status(404).json({ 
    error: 'Not Found', 
    message: `Cannot ${req.method} ${req.path}`
  });
});

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  logger.info(`Server running on ${HOST}:${PORT}`);
});

export { app, prisma };
