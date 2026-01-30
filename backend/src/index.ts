// backend/src/index.ts
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import prisma from './utils/prismaClient';
import logger from './logger';
import { pinoHttp } from 'pino-http';

// Load environment variables FIRST
dotenv.config();

// Import routes
import authRouter from './routes/authRoutes';
import productRouter from './routes/productRoutes';
import orderRouter from './routes/orderRoutes';
import userRouter from './routes/userRoutes';
import projectRouter from './routes/projectRoutes';
import adminRouter from './routes/adminRoutes';
import { paymentRouter } from './routes/paymentRoutes';
import videoRoutes from './routes/videoRoutes';

// YouTube Upload Setup
const { getAuthUrl, handleCallback } = require('./services/youtubeUploadService');

const app = express();

// ============================================
// GLOBAL ERROR HANDLERS (MUST BE FIRST!)
// ============================================

// Prevent process from crashing
process.on('uncaughtException', (error) => {
  logger.error({ error: error.message, stack: error.stack }, '❌ Uncaught exception');
  // Don't exit - just log
});

process.on('unhandledRejection', (reason: any, promise) => {
  logger.error({
    reason: reason?.message || reason,
    stack: reason?.stack
  }, '❌ Unhandled promise rejection');
  // Don't exit - just log
});

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

app.disable('x-powered-by');
app.set('trust proxy', 1);

// CORS Configuration
app.use((req, res, next) => {
  const origin = req.headers.origin || req.headers.referer || '*';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS, HEAD');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie, Set-Cookie');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, Set-Cookie');
  res.setHeader('Access-Control-Max-Age', '86400');
  
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

// Logging middleware
app.use(pinoHttp({
  logger,
  autoLogging: {
    ignore: (req) => req.url === '/health' || req.url === '/'
  }
}));

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ============================================
// HEALTH CHECK ENDPOINTS
// ============================================

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    message: 'MiniGuru API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    cors: 'enabled',
    env: process.env.NODE_ENV || 'development'
  });
});

// ============================================
// YOUTUBE OAUTH SETUP ROUTES
// ============================================

app.get('/setup-youtube', (req, res) => {
  try {
    const url = getAuthUrl();
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>YouTube OAuth Setup - MiniGuru</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 600px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 {
            color: #4285f4;
            margin-bottom: 10px;
          }
          p {
            color: #666;
            line-height: 1.6;
          }
          .warning {
            background: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
            border-radius: 4px;
          }
          .btn {
            display: inline-block;
            background: #4285f4;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 8px;
            margin-top: 20px;
            font-weight: 600;
            transition: all 0.3s ease;
          }
          .btn:hover {
            background: #357ae8;
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(66, 133, 244, 0.4);
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🎬 YouTube OAuth Setup</h1>
          <p>Click the button below to authorize MiniGuru to upload videos to your YouTube channel.</p>
         
          <div class="warning">
            <strong>⚠️ Important:</strong> Sign in with the Google account that owns your YouTube channel.
          </div>
         
          <a href="${url}" class="btn">🔐 Authorize YouTube Upload</a>
         
          <p style="margin-top: 30px; font-size: 14px; color: #999;">
            After authorization, you'll receive tokens to add to your .env file.
          </p>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logger.error({ error }, 'YouTube OAuth setup error');
    res.status(500).send('YouTube OAuth setup is not configured. Please check your environment variables.');
  }
});

app.get('/auth/youtube/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.status(400).send(`
      <h1>❌ Error</h1>
      <p>No authorization code received. Please try again.</p>
    `);
  }
  
  try {
    logger.info('Processing YouTube OAuth callback...');
    const tokens = await handleCallback(code as string);
    logger.info('YouTube OAuth tokens received successfully');
   
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Success! - MiniGuru</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 900px;
            margin: 50px auto;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
          }
          .container {
            background: white;
            padding: 40px;
            border-radius: 16px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
          }
          h1 { color: #0f9d58; }
          pre {
            background: #f5f5f5;
            padding: 20px;
            border-radius: 8px;
            overflow-x: auto;
            font-size: 13px;
            border: 2px solid #e0e0e0;
          }
          .copy-btn {
            background: #4285f4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Success!</h1>
          <p>YouTube authorization successful!</p>
          <h3>📋 Add this to your .env file:</h3>
          <pre id="tokens">YOUTUBE_TOKENS='${JSON.stringify(tokens)}'</pre>
          <button class="copy-btn" onclick="navigator.clipboard.writeText(document.getElementById('tokens').textContent)">
            📋 Copy to Clipboard
          </button>
        </div>
      </body>
      </html>
    `);
  } catch (error: any) {
    logger.error({ error: error.message }, 'YouTube OAuth error');
    res.status(500).send(`
      <h1>❌ Error</h1>
      <p>Failed to complete YouTube authorization.</p>
      <pre>${error.message}</pre>
    `);
  }
});

// ============================================
// API ROUTES
// ============================================

// Wrap routes in try-catch to prevent crashes
try {
  app.use('/auth', authRouter);
  app.use('/order', orderRouter);
  app.use('/products', productRouter);
  app.use('/me', userRouter);
  app.use('/project', projectRouter);
  app.use('/admin', adminRouter);
  app.use('/payment', paymentRouter);
  app.use('/api/videos', videoRoutes);
  
  logger.info('✅ All routes registered successfully');
} catch (error) {
  logger.error({ error }, '❌ Failed to register routes');
  // Don't exit - continue running
}

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============================================
// ERROR HANDLERS
// ============================================

// 404 handler
app.use((req, res) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    error: 'Not Found',
    message: `Cannot ${req.method} ${req.path}`,
    timestamp: new Date().toISOString()
  });
});

// Global error handler - MUST BE LAST
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error({
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method
  }, '❌ Request error');
  
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(isDevelopment && {
      stack: err.stack,
      details: err
    })
  });
});

// ============================================
// SERVER STARTUP
// ============================================

const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';

const server = app.listen(PORT, HOST, () => {
  logger.info(`🚀 Server running on ${HOST}:${PORT}`);
  logger.info(`🌐 CORS enabled for all origins (development mode)`);
  logger.info(`📡 Ready to accept requests`);
  logger.info(`📺 YouTube OAuth setup available at: /setup-youtube`);
});

// Keep server alive on errors
server.on('error', (error) => {
  logger.error({ error }, '❌ Server error');
  // Don't exit - just log
});

// ============================================
// GRACEFUL SHUTDOWN (Only on intentional signals)
// ============================================

const gracefulShutdown = async (signal: string) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      await prisma.$disconnect();
      logger.info('Database connection closed');
      process.exit(0);
    } catch (error) {
      logger.error({ error }, 'Error during shutdown');
      process.exit(1);
    }
  });
  
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

// Handle shutdown signals ONLY (not errors)
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export { app, prisma };