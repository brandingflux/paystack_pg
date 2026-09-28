import axios from 'axios';
import { SUPPORTED_CURRENCIES } from './fxService.js';
import { config } from '../config.js';

// ISO Country Code to Currency mapping
const COUNTRY_TO_CURRENCY = {
  US: 'USD',
  NG: 'NGN',
  CN: 'CNY',
  GB: 'GBP',
  CA: 'CAD',
  AU: 'AUD',
  JP: 'JPY',
  IN: 'INR',
  GH: 'GHS',
  KE: 'KES',
  ZA: 'ZAR',
  SG: 'SGD',
  BR: 'BRL',
  AE: 'AED',
  // Eurozone
  DE: 'EUR', FR: 'EUR', IT: 'EUR', ES: 'EUR', NL: 'EUR',
  BE: 'EUR', AT: 'EUR', IE: 'EUR', FI: 'EUR', PT: 'EUR',
  GR: 'EUR', EE: 'EUR', LV: 'EUR', LT: 'EUR', SK: 'EUR',
  SI: 'EUR', CY: 'EUR', MT: 'EUR', LU: 'EUR'
};

// Common Accept-Language locales fallback
const LOCALE_TO_COUNTRY = {
  'zh-cn': 'CN', 'zh-hans': 'CN', 'zh': 'CN',
  'en-ng': 'NG', 'ha-ng': 'NG', 'yo-ng': 'NG', 'ig-ng': 'NG',
  'en-us': 'US',
  'en-gb': 'GB',
  'en-ca': 'CA', 'fr-ca': 'CA',
  'en-au': 'AU',
  'ja': 'JP', 'ja-jp': 'JP',
  'hi': 'IN', 'en-in': 'IN',
  'de': 'DE', 'fr': 'FR', 'es': 'ES', 'it': 'IT'
};

// In-memory cache for IP lookups
const ipCache = new Map();

class GeoService {
  /**
   * Determine client country and currency from express request
   * @param {import('express').Request} req
   * @returns {Promise<{ country: string, currency: string, source: string, ip?: string }>}
   */
  async detectUserLocation(req) {
    // 1. Direct override via query or header (for testing & developer override)
    const overrideCountry = req.query.country || req.headers['x-override-country'];
    const overrideCurrency = req.query.currency || req.headers['x-override-currency'];

    if (overrideCurrency && SUPPORTED_CURRENCIES[overrideCurrency.toString().toUpperCase()]) {
      const code = overrideCurrency.toString().toUpperCase();
      return { country: overrideCountry?.toString().toUpperCase() || 'CUSTOM', currency: code, source: 'override' };
    }

    if (overrideCountry) {
      const c = overrideCountry.toString().toUpperCase();
      const curr = COUNTRY_TO_CURRENCY[c] || config.currency.defaultBase;
      return { country: c, currency: curr, source: 'country_override' };
    }

    // 2. Cloudflare or major CDN geo headers
    const cfCountry = req.headers['cf-ipcountry'];
    if (cfCountry && cfCountry !== 'XX' && cfCountry !== 'T1') {
      const c = cfCountry.toString().toUpperCase();
      return { country: c, currency: COUNTRY_TO_CURRENCY[c] || config.currency.defaultBase, source: 'cf_header' };
    }

    const vercelCountry = req.headers['x-vercel-ip-country'];
    if (vercelCountry) {
      const c = vercelCountry.toString().toUpperCase();
      return { country: c, currency: COUNTRY_TO_CURRENCY[c] || config.currency.defaultBase, source: 'vercel_header' };
    }

    // 3. In air-gapped mode or privacy-hardened environments, skip external IP lookups entirely
    if (!config.security.airGappedMode) {
      const clientIp = this.getClientIp(req);
      if (clientIp && !this.isPrivateIp(clientIp)) {
        if (ipCache.has(clientIp)) {
          const cached = ipCache.get(clientIp);
          return { ...cached, ip: clientIp, source: 'ip_cache' };
        }
      }
    }

    // 4. Accept-Language header fallback
    const acceptLang = req.headers['accept-language'];
    if (acceptLang) {
      const primaryLang = acceptLang.split(',')[0].trim().toLowerCase();
      const matchedCountry = LOCALE_TO_COUNTRY[primaryLang];
      if (matchedCountry) {
        return {
          country: matchedCountry,
          currency: COUNTRY_TO_CURRENCY[matchedCountry] || config.currency.defaultBase,
          source: 'accept_language'
        };
      }
    }

    // 5. Default fallback
    return {
      country: 'US',
      currency: config.currency.defaultBase,
      source: 'default'
    };
  }

  getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
      return forwarded.toString().split(',')[0].trim();
    }
    return req.socket?.remoteAddress || req.ip || '';
  }

  isPrivateIp(ip) {
    return (
      !ip ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.16.') ||
      ip.startsWith('172.31.') ||
      ip.startsWith('fe80:')
    );
  }
}

export const geoService = new GeoService();
