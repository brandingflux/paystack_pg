import express from 'express';
import { sessionStore } from '../services/sessionStore.js';
import { fxService, SUPPORTED_CURRENCIES } from '../services/fxService.js';
import { geoService } from '../services/geoService.js';
import { paystackService } from '../services/paystackService.js';
import { config } from '../config.js';

const router = express.Router();

// Allowed subscription intervals
const VALID_INTERVALS = ['hourly', 'daily', 'weekly', 'monthly', 'biannually', 'annually'];

// Validation helper for redirect URLs (prevents open redirects and javascript: protocol)
function isValidRedirectUrl(urlStr) {
  if (!urlStr || typeof urlStr !== 'string') return false;
  const trimmed = urlStr.trim();
  // Strictly disallow javascript:, vbscript:, data:, and protocol-relative // URLs
  if (/^(javascript:|data:|vbscript:|\/\/)/i.test(trimmed)) return false;
  try {
    const dummy = trimmed.replace(/\{CHECKOUT_SESSION_ID\}|%7BCHECKOUT_SESSION_ID%7D/g, 'cs_dummy_id');
    const parsed = new URL(dummy);
    // Allow HTTP, HTTPS, or custom mobile deep link schemes (e.g. myapp://)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' || /^[a-zA-Z0-9_.-]+:$/.test(parsed.protocol);
  } catch {
    // If not a standard URL, check if custom app scheme like myapp://...
    return /^[a-zA-Z0-9_.-]+:\/\//.test(trimmed);
  }
}

// Validation helper for session ID format
function isValidSessionId(id) {
  return typeof id === 'string' && /^cs_(test|live)_[a-f0-9]{32}$/.test(id);
}

// Validation helper for email
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * POST /api/v1/checkout/sessions
 * Stripe-compatible endpoint to create a checkout session
 */
router.post('/sessions', async (req, res) => {
  try {
    const {
      mode = 'payment',
      line_items = [],
      customer_email,
      customer_name,
      merchant_name,
      merchant_logo,
      success_url,
      cancel_url,
      metadata = {},
      subscription_interval = 'monthly',
      currency = config.currency.defaultBase
    } = req.body;

    // 1. Validate mode
    if (mode !== 'payment' && mode !== 'subscription') {
      return res.status(400).json({
        status: false,
        error: 'Invalid mode. Must be "payment" or "subscription"'
      });
    }

    // 2. Validate subscription_interval if subscription mode
    if (mode === 'subscription' && !VALID_INTERVALS.includes(subscription_interval)) {
      return res.status(400).json({
        status: false,
        error: `Invalid subscription_interval. Allowed: ${VALID_INTERVALS.join(', ')}`
      });
    }

    // 3. Validate line_items
    if (!Array.isArray(line_items) || line_items.length === 0) {
      return res.status(400).json({
        status: false,
        error: 'line_items is required and must contain at least one item'
      });
    }

    // 4. Validate redirect URLs
    if (success_url && !isValidRedirectUrl(success_url)) {
      return res.status(400).json({
        status: false,
        error: 'Invalid success_url. Must be a valid HTTP, HTTPS, or custom app URI'
      });
    }

    if (cancel_url && !isValidRedirectUrl(cancel_url)) {
      return res.status(400).json({
        status: false,
        error: 'Invalid cancel_url. Must be a valid HTTP, HTTPS, or custom app URI'
      });
    }

    // 5. Validate customer email if supplied
    if (customer_email && !isValidEmail(customer_email)) {
      return res.status(400).json({
        status: false,
        error: 'Invalid customer_email format'
      });
    }

    // 6. Calculate total amount in base currency with numeric bounds checking
    let total = 0;
    const sanitizedItems = [];

    for (let index = 0; index < line_items.length; index++) {
      const item = line_items[index];
      const unitAmount = Number(item.amount || item.unit_amount || item.price || 0);
      const qty = Number(item.quantity || 1);

      if (isNaN(unitAmount) || unitAmount <= 0 || !isFinite(unitAmount)) {
        return res.status(400).json({
          status: false,
          error: `Invalid amount for item at index ${index}. Must be a positive number.`
        });
      }

      if (isNaN(qty) || qty <= 0 || !Number.isInteger(qty) || qty > 1000) {
        return res.status(400).json({
          status: false,
          error: `Invalid quantity for item at index ${index}. Must be an integer between 1 and 1000.`
        });
      }

      const itemCurrency = (item.currency || currency || 'USD').toUpperCase();
      total += unitAmount * qty;

      sanitizedItems.push({
        id: item.id || `item_${index + 1}`,
        name: String(item.name || 'Product').substring(0, 100),
        description: String(item.description || '').substring(0, 300),
        amount: unitAmount,
        currency: itemCurrency,
        quantity: qty
      });
    }

    // Upper limit safeguard to prevent overflow
    if (total > 10000000) {
      return res.status(400).json({
        status: false,
        error: 'Total amount exceeds maximum allowable transaction limit'
      });
    }

    const isLive = !config.paystack.isTestKey && config.paystack.isConfigured;

    const session = sessionStore.create({
      mode,
      line_items: sanitizedItems,
      amount_total: Number(total.toFixed(2)),
      currency: currency.toUpperCase(),
      customer_email: customer_email ? customer_email.trim() : null,
      customer_name: customer_name ? String(customer_name).substring(0, 100) : null,
      merchant_name: merchant_name ? String(merchant_name).substring(0, 100) : null,
      merchant_logo: merchant_logo ? String(merchant_logo).substring(0, 500) : null,
      success_url,
      cancel_url,
      metadata: typeof metadata === 'object' && metadata !== null ? metadata : {},
      subscription_interval,
      isLive
    });

    const checkoutUrl = `${config.baseUrl}/checkout.html?sessionId=${session.id}`;

    res.status(201).json({
      id: session.id,
      object: 'checkout.session',
      status: session.status,
      payment_status: session.payment_status,
      mode: session.mode,
      url: checkoutUrl,
      amount_total: session.amount_total,
      currency: session.currency,
      customer_email: session.customer_email,
      metadata: session.metadata,
      expires_at: session.expires_at
    });
  } catch (err) {
    console.error('[createCheckoutSession] Error:', err);
    res.status(500).json({ status: false, error: 'Internal server error processing session creation' });
  }
});

