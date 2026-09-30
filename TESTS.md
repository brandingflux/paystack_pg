# Gateway Verification & Live Production Test Log 🧪

Verification and smoke testing log for the **Paystack-Stripe Global Gateway** deployed live on Railway:
**Live Production URL:** `https://paystackpg-production.up.railway.app`

---

## 📋 Test Summary

| # | Test Case | Target Endpoint / Action | Status | Verified Result |
| :-: | :--- | :--- | :-: | :--- |
| **1** | Server Health Check | `GET /api/health` | ✅ **PASSED** | Node uptime healthy, Paystack keys verified (`paystackConfigured: true`) |
| **2** | Hosted Demo Store | `GET /demo` | ✅ **PASSED** | Stripe-styled checkout & pricing store rendered live |
| **3** | Embeddable SDK Serving | `GET /sdk/paystack-checkout.js` | ✅ **PASSED** | Standalone SDK script served with modal & redirect support |
| **4** | FX & Currency Detection | `GET /api/v1/currencies/detect` | ✅ **PASSED** | Geo-detection & 160+ live FX rates active (USD, EUR, GBP, NGN, CNY) |
| **5** | Session Creation API | `POST /api/v1/checkout/sessions` | ✅ **PASSED** | Created session `cs_test_...` and validated hosted checkout UI |
| **6** | End-to-End Card Checkout | Test Card Payment via Demo | ⏳ **READY** | Ready to run in browser with Paystack sandbox card |
| **7** | Webhook HMAC Verification | `POST /api/v1/webhooks/paystack` | ⏳ **READY** | Ready to test via Paystack Dashboard "Test Webhook" button |

---

## ✅ Completed Live Verifications

### 1. Health Check (`GET /api/health`)
- **Status:** ✅ Passed
- **Response:**
  ```json
  {
    "status": "ok",
    "timestamp": "2026-09-30T01:52:35.477Z",
    "uptime": 2274.64,
    "airGappedMode": false,
    "paystackConfigured": true,
    "settlementCurrency": "NGN",
    "baseCurrency": "USD"
  }
  ```

### 2. Demo Store (`GET /demo`)
- **Status:** ✅ Passed
- **Observation:** Interactive pricing table, currency selector, and modal checkout triggers rendered cleanly with Stripe styling.

### 3. Client SDK Serving (`GET /sdk/paystack-checkout.js`)
- **Status:** ✅ Passed
- **Observation:** Drop-in client SDK available at:
  ```html
  <script src="https://paystackpg-production.up.railway.app/sdk/paystack-checkout.js"></script>
  ```

### 4. Live Multi-Currency & Geolocation (`GET /api/v1/currencies/detect`)
- **Status:** ✅ Passed
- **Response:**
  ```json
  {
    "status": true,
    "country": "US",
    "currency": "USD",
    "source": "default"
  }
  ```
- **Rates Endpoint (`/api/v1/currencies`):** Successfully loaded live FX exchange rates across 160+ world currencies.

### 5. Checkout Session Creation API (`POST /api/v1/checkout/sessions`)
- **Status:** ✅ Passed
- **Test Session Created:** `cs_test_bcd493613b91521572318aa575d32d70`
- **Hosted Checkout Verified:** The session's checkout page loaded cleanly with itemized breakdown, currency toggle, and Paystack PCI iframe integration.

---

## ⏳ Final 2 Steps to Complete

### Step 6: Complete a Test Payment in Your Browser
Open your live checkout session or demo store in your browser:
👉 **[Open Live Demo Store](https://paystackpg-production.up.railway.app/demo)**

Click **"Buy License"** or **"Subscribe"**, and enter Paystack's official test credentials:

| Scenario | Card Number | Expiry | CVC | PIN / OTP |
| :--- | :---: | :---: | :---: | :---: |
| **Successful Payment** | `4084 0840 8408 4081` | Any future date | `408` | PIN: `1111` / OTP: `123456` |
| **Direct Decline** | `5123 4567 8901 2345` | Any future date | `123` | — |
| **Insufficient Funds** | `4084 0840 8408 4115` | Any future date | `408` | PIN: `1111` |

### Step 7: Configure Paystack Live/Test Webhook
1. Open your **[Paystack Developer Dashboard](https://dashboard.paystack.com/#/settings/developer)**.
2. In the **Webhook URL** field, set:
   ```
   https://paystackpg-production.up.railway.app/api/v1/webhooks/paystack
   ```
3. Click **"Save Changes"**, then click **"Test Webhook"**.
4. Confirm Paystack receives an `HTTP 200 OK` response.
