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
// import videoRouter from './routes/videoRoutes';
import userRouter from './routes/userRoutes';
import projectRouter from './routes/projectRoutes';
import adminRouter from './routes/adminRoutes';
import { paymentRouter } from './routes/paymentRoutes';

dotenv.config();
const app = express();

app.use(pinoHttp({ logger }));

app.use(cors());
app.use(express.json());

app.listen(process.env.PORT || 3000, () => {
    logger.info(`Server running on port ${process.env.PORT || 3000}`);
});

app.use('/auth', authRouter);
app.use('/order',orderRouter);
app.use('/products',productRouter);
app.use('/me',userRouter);
app.use('/project',projectRouter)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/admin',adminRouter)
app.use('/payment',paymentRouter)
export { app, prisma };