/**
 * GET /api/v1/checkout/sessions/:id
 * Retrieve session details with live auto-converted prices for user's country
 */
router.get('/sessions/:id', async (req, res) => {
  try {
    const sessionId = req.params.id;
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ status: false, error: 'Invalid session ID format' });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(404).json({ status: false, error: 'Checkout session not found' });
    }

    // Determine target display currency
    let displayCurrency = req.query.currency ? req.query.currency.toString().toUpperCase() : null;
    let detectedCountry = 'US';

    if (!displayCurrency || !SUPPORTED_CURRENCIES[displayCurrency]) {
      const geo = await geoService.detectUserLocation(req);
      displayCurrency = geo.currency;
      detectedCountry = geo.country;
    }

    // Base price
    const baseCurrency = session.currency || 'USD';
    const baseAmount = session.amount_total;

    // Display price (converted to user's local currency, e.g. CNY, USD, NGN, GBP)
    const displayAmount = fxService.convert(baseAmount, baseCurrency, displayCurrency);
    const displayFormatted = fxService.format(displayAmount, displayCurrency);

    // Settlement price (what Paystack will actually charge, e.g. NGN)
    const settlementCurrency = config.currency.merchantSettlement;
    const settlementAmount = fxService.convert(baseAmount, baseCurrency, settlementCurrency, true);
    const settlementFormatted = fxService.format(settlementAmount, settlementCurrency);

    // Line items converted
    const convertedItems = session.line_items.map(item => {
      const itemConverted = fxService.convert(item.amount, item.currency || baseCurrency, displayCurrency);
      return {
        ...item,
        displayAmount: itemConverted,
        displayFormatted: fxService.format(itemConverted, displayCurrency)
      };
    });

    res.json({
      status: true,
      session: {
        id: session.id,
        mode: session.mode,
        status: session.status,
        payment_status: session.payment_status,
        customer_email: session.customer_email,
        customer_name: session.customer_name,
        line_items: convertedItems,
        subscription_interval: session.subscription_interval,
        success_url: session.success_url,
        cancel_url: session.cancel_url,
        reference: session.paystack_reference,
        created_at: session.created_at
      },
      pricing: {
        baseCurrency,
        baseAmount,
        baseFormatted: fxService.format(baseAmount, baseCurrency),
        displayCurrency,
        displayAmount,
        displayFormatted,
        displayMeta: SUPPORTED_CURRENCIES[displayCurrency],
        settlementCurrency,
        settlementAmount,
        settlementFormatted,
        settlementMeta: SUPPORTED_CURRENCIES[settlementCurrency],
        isDirectMatch: displayCurrency === settlementCurrency
      },
      userLocation: {
        detectedCountry,
        detectedCurrency: displayCurrency
      },
      merchant: {
        name: session.merchant_name || config.merchant.name,
        logoUrl: session.merchant_logo || config.merchant.logoUrl,
        supportEmail: config.merchant.supportEmail,
        isMockMode: paystackService.isMockMode(),
        paystackPublicKey: config.paystack.publicKey || 'pk_test_demo_placeholder'
      }
    });
  } catch (err) {
    console.error('[getSession] Error:', err);
    res.status(500).json({ status: false, error: 'Internal server error retrieving session' });
  }
});

