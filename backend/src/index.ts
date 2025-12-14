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
import videoRoutes from './routes/videoRoutes';

// YouTube Upload Setup
const { getAuthUrl, handleCallback } = require('./services/youtubeUploadService');

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

// ============================================
// YouTube OAuth Setup Routes (ONE-TIME USE)
// Remove these after getting tokens for security
// ============================================
app.get('/setup-youtube', (req, res) => {
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
          <strong>⚠️ Important:</strong> Sign in with the Google account that owns the <strong>@MiniGuru.innovation</strong> YouTube channel.
        </div>
        
        <a href="${url}" class="btn">🔐 Authorize YouTube Upload</a>
        
        <p style="margin-top: 30px; font-size: 14px; color: #999;">
          After authorization, you'll receive tokens to add to your .env file.
        </p>
      </div>
    </body>
    </html>
  `);
});

app.get('/auth/youtube/callback', async (req, res) => {
  const { code } = req.query;
  
  if (!code) {
    return res.send(`
      <h1>❌ Error</h1>
      <p>No authorization code received. Please try again.</p>
    `);
  }
  
  try {
    logger.info('📺 Processing YouTube OAuth callback...');
    const tokens = await handleCallback(code as string);
    logger.info('✅ YouTube OAuth tokens received successfully');
    
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
          h1 { 
            color: #0f9d58; 
            margin-bottom: 10px;
          }
          pre { 
            background: #f5f5f5; 
            padding: 20px; 
            border-radius: 8px; 
            overflow-x: auto;
            font-size: 13px;
            border: 2px solid #e0e0e0;
          }
          .warning { 
            background: #fff3cd; 
            border-left: 4px solid #ffc107;
            padding: 20px; 
            border-radius: 8px; 
            margin: 20px 0;
          }
          .copy-btn {
            background: #4285f4;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            margin-top: 10px;
          }
          .copy-btn:hover {
            background: #357ae8;
          }
          ol {
            line-height: 1.8;
          }
          code {
            background: #f5f5f5;
            padding: 2px 6px;
            border-radius: 4px;
            font-family: monospace;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>✅ Success!</h1>
          <p>YouTube authorization successful! Follow the steps below to complete the setup.</p>
          
          <div class="warning">
            <strong>⚠️ Important Steps:</strong>
            <ol>
              <li>Copy the ENTIRE line below (including the quotes)</li>
              <li>Open <code>backend/.env</code> in your code editor</li>
              <li>Find the line: <code>YOUTUBE_TOKENS=</code></li>
              <li>Replace it with the line below</li>
              <li>Save the file</li>
              <li>Restart your backend server: <code>npm run dev</code></li>
            </ol>
          </div>
          
          <h3>📋 Copy this line to your .env file:</h3>
          <pre id="tokens">YOUTUBE_TOKENS='${JSON.stringify(tokens)}'</pre>
          <button class="copy-btn" onclick="copyTokens()">📋 Copy to Clipboard</button>
          
          <p style="margin-top: 30px; color: #666; font-size: 14px;">
            <strong>Security Note:</strong> After adding tokens to .env, you should remove the <code>/setup-youtube</code> and <code>/auth/youtube/callback</code> routes from index.ts for security.
          </p>
        </div>
        
        <script>
          function copyTokens() {
            const text = document.getElementById('tokens').textContent;
            navigator.clipboard.writeText(text).then(() => {
              alert('✅ Copied to clipboard! Now paste it in your .env file.');
            });
          }
        </script>
      </body>
      </html>
    `);
  } catch (error: any) {
    logger.error('❌ YouTube OAuth error:', error);
    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Error - MiniGuru</title></head>
      <body style="font-family: Arial; padding: 40px; max-width: 800px; margin: 0 auto;">
        <h1 style="color: #d32f2f;">❌ Error</h1>
        <p>Failed to complete YouTube authorization.</p>
        <pre style="background: #f5f5f5; padding: 20px; border-radius: 8px; overflow-x: auto;">${error.message}</pre>
        <p style="margin-top: 20px;">
          <strong>Troubleshooting:</strong><br>
          1. Check that YouTube Data API v3 is enabled in Google Cloud Console<br>
          2. Verify your OAuth credentials are correct in .env<br>
          3. Make sure the redirect URI matches exactly<br>
          4. Check backend logs for more details
        </p>
      </body>
      </html>
    `);
  }
});

// ============================================
// API Routes
// ============================================
app.use('/auth', authRouter);
app.use('/order', orderRouter);
app.use('/products', productRouter);
app.use('/me', userRouter);
app.use('/project', projectRouter);
app.use('/admin', adminRouter);
app.use('/payment', paymentRouter);
app.use('/api/videos', videoRoutes);  // YouTube video upload routes

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
  logger.info(`📺 YouTube OAuth setup available at: /setup-youtube`);
});

export { app, prisma };