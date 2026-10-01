# Paystack-Stripe Global Gateway 💳

A high-converting, distraction-free payment gateway powered by **Paystack**, engineered to look, feel, and function like **Stripe Checkout**. 

Built for developers in Nigeria and unsupported Stripe regions who are building paid web apps, SaaS, and Chrome extensions for **international customers** (USA, China, Europe, UK, etc.).

---

## 📑 Table of Contents
- [🌟 Key Features](#-key-features)
- [🛡️ Security & PCI-DSS Compliance](#️-security--pci-dss-compliance)
- [📚 In-Depth Guides](#-in-depth-documentation-guides)
- [🚀 Beginner Quick Start](#-beginner-quick-start)
- [⚙️ Environment Variables Reference](#️-environment-variables-reference)
- [💱 Multi-Currency & Zero-Naira Engine](#-multi-currency--zero-naira-engine)
- [🛠️ How to Connect Your Apps](#️-how-to-connect-your-apps)
  - [1. Web Applications (React / Next.js / Vue)](#1-web-applications)
  - [2. Chrome & Browser Extensions (Manifest V3)](#2-chrome--browser-extensions-manifest-v3)
  - [3. Mobile Apps (React Native / Expo & Flutter)](#3-mobile-apps-react-native--flutter)
  - [4. Static Websites & Landing Pages (WordPress / Webflow / HTML)](#4-static-websites--landing-pages)
- [🤖 Using With AI Coding Agents](#-using-with-ai-coding-agents)
- [🗄️ Database Schemas & Webhooks](#️-database-schemas--webhooks)
- [🧪 Testing with Paystack Test Cards](#-testing-with-paystack-test-cards)
- [🚢 Production Deployment](#-production-deployment)
- [📁 Project Structure](#-project-structure)

---

## 🌟 Key Features

- **Stripe Checkout Aesthetic:** Pixel-perfect recreation of Stripe's clean typography, colors (`#635BFF` blurple, `#0A2540` navy), unified single-element card inputs, and live card brand recognition (Visa, Mastercard, Amex, Discover).
- **International-First (No Distractions):** International customers from the USA, China, Europe, etc. see prices natively in their currency (e.g., **$19.99 USD**, **¥135.00 CNY**, **€17.50 EUR**). Zero distracting conversion badges or Naira notices.
- **Live Multi-Currency & Auto-Geo Detection:** Automatically detects customer country and currency via headers or IP, pulling real-time exchange rates (USD, CNY, EUR, GBP, CAD, AUD, JPY, NGN, etc.) with automatic fallbacks and hourly caching.
- **One-Time & Recurring Subscriptions:** Supports one-time purchases (lifetime licenses, credits) and automated recurring subscriptions (monthly, annually) powered by Paystack Plans.
- **Drop-in Embeddable SDK:** Plug into any web app (Vanilla JS, React, Vue, Next.js) or Chrome Extension via **Modal overlay** (no redirect) or **Hosted Checkout**.
- **Airtight & Air-Gapped Ready:** Includes `AIR_GAPPED_MODE=true` toggle, timing-safe HMAC signature verification (`crypto.timingSafeEqual`), rate limiting, Helmet headers, and open-redirect protection.
- **Ready-to-Use Examples:** Includes a complete Manifest V3 Chrome Extension and an interactive SaaS Pricing Store.

---

## 🛡️ Security & PCI-DSS Compliance

> [!IMPORTANT]
> **PCI-DSS SAQ A Compliance (Zero-Card-Data Architecture):**
> This gateway is engineered with a **zero-card-data footprint**. Your application server **never** touches, logs, or stores cardholder numbers (PANs) or CVVs. Card input fields intentionally omit HTML `name` attributes so card data is never transmitted in form payloads. All card entry occurs directly inside Paystack's PCI-DSS Level 1 certified modal iframe (`PaystackPop`).
>
> 📜 **Auditor Architecture Spec:** Read [**`docs/COMPLIANCE_AND_SETTLEMENT.md`**](docs/COMPLIANCE_AND_SETTLEMENT.md) for the complete PCI-DSS SAQ A data flow sequence diagram, Paystack USD vs. NGN settlement mechanics, and mathematical ceiling FX safeguards.

### Production Security Defenses:
1. **PCI-DSS SAQ A Zero-Scope:** Eliminates cardholder data risk; all card entry is tokenized inside Paystack's PCI Level 1 vault. (See [**`docs/COMPLIANCE_AND_SETTLEMENT.md`**](docs/COMPLIANCE_AND_SETTLEMENT.md)).
2. **Timing-Safe HMAC Verification:** Webhook signatures are compared using `crypto.timingSafeEqual()` on byte buffers to prevent timing side-channel attacks.
3. **Open-Redirect Defense:** `success_url` and `cancel_url` parameters are validated against strict regex/protocols to reject `javascript:`, `data:`, `vbscript:`, and protocol-relative `//` exploits.
4. **Numeric Bounds & Type Sanitization:** Negative, `NaN`, or overflow amounts (> $10M) are rejected.
5. **Rate Limiting & Helmet Headers:** Protects API routes from DoS, brute-force attacks, and disables server fingerprinting (`X-Powered-By`).
6. **Air-Gapped Mode (`AIR_GAPPED_MODE=true`):**
   - Disables all external HTTP requests to foreign rate APIs (`open.er-api.com`).
   - Uses local immutable exchange rate tables.
   - Eliminates third-party IP lookups (uses zero-latency reverse-proxy headers only).

---

## 📚 In-Depth Documentation Guides

- 🤖 [**AI Agent Implementation Spec (`AGENT_INSTRUCTIONS.md`)**](AGENT_INSTRUCTIONS.md): Machine-readable instructions for AI agents (Cursor, Windsurf, Claude Code, Copilot) to implement the gateway in any project.
- 🏢 [**Multi-App & Dynamic Pricing Guide (`docs/MULTIPLE_APPS_GUIDE.md`)**](docs/MULTIPLE_APPS_GUIDE.md): Monetize multiple Chrome extensions, websites, and SaaS apps with custom pricing, intervals, branding, and webhook routing on a single instance.
- 📜 [**PCI-DSS & Settlement Guide (`docs/COMPLIANCE_AND_SETTLEMENT.md`)**](docs/COMPLIANCE_AND_SETTLEMENT.md): PCI-DSS SAQ A zero-card-data scope, Paystack USD vs NGN settlement, and FX rounding guarantees.
- 🌐 [**Universal Integration Guide (`docs/INTEGRATION_GUIDE.md`)**](docs/INTEGRATION_GUIDE.md): Connect Web Apps (React/Next.js), Chrome Extensions, Mobile Apps (React Native/Flutter), and Landing pages.
- 🗄️ [**Database & Modeling Guide (`docs/DATABASE_SCHEMAS.md`)**](docs/DATABASE_SCHEMAS.md): PostgreSQL/Supabase, Prisma, and MongoDB schemas for users, subscriptions, orders, and licenses.
- 🚀 [**Deployment & Webhook Setup (`docs/DEPLOYMENT_GUIDE.md`)**](docs/DEPLOYMENT_GUIDE.md): Deploy to Railway/Render/Docker and configure Paystack webhooks.

---

## 🚀 Beginner Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Run the Beginner Setup Script
We provided an automated setup script that creates your `.env` configuration:
```bash
npm run setup
```
**What this does:**
1. Checks if `.env` exists. If missing, it copies `.env.example` -> `.env` automatically.
2. Checks whether your Paystack keys are detected or still using placeholders.

> **Why `.env` is in `.gitignore`:** `.env` contains your private secret keys (`sk_live_...` or `sk_test_...`). It is ignored by Git so you never accidentally upload your keys to GitHub. `.env.example` is the safe public template.

### 3. Add Your Paystack Keys
Open your new `.env` file and paste your test or live keys from your [Paystack Developer Dashboard](https://dashboard.paystack.com/#/settings/developer):
```env
PAYSTACK_SECRET_KEY=sk_test_your_secret_key_here
PAYSTACK_PUBLIC_KEY=pk_test_your_public_key_here
```

### 4. Start the Server
```bash
# Standard start:
npm start

# Development mode (auto-reloads on file edits):
npm run dev
```

Visit the live demo store in your browser:
👉 **`http://localhost:3000/demo`**

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
| :--- | :---: | :--- |
| `PORT` | `3000` | Port the Express server listens on |
| `BASE_URL` | `http://localhost:3000` | Public URL where this gateway is hosted |
| `PAYSTACK_SECRET_KEY` | - | Your Paystack Secret Key (`sk_test_...` or `sk_live_...`) |
| `PAYSTACK_PUBLIC_KEY` | - | Your Paystack Public Key (`pk_test_...` or `pk_live_...`) |
| `DEFAULT_BASE_CURRENCY`| `USD` | The catalog currency your products are priced in |
| `MERCHANT_SETTLEMENT_CURRENCY` | `NGN` | Currency your Paystack account receives payouts in (`NGN` or `USD`) |
| `FX_BUFFER_PERCENT` | `1.5` | Percentage buffer (e.g. 1.5%) protecting against intraday FX fluctuations |
| `AIR_GAPPED_MODE` | `false` | When `true`, disables all external calls (uses local rates and header-only geo) |
| `ALLOWED_ORIGINS` | `*` | Comma-separated list of allowed CORS domains (e.g. `https://myapp.com`) |
| `RATE_LIMIT_MAX` | `120` | Maximum requests allowed per IP every 15 minutes |
| `MERCHANT_NAME` | `"Acme Pro Apps"` | Business name displayed on checkout header |
| `MERCHANT_SUPPORT_EMAIL` | `support@example.com` | Customer support email on receipts |

---

## 💱 Multi-Currency & Zero-Naira Engine

International customers must **never be confused or startled by seeing Nigerian Naira (₦)**.

| Customer Location | Detected Currency | What the Buyer Sees | Settlement Engine (Under the Hood) |
| :--- | :---: | :---: | :--- |
| 🇺🇸 **United States** | `USD` | **$19.99 / mo** | Processed securely via Paystack |
| 🇨🇳 **China** | `CNY` | **¥134.50 / mo** | Processed securely via Paystack |
| 🇪🇺 **Eurozone** | `EUR` | **€17.50 / mo** | Processed securely via Paystack |
| 🇬🇧 **United Kingdom** | `GBP` | **£15.60 / mo** | Processed securely via Paystack |
| 🇳🇬 **Nigeria** | `NGN` | **₦26,500 / mo** | Direct Paystack NGN |

- **Real-Time Exchange Rates:** Synchronized every 60 minutes from public FX feeds (`open.er-api.com` / `exchangerate-api.com`).
- **Offline & Air-Gapped Fallbacks:** Built-in fallback table ensures the gateway never crashes or halts if external rate APIs are unreachable.
- **Discreet Currency Switcher:** Includes a subtle locale selector at the bottom left (`🌐 USD ($) ▾`), exactly like Stripe's native language/currency selector.

---

## 🛠️ How to Connect Your Apps

### 1. Web Applications

Load the client SDK via script tag:
```html
<script src="http://localhost:3000/sdk/paystack-checkout.js"></script>
```

#### React / Next.js Component:
```tsx
'use client';
import React from 'react';

export function UpgradeButton({ userEmail }: { userEmail: string }) {
  const handleUpgrade = async () => {
    const pss = new (window as any).PaystackStripe({ backendUrl: 'http://localhost:3000' });

    // 1. Create Checkout Session
    const session = await pss.createCheckoutSession({
      mode: 'subscription',               // or 'payment' for one-time
      subscription_interval: 'monthly',
      line_items: [{
        name: 'Pro SaaS Plan',
        amount: 9.99,                     // USD base amount
        currency: 'USD',
        quantity: 1
      }],
      customer_email: userEmail,
      success_url: `${window.location.origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${window.location.origin}/pricing`
    });

    // 2A. Open in a Stripe-style Modal Overlay (No page reload)
    pss.openModal({
      sessionId: session.id,
      onComplete: () => {
        window.location.href = `/dashboard?session_id=${session.id}`;
      }
    });

    // OR 2B. Direct full-page redirect
    // pss.redirectToCheckout({ sessionId: session.id });
  };

  return (
    <button onClick={handleUpgrade} className="btn-primary">
      Upgrade to Pro ($9.99/mo)
    </button>
  );
}
```

---

### 2. Chrome & Browser Extensions (Manifest V3)

A full working Chrome extension is provided in [**`examples/chrome-extension-demo/`**](file:///C:/Users/Administrator/Documents/TECH/paystack_pg/examples/chrome-extension-demo).

#### How to test it in Chrome:
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Toggle on **Developer mode** (top-right switch).
3. Click **Load unpacked** and select:
   `C:\Users\Administrator\Documents\TECH\paystack_pg\examples\chrome-extension-demo`
4. Click the extension in your browser bar!

#### In your Extension's `popup.js`:
```javascript
const GATEWAY_URL = 'http://localhost:3000';

document.getElementById('buyBtn').onclick = async () => {
  const res = await fetch(`${GATEWAY_URL}/api/v1/checkout/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'subscription',
      subscription_interval: 'monthly',
      line_items: [{ name: 'Extension Pro', amount: 4.99, currency: 'USD' }],
      metadata: { extensionId: chrome.runtime.id }
    })
  });

  const session = await res.json();
  if (session.url) {
    // Save session ID for verification upon return
    await chrome.storage.local.set({ pendingSessionId: session.id });
    // Open checkout in a new browser tab
    chrome.tabs.create({ url: session.url });
  }
};
```

---

### 3. Mobile Apps (React Native & Flutter)

Open the checkout inside an **In-App Browser** with a custom **Deep Link Return Scheme**.

#### React Native / Expo:
```tsx
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

async function buyMobilePlan(userEmail: string) {
  const deepLink = Linking.createURL('payment-complete');

  const res = await fetch('http://localhost:3000/api/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'subscription',
      line_items: [{ name: 'Mobile Pro', amount: 9.99, currency: 'USD' }],
      customer_email: userEmail,
      success_url: `${deepLink}?session_id={CHECKOUT_SESSION_ID}`
    })
  });

  const session = await res.json();
  const result = await WebBrowser.openAuthSessionAsync(session.url, deepLink);

  if (result.type === 'success' && result.url) {
    const { queryParams } = Linking.parse(result.url);
    console.log('Payment successful! Session ID:', queryParams?.session_id);
  }
}
```

---

### 4. Static Websites & Landing Pages

On static marketing websites (WordPress, Webflow, plain HTML):
```html
<script src="http://localhost:3000/sdk/paystack-checkout.js"></script>

<button id="buyButton">Subscribe - $9.99/mo</button>

<script>
  const pss = new PaystackStripe({ backendUrl: 'http://localhost:3000' });

  document.getElementById('buyButton').onclick = async () => {
    const session = await pss.createCheckoutSession({
      mode: 'subscription',
      subscription_interval: 'monthly',
      line_items: [{ name: 'Pro Plan', amount: 9.99, currency: 'USD' }]
    });

    pss.openModal({
      sessionId: session.id,
      onComplete: () => { window.location.href = '/thank-you'; }
    });
  };
</script>
```

---

## 🤖 Using With AI Coding Agents

If you are using **Cursor**, **Windsurf**, **Claude Code**, **GitHub Copilot**, or **Aider**, you don't need to write manual integration code.

Simply give your AI agent this prompt:

```markdown
Read the file `AGENT_INSTRUCTIONS.md` from the paystack-stripe gateway repository. 
Follow Recipe [A (Next.js) / B (Chrome Extension) / C (Mobile App)] to implement 
recurring subscriptions and one-time payments for this project. 
Ensure database models, checkout triggers, and webhook listeners follow the spec strictly.
```

Your AI agent will read [**`AGENT_INSTRUCTIONS.md`**](file:///C:/Users/Administrator/Documents/TECH/paystack_pg/AGENT_INSTRUCTIONS.md), parse the API contracts, and generate the exact code for your project!

---

## 🗄️ Database Schemas & Webhooks

### PostgreSQL / Supabase Schema

```sql
-- 1. Orders / Transactions
CREATE TABLE orders (
    id VARCHAR(100) PRIMARY KEY, -- cs_live_xxx / cs_test_xxx
    customer_email VARCHAR(255) NOT NULL,
    paystack_reference VARCHAR(100) UNIQUE NOT NULL,
    mode VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'open',
    payment_status VARCHAR(50) DEFAULT 'unpaid',
    base_currency VARCHAR(10) DEFAULT 'USD',
    base_amount NUMERIC(10, 2) NOT NULL,
    charged_currency VARCHAR(10) NOT NULL,
    charged_amount NUMERIC(15, 2) NOT NULL,
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 2. Subscriptions
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_email VARCHAR(255) NOT NULL,
    paystack_subscription_code VARCHAR(100) UNIQUE,
    paystack_plan_code VARCHAR(100) NOT NULL,
    plan_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- active, past_due, canceled
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL
);
```

### Webhook Event Handling (`POST /api/v1/webhooks/paystack`)

| Paystack Event | Description | Action Taken |
| :--- | :--- | :--- |
| `charge.success` | Card charged successfully | Mark order `paid`, unlock features or generate license key |
| `subscription.create` | Recurring subscription started | Store `paystack_subscription_code`, set status `active` |
| `subscription.disable` | Customer canceled renewal | Update status to `canceled` |
| `invoice.payment_failed` | Recurring billing charge failed | Update status to `past_due`, email customer |

*(Complete SQL, Prisma, and MongoDB schemas are in [**`docs/DATABASE_SCHEMAS.md`**](file:///C:/Users/Administrator/Documents/TECH/paystack_pg/docs/DATABASE_SCHEMAS.md)).*

---

<a id="️-security-audit--air-gapped-mode"></a>
*(For security defenses, PCI-DSS SAQ A compliance details, and air-gapped mode specifications, see [**🛡️ Security & PCI-DSS Compliance**](#️-security--pci-dss-compliance) near the top of this documentation).*

---

## 🧪 Testing with Paystack Test Cards

When testing with `sk_test_...` keys, use Paystack's official test credentials:

| Scenario | Card Number | Expiry | CVC | PIN / OTP |
| :--- | :---: | :---: | :---: | :---: |
| **Successful Payment** | `4084 0840 8408 4081` | Any future date | `408` | PIN: `1111` / OTP: `123456` |
| **Direct Card Decline** | `5123 4567 8901 2345` | Any future date | `123` | - |
| **Declined / Insufficient Funds** | `4084 0840 8408 4115` | Any future date | `408` | PIN: `1111` |

---

## 🚢 Production Deployment

### Quick Deploy to Railway / Render / VPS

1. Set Environment Variables on your hosting provider:
   - `PAYSTACK_SECRET_KEY` = `sk_live_...`
   - `PAYSTACK_PUBLIC_KEY` = `pk_live_...`
   - `BASE_URL` = `https://checkout.yourdomain.com`
   - `NODE_ENV` = `production`
2. Configure your Webhook URL in [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer):
   ```
   https://checkout.yourdomain.com/api/v1/webhooks/paystack
   ```
3. Test the webhook using Paystack's **"Test Webhook"** button.

---

## 📁 Project Structure

```
paystack_pg/
├── AGENT_INSTRUCTIONS.md         # Machine-actionable AI agent integration specification
├── README.md                     # Master documentation
├── LICENSE                       # MIT License (Free to use and modify)
├── setup.js                      # Beginner 1-click environment setup script
├── package.json                  # Dependencies & npm scripts
├── .env.example                  # Safe public environment template
├── .gitignore                    # Strict Git ignore (blocks secrets & customer data)
├── docs/
│   ├── COMPLIANCE_AND_SETTLEMENT.md # PCI-DSS SAQ A scope & Paystack USD settlement
│   ├── MULTIPLE_APPS_GUIDE.md    # Multi-app & dynamic pricing architecture
│   ├── INTEGRATION_GUIDE.md      # Web, Extension, Mobile & Static site guides
│   ├── DATABASE_SCHEMAS.md       # PostgreSQL, Prisma & MongoDB schemas
│   └── DEPLOYMENT_GUIDE.md       # Production hosting & webhook setup
├── src/
│   ├── config.js                 # Configuration, air-gapped toggle & rate limits
│   ├── server.js                 # Express server with Helmet & rate-limiting
│   ├── services/
│   │   ├── fxService.js          # Live FX engine with air-gapped fallback
│   │   ├── geoService.js         # Privacy-hardened proxy/locale country detection
│   │   ├── paystackService.js    # Timing-safe Paystack API & Plans integration
│   │   └── sessionStore.js       # Stripe-compatible checkout sessions store
│   └── routes/
│       ├── checkoutRoutes.js     # Validated checkout API (/sessions, /pay, /verify)
│       ├── currencyRoutes.js     # Currency list, rates & detection endpoints
│       └── webhookRoutes.js      # Paystack HMAC webhook listener
├── public/
│   ├── checkout.html             # Pixel-perfect Stripe Checkout UI
│   ├── success.html              # Minimalist Stripe receipt page
│   ├── cancel.html               # Cancellation / retry page
│   ├── checkout-mock.html        # Test mode simulator
│   ├── css/
│   │   └── checkout.css          # Authentic Stripe theme & tokens
│   ├── js/
│   │   └── checkout.js           # Single card element & dynamic brand detection
│   └── sdk/
│       └── paystack-checkout.js  # Embeddable SDK (modal overlay + redirect)
└── examples/
    ├── web-app-demo/             # Interactive SaaS pricing table demo
    └── chrome-extension-demo/    # Complete Manifest V3 Chrome Extension demo
```

---

## 📄 License
Released under the [MIT License](LICENSE).  
You are free to use, modify, distribute, sublicense, and sell this software in both personal and commercial projects without restriction.

yours M-A-U