/**
 * POST /api/v1/checkout/sessions/:id/pay
 * Initiate payment with Paystack
 */
router.post('/sessions/:id/pay', async (req, res) => {
  try {
    const sessionId = req.params.id;
    if (!isValidSessionId(sessionId)) {
      return res.status(400).json({ status: false, error: 'Invalid session ID format' });
    }

    const session = sessionStore.get(sessionId);
    if (!session) {
      return res.status(404).json({ status: false, error: 'Checkout session not found' });
    }

    if (session.payment_status === 'paid') {
      return res.status(400).json({ status: false, error: 'This session has already been paid.' });
    }

    const { email, name, displayCurrency } = req.body;
    const customerEmail = email || session.customer_email;
    const customerName = name || session.customer_name;

    if (!customerEmail || !isValidEmail(customerEmail)) {
      return res.status(400).json({ status: false, error: 'A valid customer email is required' });
    }

    // Update customer info
    sessionStore.update(session.id, {
      customer_email: customerEmail.trim(),
      customer_name: customerName ? String(customerName).substring(0, 100) : null
    });

    // Determine settlement amount in merchant currency (NGN)
    const settlementCurrency = config.currency.merchantSettlement;
    const settlementAmount = fxService.convert(session.amount_total, session.currency, settlementCurrency, true);
    const decimals = SUPPORTED_CURRENCIES[settlementCurrency]?.decimals ?? 2;
    // Use Math.ceil to protect merchant from rounding down on fractional currency units
    const amountInKobo = Math.ceil(settlementAmount * Math.pow(10, decimals));

    const callbackUrl = `${config.baseUrl}/api/v1/checkout/sessions/${session.id}/verify`;

    const metadata = {
      sessionId: session.id,
      customerName,
      baseCurrency: session.currency,
      baseAmount: session.amount_total,
      displayCurrency: displayCurrency || session.currency,
      mode: session.mode,
      customMetadata: session.metadata
    };

    let planCode = null;

    // Handle Recurring Subscriptions
    if (session.mode === 'subscription') {
      const firstItem = (session.line_items && session.line_items[0]) || {};
      const planBrand = session.merchant_name || config.merchant.name;
      const planName = `${planBrand} - ${firstItem.name || 'Pro Plan'} (${session.subscription_interval})`;
      
      const planInfo = await paystackService.getOrCreatePlan({
        name: planName,
        interval: session.subscription_interval || 'monthly',
        amountInKobo,
        currency: settlementCurrency
      });
      planCode = planInfo.planCode;
      metadata.planCode = planCode;
    }

    // Initialize with Paystack
    const paystackResult = await paystackService.initializeTransaction({
      email: customerEmail,
      amountInKobo,
      currency: settlementCurrency,
      reference: session.paystack_reference,
      callbackUrl,
      metadata,
      planCode
    });

    res.json({
      status: true,
      authorizationUrl: paystackResult.authorizationUrl,
      accessCode: paystackResult.accessCode,
      reference: session.paystack_reference,
      settlementAmount,
      settlementCurrency,
      isMock: paystackService.isMockMode()
    });
  } catch (err) {
    console.error('[paySession] Error:', err);
    res.status(500).json({ status: false, error: err.message || 'Payment initiation failed' });
  }
});

