import axios from 'axios';
import crypto from 'crypto';
import { config } from '../config.js';

class PaystackService {
  constructor() {
    this.api = axios.create({
      baseURL: config.paystack.apiBase,
      timeout: 15000
    });
  }

  getHeaders() {
    return {
      Authorization: `Bearer ${config.paystack.secretKey}`,
      'Content-Type': 'application/json'
    };
  }

  isMockMode() {
    return !config.paystack.isConfigured;
  }

  /**
   * Initialize a Paystack transaction
   * @param {Object} params
   * @param {string} params.email
   * @param {number} params.amountInKobo - Amount in lowest unit (kobo or cents)
   * @param {string} params.currency - e.g. 'NGN' or 'USD'
   * @param {string} params.reference - Unique reference
   * @param {string} params.callbackUrl - Return URL
   * @param {Object} params.metadata - Custom metadata
   * @param {string} [params.planCode] - Paystack Plan code for recurring subscriptions
   * @returns {Promise<{ authorizationUrl: string, accessCode: string, reference: string }>}
   */
  async initializeTransaction({ email, amountInKobo, currency = 'NGN', reference, callbackUrl, metadata = {}, planCode }) {
    if (this.isMockMode()) {
      console.log(`[Paystack Mock] Initializing transaction ref=${reference} amount=${amountInKobo} ${currency} for ${email}`);
      const mockAccessCode = `mock_acc_${Date.now()}`;
      return {
        authorizationUrl: `${config.baseUrl}/checkout-mock.html?reference=${reference}&amount=${amountInKobo}&currency=${currency}`,
        accessCode: mockAccessCode,
        reference
      };
    }

    try {
      const payload = {
        email,
        amount: Math.round(amountInKobo),
        currency,
        reference,
        callback_url: callbackUrl,
        metadata
      };

      if (planCode) {
        payload.plan = planCode;
      }

      const res = await this.api.post('/transaction/initialize', payload, {
        headers: this.getHeaders()
      });

      if (!res.data.status) {
        throw new Error(res.data.message || 'Failed to initialize Paystack transaction');
      }

      return {
        authorizationUrl: res.data.data.authorization_url,
        accessCode: res.data.data.access_code,
        reference: res.data.data.reference
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('[PaystackService.initializeTransaction] Error:', errorMsg);
      throw new Error(`Paystack initialization failed: ${errorMsg}`);
    }
  }

  /**
   * Verify transaction status with Paystack
   * @param {string} reference
   * @returns {Promise<Object>}
   */
  async verifyTransaction(reference) {
    if (this.isMockMode() || reference.startsWith('mock_')) {
      return {
        status: 'success',
        reference,
        amount: 500000,
        currency: 'NGN',
        paid_at: new Date().toISOString(),
        customer: { email: 'demo_user@example.com' },
        authorization: {
          authorization_code: `AUTH_mock_${Date.now()}`,
          card_type: 'visa',
          last4: '4242',
          exp_month: '12',
          exp_year: '2028',
          bank: 'Test Demo Bank'
        }
      };
    }

    try {
      const res = await this.api.get(`/transaction/verify/${encodeURIComponent(reference)}`, {
        headers: this.getHeaders()
      });

      if (!res.data.status) {
        throw new Error(res.data.message || 'Transaction verification returned false');
      }

      return res.data.data;
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('[PaystackService.verifyTransaction] Error:', errorMsg);
      throw new Error(`Paystack verification failed: ${errorMsg}`);
    }
  }

  /**
   * Get or Create a Paystack Plan for recurring subscriptions
   * @param {Object} params
   * @param {string} params.name - e.g. "Pro Plan Monthly"
   * @param {string} params.interval - 'hourly' | 'daily' | 'weekly' | 'monthly' | 'biannually' | 'annually'
   * @param {number} params.amountInKobo
   * @param {string} params.currency
   * @returns {Promise<{ planCode: string, id: number }>}
   */
  async getOrCreatePlan({ name, interval = 'monthly', amountInKobo, currency = 'NGN' }) {
    if (this.isMockMode()) {
      return {
        planCode: `PLN_mock_${interval}_${Math.round(amountInKobo)}`,
        id: 99999
      };
    }

    try {
      // 1. Check existing plans to avoid cluttering Paystack dashboard
      const listRes = await this.api.get('/plan', {
        headers: this.getHeaders(),
        params: { perPage: 100 }
      });

      if (listRes.data?.data) {
        const existing = listRes.data.data.find(
          p => p.name === name && p.interval === interval && Number(p.amount) === Math.round(amountInKobo) && p.currency === currency
        );
        if (existing) {
          return { planCode: existing.plan_code, id: existing.id };
        }
      }

      // 2. Create new plan
      const createRes = await this.api.post(
        '/plan',
        {
          name,
          interval,
          amount: Math.round(amountInKobo),
          currency
        },
        { headers: this.getHeaders() }
      );

      if (!createRes.data.status) {
        throw new Error(createRes.data.message || 'Failed to create plan');
      }

      return {
        planCode: createRes.data.data.plan_code,
        id: createRes.data.data.id
      };
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message;
      console.error('[PaystackService.getOrCreatePlan] Error:', errorMsg);
      throw new Error(`Paystack plan setup failed: ${errorMsg}`);
    }
  }

  /**
   * Verify HMAC signature for incoming Paystack webhooks with timing-safe comparison
   * @param {Buffer|string} rawBody
   * @param {string} signatureHeader
   * @returns {boolean}
   */
  verifyWebhookSignature(rawBody, signatureHeader) {
    if (!signatureHeader || !config.paystack.secretKey) return false;

    try {
      const computedHash = crypto
        .createHmac('sha512', config.paystack.secretKey)
        .update(rawBody)
        .digest('hex');

      const computedBuffer = Buffer.from(computedHash, 'hex');
      const signatureBuffer = Buffer.from(signatureHeader, 'hex');

      if (computedBuffer.length !== signatureBuffer.length) {
        return false;
      }

      return crypto.timingSafeEqual(computedBuffer, signatureBuffer);
    } catch {
      return false;
    }
  }

  /**
   * Fetch customer subscriptions from Paystack API
   * @param {string} email
   * @returns {Promise<Array>}
   */
  async getCustomerSubscriptions(email) {
    if (this.isMockMode()) {
      return [];
    }

    try {
      const res = await this.api.get(`/customer/${encodeURIComponent(email)}`, {
        headers: this.getHeaders()
      });

      if (!res.data?.status || !res.data?.data) {
        return [];
      }

      return res.data.data.subscriptions || [];
    } catch (err) {
      if (err.response?.status === 404) {
        return [];
      }
      const errorMsg = err.response?.data?.message || err.message;
      console.warn('[PaystackService.getCustomerSubscriptions] Notice:', errorMsg);
      return [];
    }
  }
}

export const paystackService = new PaystackService();
