import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';
import { fxService } from './services/fxService.js';
import checkoutRoutes from './routes/checkoutRoutes.js';
import currencyRoutes from './routes/currencyRoutes.js';
import webhookRoutes from './routes/webhookRoutes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PUBLIC_DIR = path.resolve(__dirname, '../public');
const EXAMPLES_DIR = path.resolve(__dirname, '../examples');

const app = express();

// Disable Express fingerprinting header
app.disable('x-powered-by');

// Security HTTP headers via Helmet
app.use(helmet({
  contentSecurityPolicy: false, // Disabled to allow modal iframes and Stripe checkout embedding
  crossOriginEmbedderPolicy: false
}));

// Rate Limiting to prevent DoS, brute-force, and session flooding
const apiLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: false,
    error: 'Too many requests from this IP, please try again later.'
  }
});
app.use('/api/', apiLimiter);

// CORS Configuration
const corsOrigins = config.security.allowedOrigins.includes('*')
  ? '*'
  : config.security.allowedOrigins;

app.use(cors({
  origin: corsOrigins,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-paystack-signature',
    'x-override-currency',
    'x-override-country'
  ]
}));

// Capture raw body buffer for HMAC webhook signature verification
app.use(express.json({
  limit: '256kb', // Prevent body payload flooding
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true, limit: '256kb' }));

// Serve static frontend assets
app.use(express.static(PUBLIC_DIR));
app.use('/examples', express.static(EXAMPLES_DIR));

// API Routes
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/currencies', currencyRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// Friendly URL shortcuts
app.get('/checkout', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'checkout.html'));
});

app.get('/success', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'success.html'));
});

app.get('/cancel', (req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'cancel.html'));
});

app.get('/demo', (req, res) => {
  res.sendFile(path.join(EXAMPLES_DIR, 'web-app-demo', 'index.html'));
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    airGappedMode: config.security.airGappedMode,
    paystackConfigured: config.paystack.isConfigured,
    settlementCurrency: config.currency.merchantSettlement,
    baseCurrency: config.currency.defaultBase
  });
});

// Global 404 handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ status: false, error: 'Endpoint not found' });
});

// Global error handler (prevents stack trace leakage)
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err.message);
  res.status(500).json({
    status: false,
    error: config.nodeEnv === 'production' ? 'Internal server error' : err.message
  });
});

// Start server
async function startServer() {
  console.log('Initializing Currency Rates & FX Engine...');
  await fxService.initialize();

  app.listen(config.port, () => {
    console.log(`
=============================================================
  Paystack-Stripe Gateway Started [SECURED & HARDENED]
=============================================================
  Listening on:         ${config.baseUrl}
  Checkout URL:         ${config.baseUrl}/checkout?sessionId={id}
  Live Demo Store:      ${config.baseUrl}/demo
  Health Check:         ${config.baseUrl}/api/health
  Currencies API:       ${config.baseUrl}/api/v1/currencies
  Settlement:           ${config.currency.merchantSettlement}
  Base Currency:        ${config.currency.defaultBase}
  Paystack Mode:        ${config.paystack.isConfigured ? (config.paystack.isTestKey ? 'TEST MODE' : 'LIVE MODE') : 'SANDBOX / DEMO MOCK'}
  Air-Gapped Mode:      ${config.security.airGappedMode ? 'ENABLED (Zero Outbound Calls)' : 'DISABLED'}
  Rate Limiting:        ${config.security.rateLimitMax} reqs / 15m
  Security Headers:     Helmet Active (X-Powered-By removed)
=============================================================
    `);
  });
}

startServer().catch(err => {
  console.error('Fatal startup error:', err);
  process.exit(1);
});