/**
 * GET /api/v1/checkout/sessions/:id/verify
 * Verification callback after Paystack completes
 */
router.get('/sessions/:id/verify', async (req, res) => {
  try {
    const reference = req.query.reference ? String(req.query.reference).trim() : null;
    let session = sessionStore.get(req.params.id);
    if (!session && reference) {
      session = sessionStore.getByReference(reference);
    }
    if (!session) {
      return res.status(404).send('Checkout session not found');
    }

    const activeRef = reference || session.paystack_reference;
    // Verify transaction with Paystack
    const verification = await paystackService.verifyTransaction(activeRef);

    if (verification.status === 'success') {
      sessionStore.markPaid(session.id, verification);

      if (req.headers.accept?.includes('application/json') || req.query.format === 'json') {
        return res.json({
          status: true,
          message: 'Payment verified successfully',
          session: sessionStore.get(session.id)
        });
      }

      if (session.success_url && isValidRedirectUrl(session.success_url)) {
        const redirectUrl = session.success_url
          .replace(/\{CHECKOUT_SESSION_ID\}|%7BCHECKOUT_SESSION_ID%7D/g, session.id);
        return res.redirect(redirectUrl);
      }

      return res.redirect(`/success.html?sessionId=${session.id}`);
    } else {
      if (session.cancel_url && isValidRedirectUrl(session.cancel_url)) {
        return res.redirect(session.cancel_url);
      }
      return res.redirect(`/cancel.html?sessionId=${session.id}&reason=${encodeURIComponent(verification.gateway_response || 'Payment incomplete')}`);
    }
  } catch (err) {
    console.error('[verifySession] Error:', err);
    res.redirect(`/cancel.html?sessionId=${encodeURIComponent(req.params.id)}&reason=${encodeURIComponent('Verification error')}`);
  }
});

/**
 * GET /api/v1/checkout/sessions/:id/status
 * Polling endpoint for client-side modal to check if payment completed
 */
router.get('/sessions/:id/status', (req, res) => {
  const sessionId = req.params.id;
  if (!isValidSessionId(sessionId)) {
    return res.status(400).json({ status: false, error: 'Invalid session ID format' });
  }

  const session = sessionStore.get(sessionId);
  if (!session) {
    return res.status(404).json({ status: false, error: 'Session not found' });
  }

  res.json({
    status: true,
    sessionId: session.id,
    paymentStatus: session.payment_status,
    sessionStatus: session.status,
    paidAt: session.paid_at || null,
    customerEmail: session.customer_email
  });
});

/**
 * GET /api/v1/checkout/customer/:email/status
 * Check if a customer has an active subscription or paid session
 */
router.get('/customer/:email/status', async (req, res) => {
  try {
    const email = (req.params.email || '').trim().toLowerCase();
    if (!email || !isValidEmail(email)) {
      return res.status(400).json({ status: false, error: 'A valid email address is required' });
    }

    // 1. Check local sessionStore for any paid session matching this email
    const sessions = sessionStore.findByEmail(email);
    const paidSession = sessions.find(s => s.payment_status === 'paid');

    // 2. Check Paystack API directly for active subscriptions
    const subscriptions = await paystackService.getCustomerSubscriptions(email);
    const activeSubscription = subscriptions.find(s => s.status === 'active' || s.status === 'non-renewing');

    const isSubscribed = Boolean(activeSubscription || paidSession);

    res.json({
      status: true,
      email,
      isSubscribed,
      subscription: activeSubscription || null,
      paidSession: paidSession ? {
        id: paidSession.id,
        paidAt: paidSession.paid_at,
        amount: paidSession.amount_total,
        currency: paidSession.currency
      } : null
    });
  } catch (err) {
    console.error('[customerStatus] Error:', err);
    res.status(500).json({ status: false, error: 'Internal server error checking customer status' });
  }
});

export default router;
