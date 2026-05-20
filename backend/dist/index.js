"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = exports.app = void 0;
// backend/src/index.ts
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const prismaClient_1 = __importDefault(require("./utils/prismaClient"));
exports.prisma = prismaClient_1.default;
const logger_1 = __importDefault(require("./logger"));
const pino_http_1 = require("pino-http");
// Load environment variables FIRST
dotenv_1.default.config();
// Import security and performance middleware
const compression_1 = __importDefault(require("compression"));
const helmet_1 = __importDefault(require("helmet"));
const express_rate_limit_1 = __importDefault(require("express-rate-limit"));
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const productRoutes_1 = __importDefault(require("./routes/productRoutes"));
const orderRoutes_1 = __importDefault(require("./routes/orderRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const projectRoutes_1 = __importDefault(require("./routes/projectRoutes"));
const adminRoutes_1 = __importDefault(require("./routes/adminRoutes"));
const paymentRoutes_1 = __importDefault(require("./routes/paymentRoutes"));
const videoRoutes_1 = __importDefault(require("./routes/videoRoutes"));
const videoRatingRoutes_1 = __importDefault(require("./routes/videoRatingRoutes"));
const materialsRoutes_1 = __importDefault(require("./routes/materialsRoutes"));
const shopRoutes_1 = __importDefault(require("./routes/shopRoutes"));
const userAnalyticsRoutes_1 = __importDefault(require("./routes/userAnalyticsRoutes"));
const cmsRoutes_1 = __importDefault(require("./routes/cmsRoutes"));
const guardianRoutes_1 = __importDefault(require("./routes/guardianRoutes"));
const communicationRoutes_1 = __importDefault(require("./routes/communicationRoutes")); // ← NEW
const goinsRoutes_1 = __importDefault(require("./routes/goinsRoutes")); // ← NEW
// YouTube Upload Setup (optional)
let youtubeService = null;
try {
    youtubeService = require('./services/youtubeUploadService');
    logger_1.default.info('YouTube service loaded successfully');
}
catch (error) {
    logger_1.default.warn({ error: error.message }, 'YouTube service not available - YouTube features will be disabled');
}
const app = (0, express_1.default)();
exports.app = app;
// ============================================
// GLOBAL ERROR HANDLERS (MUST BE FIRST!)
// ============================================
process.on('uncaughtException', (error) => {
    logger_1.default.error({ error: error.message, stack: error.stack }, '❌ Uncaught exception');
});
process.on('unhandledRejection', (reason, promise) => {
    logger_1.default.error({
        reason: reason?.message || reason,
        stack: reason?.stack
    }, '❌ Unhandled promise rejection');
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
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization, Cookie, Set-Cookie, X-Child-Profile-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range, Set-Cookie');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    next();
});
// Logging middleware
app.use((0, pino_http_1.pinoHttp)({
    logger: logger_1.default,
    autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/'
    }
}));
// Body parsers
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Security middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false, // Disable CSP for API
    crossOriginEmbedderPolicy: false
}));
// Compression middleware
app.use((0, compression_1.default)());
// Rate limiting
const limiter = (0, express_rate_limit_1.default)({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // limit each IP to 1000 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
});
app.use(limiter);
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
    if (!youtubeService) {
        return res.status(503).send('YouTube service is not configured.');
    }
    try {
        const url = youtubeService.getAuthUrl();
        res.send(`
//       <!DOCTYPE html>
//       <html>
//       <head>
//         <title>YouTube OAuth Setup - MiniGuru</title>
//         <style>
//           body {
//             font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
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
          h1 { color: #4285f4; margin-bottom: 10px; }
          p { color: #666; line-height: 1.6; }
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
    }
    catch (error) {
        logger_1.default.error({ error }, 'YouTube OAuth setup error');
        res.status(500).send('YouTube OAuth setup is not configured. Please check your environment variables.');
    }
});
app.get('/auth/youtube/callback', async (req, res) => {
    if (!youtubeService) {
        return res.status(503).send('YouTube service is not configured.');
    }
    const { code } = req.query;
    if (!code) {
        return res.status(400).send(`<h1>❌ Error</h1><p>No authorization code received. Please try again.</p>`);
    }
    try {
        logger_1.default.info('Processing YouTube OAuth callback...');
        const tokens = await youtubeService.handleCallback(code);
        logger_1.default.info('YouTube OAuth tokens received successfully');
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
    }
    catch (error) {
        logger_1.default.error({ error: error.message }, 'YouTube OAuth error');
        res.status(500).send(`<h1>❌ Error</h1><p>Failed to complete YouTube authorization.</p><pre>${error.message}</pre>`);
    }
});
// ============================================
// API ROUTES
// ============================================
try {
    app.use('/auth', authRoutes_1.default);
    app.use('/order', orderRoutes_1.default);
    app.use('/products', productRoutes_1.default);
    app.use('/me', userRoutes_1.default);
    app.use('/project', projectRoutes_1.default);
    app.use('/admin', adminRoutes_1.default);
    app.use('/payment', paymentRoutes_1.default);
    app.use('/api/videos', videoRoutes_1.default);
    app.use('/api/videos', videoRatingRoutes_1.default);
    app.use('/materials', materialsRoutes_1.default); // ← NEW: STEM materials for Goins exchange
    app.use('/shop', shopRoutes_1.default);
    app.use('/goins', goinsRoutes_1.default);
    app.use('/users', userAnalyticsRoutes_1.default);
    app.use('/cms', cmsRoutes_1.default);
    app.use('/mentor', guardianRoutes_1.default);
    app.use('/communication', communicationRoutes_1.default);
    app.use('/admin/communication', communicationRoutes_1.default);
    app.use('/admin/cms', cmsRoutes_1.default); // ← NEW: Goins balance, deduct, award
    logger_1.default.info('✅ All routes registered successfully');
}
catch (error) {
    logger_1.default.error({ error }, '❌ Failed to register routes');
}
// Static files
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
// ============================================
// ERROR HANDLERS
// ============================================
// 404 handler
app.use((req, res) => {
    logger_1.default.warn(`404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({
        error: 'Not Found',
        message: `Cannot ${req.method} ${req.path}`,
        timestamp: new Date().toISOString()
    });
});
// Global error handler - MUST BE LAST
app.use((err, req, res, next) => {
    logger_1.default.error({
        error: err.message,
        stack: err.stack,
        url: req.url,
        method: req.method
    }, '❌ Request error');
    const isDevelopment = process.env.NODE_ENV === 'development';
    res.status(err.status || 500).json({
        error: err.message || 'Internal Server Error',
        ...(isDevelopment && { stack: err.stack, details: err })
    });
});
// ============================================
// SERVER STARTUP
// ============================================
const PORT = parseInt(process.env.PORT || '5001', 10);
const HOST = '0.0.0.0';
const server = app.listen(PORT, HOST, () => {
    logger_1.default.info(`🚀 Server running on ${HOST}:${PORT}`);
    logger_1.default.info(`🌐 CORS enabled for all origins (development mode)`);
    logger_1.default.info(`📡 Ready to accept requests`);
    if (youtubeService) {
        logger_1.default.info(`📺 YouTube OAuth setup available at: /setup-youtube`);
        // Pre-warm YouTube token on startup — auto-refresh from here on
        if (youtubeService.refreshTokenNow) {
            youtubeService.refreshTokenNow().catch((e) => logger_1.default.warn({ err: e.message }, '⚠️  YouTube token pre-warm failed (non-fatal)'));
        }
    }
    else {
        logger_1.default.info(`📺 YouTube OAuth setup: DISABLED (service not available)`);
    }
    logger_1.default.info(`🧰 Materials API: /materials`);
    logger_1.default.info(`🪙 Goins API: /goins`);
});
server.on('error', (error) => {
    logger_1.default.error({ error }, '❌ Server error');
});
// ============================================
// GRACEFUL SHUTDOWN
// ============================================
const gracefulShutdown = async (signal) => {
    logger_1.default.info(`${signal} received. Starting graceful shutdown...`);
    server.close(async () => {
        logger_1.default.info('HTTP server closed');
        try {
            await prismaClient_1.default.$disconnect();
            logger_1.default.info('Database connection closed');
            process.exit(0);
        }
        catch (error) {
            logger_1.default.error({ error }, 'Error during shutdown');
            process.exit(1);
        }
    });
    setTimeout(() => {
        logger_1.default.error('Forced shutdown after timeout');
        process.exit(1);
    }, 10000);
};
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
