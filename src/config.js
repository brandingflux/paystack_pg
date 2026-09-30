import dotenv from 'dotenv';
dotenv.config();

const sanitizeBaseUrl = (url, port) => {
  let u = (url || `http://localhost:${port}`).trim().replace(/\/+$/, '');
  if (!u.startsWith('http://') && !u.startsWith('https://')) {
    u = u.includes('localhost') || u.includes('127.0.0.1') ? `http://${u}` : `https://${u}`;
  }
  return u;
};

const port = parseInt(process.env.PORT || '3000', 10);

export const config = {
  port,
  nodeEnv: process.env.NODE_ENV || 'development',
  baseUrl: sanitizeBaseUrl(process.env.BASE_URL, port),

  security: {
    // Air-gapped / fully self-contained mode: eliminates all external third-party calls (FX, GeoIP, telemetry)
    airGappedMode: process.env.AIR_GAPPED_MODE === 'true',
    allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim()) : ['*'],
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // 15 minutes
    rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX || '120', 10) // 120 requests per window
  },

  paystack: {
    secretKey: process.env.PAYSTACK_SECRET_KEY || '',
    publicKey: process.env.PAYSTACK_PUBLIC_KEY || '',
    apiBase: 'https://api.paystack.co',
    isTestKey: (process.env.PAYSTACK_SECRET_KEY || '').startsWith('sk_test_'),
    isConfigured: !!(process.env.PAYSTACK_SECRET_KEY && !process.env.PAYSTACK_SECRET_KEY.includes('placeholder'))
  },

  currency: {
    defaultBase: (process.env.DEFAULT_BASE_CURRENCY || 'USD').toUpperCase(),
    merchantSettlement: (process.env.MERCHANT_SETTLEMENT_CURRENCY || 'NGN').toUpperCase(),
    fxBufferPercent: parseFloat(process.env.FX_BUFFER_PERCENT || '1.5'),
    cacheDurationMinutes: 60
  },

  merchant: {
    name: process.env.MERCHANT_NAME || 'Acme Pro Apps',
    logoUrl: process.env.MERCHANT_LOGO_URL || '',
    supportEmail: process.env.MERCHANT_SUPPORT_EMAIL || 'support@example.com'
  }
};
