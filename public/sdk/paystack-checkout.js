/**
 * PaystackStripe SDK
 * Drop-in Stripe-style payment gateway client powered by Paystack
 * Supports Web Apps, Browser Extensions, Mobile WebViews, and SPA frameworks.
 */
(function(window) {
  class PaystackStripe {
    /**
     * @param {Object} options
     * @param {string} [options.backendUrl] - Root URL of your Paystack-Stripe backend
     */
    constructor(options = {}) {
      this.backendUrl = (options.backendUrl || window.location.origin || 'http://localhost:3000').replace(/\/$/, '');
      this._modalInstance = null;
      this._initMessageListener();
    }

    /**
     * Helper to detect the current user's country and default currency
     * @returns {Promise<{ country: string, currency: string }>}
     */
    async detectUserCurrency() {
      try {
        const res = await fetch(`${this.backendUrl}/api/v1/currencies/detect`);
        const data = await res.json();
        return {
          country: data.country || 'US',
          currency: data.currency || 'USD'
        };
      } catch (e) {
        return { country: 'US', currency: 'USD' };
      }
    }

    /**
     * Get real-time exchange rates & supported currency metadata
     */
    async getRates() {
      const res = await fetch(`${this.backendUrl}/api/v1/currencies`);
      return await res.json();
    }

    /**
     * Create a Stripe-like checkout session from frontend or backend
     * @param {Object} sessionParams
     * @param {'payment'|'subscription'} sessionParams.mode
     * @param {Array<{name: string, amount: number, currency?: string, quantity?: number, description?: string}>} sessionParams.line_items
     * @param {string} [sessionParams.subscription_interval] - 'monthly'|'annually'|'weekly'
     * @param {string} [sessionParams.customer_email]
     * @param {string} [sessionParams.customer_name]
     * @param {string} [sessionParams.success_url]
     * @param {string} [sessionParams.cancel_url]
     * @param {Object} [sessionParams.metadata]
     * @returns {Promise<{ id: string, url: string }>}
     */
    async createCheckoutSession(sessionParams) {
      const res = await fetch(`${this.backendUrl}/api/v1/checkout/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sessionParams)
      });

      const data = await res.json();
      if (!data.status && data.error) {
        throw new Error(data.error);
      }
      return data;
    }

    /**
     * Redirect to the Stripe-styled hosted checkout page
     * @param {Object} params
     * @param {string} params.sessionId
     */
    redirectToCheckout({ sessionId }) {
      if (!sessionId) {
        throw new Error('sessionId is required for redirectToCheckout');
      }
      window.location.href = `${this.backendUrl}/checkout.html?sessionId=${encodeURIComponent(sessionId)}`;
    }

    /**
     * Open checkout inside a sleek Stripe-styled Modal overlay
     * Ideal for SPAs, Dashboard apps, and Chrome Extensions where you don't want to redirect the user!
     * @param {Object} params
     * @param {string} params.sessionId
     * @param {Function} [params.onComplete] - Callback on payment success
     * @param {Function} [params.onCancel] - Callback on modal close / cancellation
     */
    openModal({ sessionId, onComplete, onCancel }) {
      if (!sessionId) {
        throw new Error('sessionId is required for openModal');
      }

      this.closeModal();

      this.onCompleteCallback = onComplete;
      this.onCancelCallback = onCancel;
      this.currentSessionId = sessionId;

      // 1. Create overlay container
      const overlay = document.createElement('div');
      overlay.id = 'ps-stripe-modal-overlay';
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100vw;
        height: 100vh;
        background-color: rgba(10, 37, 64, 0.65);
        backdrop-filter: blur(4px);
        z-index: 9999999;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
      `;

      // 2. Modal card
      const modal = document.createElement('div');
      modal.style.cssText = `
        position: relative;
        width: 95%;
        max-width: 980px;
        height: 90vh;
        max-height: 720px;
        background: #ffffff;
        border-radius: 14px;
        box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      `;

      // 3. Close button
      const closeBtn = document.createElement('button');
      closeBtn.innerHTML = '&times;';
      closeBtn.setAttribute('aria-label', 'Close modal');
      closeBtn.style.cssText = `
        position: absolute;
        top: 14px;
        right: 18px;
        background: rgba(0,0,0,0.06);
        border: none;
        border-radius: 50%;
        width: 32px;
        height: 32px;
        font-size: 20px;
        line-height: 1;
        cursor: pointer;
        z-index: 100;
        color: #475569;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.15s;
      `;
      closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(0,0,0,0.12)';
      closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(0,0,0,0.06)';
      closeBtn.onclick = () => {
        if (this.onCancelCallback) this.onCancelCallback();
        this.closeModal();
      };

      // 4. Iframe
      const iframe = document.createElement('iframe');
      iframe.src = `${this.backendUrl}/checkout.html?sessionId=${encodeURIComponent(sessionId)}&modal=true`;
      iframe.style.cssText = `
        width: 100%;
        height: 100%;
        border: none;
        background: #ffffff;
      `;

      modal.appendChild(closeBtn);
      modal.appendChild(iframe);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // Trigger fade-in
      requestAnimationFrame(() => {
        overlay.style.opacity = '1';
      });

      this._modalInstance = overlay;

      // Start status polling in case payment happens inside iframe or popup
      this._startStatusPolling(sessionId);
    }

    closeModal() {
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval);
        this._pollingInterval = null;
      }
      if (this._modalInstance && this._modalInstance.parentNode) {
        this._modalInstance.style.opacity = '0';
        setTimeout(() => {
          if (this._modalInstance && this._modalInstance.parentNode) {
            this._modalInstance.parentNode.removeChild(this._modalInstance);
          }
          this._modalInstance = null;
        }, 200);
      }
    }

    _initMessageListener() {
      window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'PAYMENT_COMPLETE') {
          if (this.onCompleteCallback) {
            this.onCompleteCallback(event.data);
          }
          this.closeModal();
        }
      });
    }

    _startStatusPolling(sessionId) {
      if (this._pollingInterval) clearInterval(this._pollingInterval);
      this._pollingInterval = setInterval(async () => {
        try {
          const res = await fetch(`${this.backendUrl}/api/v1/checkout/sessions/${sessionId}/status`);
          const data = await res.json();
          if (data.status && data.paymentStatus === 'paid') {
            clearInterval(this._pollingInterval);
            if (this.onCompleteCallback) {
              this.onCompleteCallback(data);
            }
            this.closeModal();
          }
        } catch (e) {
          // ignore transient polling errors
        }
      }, 3000);
    }
  }

  // Export to global window or as module
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PaystackStripe;
  } else {
    window.PaystackStripe = PaystackStripe;
  }
})(typeof window !== 'undefined' ? window : globalThis);
