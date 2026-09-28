import axios from 'axios';
import { config } from '../config.js';

// Comprehensive list of supported currencies with symbols, names, and flag emojis
export const SUPPORTED_CURRENCIES = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', decimals: 2 },
  NGN: { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', flag: '🇳🇬', decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', flag: '🇨🇦', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', decimals: 0 },
  INR: { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', decimals: 2 },
  GHS: { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', flag: '🇬🇭', decimals: 2 },
  KES: { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', flag: '🇰🇪', decimals: 2 },
  ZAR: { code: 'ZAR', symbol: 'R', name: 'South African Rand', flag: '🇿🇦', decimals: 2 },
  SGD: { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', decimals: 2 },
  BRL: { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪', decimals: 2 }
};

// Fallback rates (Base: USD = 1.0) updated to realistic market benchmarks
const FALLBACK_RATES_USD = {
  USD: 1.0,
  NGN: 1530.0,
  CNY: 7.25,
  EUR: 0.92,
  GBP: 0.78,
  CAD: 1.39,
  AUD: 1.54,
  JPY: 154.0,
  INR: 86.5,
  GHS: 15.2,
  KES: 130.0,
  ZAR: 18.2,
  SGD: 1.34,
  BRL: 5.75,
  AED: 3.67
};

class FxService {
  constructor() {
    this.rates = { ...FALLBACK_RATES_USD };
    this.lastFetched = null;
    this.cacheExpiryMinutes = config.currency.cacheDurationMinutes;
    this.isFetching = false;
  }

  async initialize() {
    if (config.security.airGappedMode) {
      this.lastFetched = new Date();
      console.log('[FX Service] AIR-GAPPED MODE active: Using local verified rate tables. Zero outbound FX calls.');
      return;
    }

    await this.refreshRates();
    // Refresh rates every hour
    setInterval(() => this.refreshRates(), this.cacheExpiryMinutes * 60 * 1000);
  }

  async refreshRates() {
    if (config.security.airGappedMode || this.isFetching) return;
    this.isFetching = true;

    try {
      // Primary API: open.er-api.com (free, high availability, no key required)
      const res = await axios.get('https://open.er-api.com/v6/latest/USD', { timeout: 8000 });
      if (res.data && res.data.rates) {
        this.rates = { ...this.rates, ...res.data.rates };
        this.lastFetched = new Date();
        console.log(`[FX Service] Live rates updated at ${this.lastFetched.toISOString()}. USD/NGN: ${this.rates.NGN}, USD/CNY: ${this.rates.CNY}`);
      }
    } catch (err) {
      console.warn(`[FX Service] Failed to fetch live rates from primary provider: ${err.message}. Trying backup...`);
      try {
        const backupRes = await axios.get('https://api.exchangerate-api.com/v4/latest/USD', { timeout: 8000 });
        if (backupRes.data && backupRes.data.rates) {
          this.rates = { ...this.rates, ...backupRes.data.rates };
          this.lastFetched = new Date();
          console.log(`[FX Service] Backup live rates updated.`);
        }
      } catch (backupErr) {
        console.warn(`[FX Service] Both FX APIs failed. Retaining current/fallback rates. ${backupErr.message}`);
        if (!this.lastFetched) {
          this.rates = { ...FALLBACK_RATES_USD };
          this.lastFetched = new Date();
        }
      }
    } finally {
      this.isFetching = false;
    }
  }

  /**
   * Convert an amount from one currency to another using current rates
   * @param {number} amount
   * @param {string} fromCurrency
   * @param {string} toCurrency
   * @param {boolean} applyBuffer - Whether to apply currency buffer if settling in merchant currency
   * @returns {number}
   */
  convert(amount, fromCurrency = 'USD', toCurrency = 'USD', applyBuffer = false) {
    const from = fromCurrency.toUpperCase();
    const to = toCurrency.toUpperCase();

    if (from === to) return Number(amount);

    const fromRate = this.rates[from] || FALLBACK_RATES_USD[from] || 1;
    const toRate = this.rates[to] || FALLBACK_RATES_USD[to] || 1;

    // Convert to USD base first, then to target
    const inUsd = amount / fromRate;
    let converted = inUsd * toRate;

    // Apply buffer if requested (e.g. 1.5% to protect merchant settlement against intraday currency drop)
    if (applyBuffer && config.currency.fxBufferPercent > 0) {
      converted = converted * (1 + config.currency.fxBufferPercent / 100);
    }

    const decimals = SUPPORTED_CURRENCIES[to]?.decimals ?? 2;
    return Number(converted.toFixed(decimals));
  }

  /**
   * Format a numerical amount with proper currency symbol and formatting
   * @param {number} amount
   * @param {string} currencyCode
   * @returns {string}
   */
  format(amount, currencyCode = 'USD') {
    const code = currencyCode.toUpperCase();
    const meta = SUPPORTED_CURRENCIES[code] || { symbol: code, decimals: 2 };
    const num = Number(amount);

    const formattedNum = num.toLocaleString('en-US', {
      minimumFractionDigits: meta.decimals,
      maximumFractionDigits: meta.decimals
    });

    if (meta.symbol === '$' || meta.symbol === '£' || meta.symbol === '€' || meta.symbol === '₦' || meta.symbol === '¥') {
      return `${meta.symbol}${formattedNum}`;
    }
    return `${meta.symbol} ${formattedNum}`;
  }

  getRates() {
    return {
      base: 'USD',
      updatedAt: this.lastFetched,
      rates: this.rates
    };
  }

  getSupportedCurrencies() {
    return SUPPORTED_CURRENCIES;
  }
}

export const fxService = new FxService();
