import express from 'express';
import { fxService } from '../services/fxService.js';
import { geoService } from '../services/geoService.js';

const router = express.Router();

/**
 * GET /api/v1/currencies
 * List all supported currencies and current live rates
 */
router.get('/', (req, res) => {
  const ratesData = fxService.getRates();
  const currencies = fxService.getSupportedCurrencies();
  res.json({
    status: true,
    currencies,
    rates: ratesData.rates,
    base: ratesData.base,
    updatedAt: ratesData.updatedAt
  });
});

/**
 * GET /api/v1/currencies/detect
 * Detect user's country and default currency based on IP or headers
 */
router.get('/detect', async (req, res) => {
  try {
    const geo = await geoService.detectUserLocation(req);
    res.json({
      status: true,
      country: geo.country,
      currency: geo.currency,
      source: geo.source
    });
  } catch (err) {
    res.status(500).json({ status: false, error: err.message });
  }
});

/**
 * GET /api/v1/currencies/convert
 * Convert an amount between currencies
 * Query params: amount, from (default USD), to (default NGN)
 */
router.get('/convert', (req, res) => {
  const amount = parseFloat(req.query.amount || '0');
  const from = (req.query.from || 'USD').toString();
  const to = (req.query.to || 'USD').toString();

  if (isNaN(amount) || amount <= 0) {
    return res.status(400).json({ status: false, message: 'Invalid amount provided' });
  }

  const converted = fxService.convert(amount, from, to);
  const formattedFrom = fxService.format(amount, from);
  const formattedTo = fxService.format(converted, to);

  res.json({
    status: true,
    from: from.toUpperCase(),
    to: to.toUpperCase(),
    originalAmount: amount,
    convertedAmount: converted,
    formattedOriginal: formattedFrom,
    formattedConverted: formattedTo
  });
});

export default router;
