# AI AGENT IMPLEMENTATION SPECIFICATION 🤖
> **For AI Coding Agents (Cursor, Windsurf, Claude Code, Copilot, Aider, Antigravity)**  
> **Directive:** Read this document completely to integrate the **Paystack-Stripe Gateway** into the host project. Follow the architecture patterns, API contracts, and security rules strictly.

---

## 1. System Overview

You are integrating a **Stripe-compatible payment gateway** powered by **Paystack** with **real-time multi-currency conversion**.
- **Base Currency:** Products are priced in USD (e.g., `$9.99/mo`, `$49.00`).
- **Target Audience:** International users (USA, China, Europe, UK, etc.).
- **Crucial Rule:** Never leak NGN / Naira or settlement conversion rates to international buyers. International users must only see native prices (`$`, `¥`, `€`, `£`).
- **Settlement:** Handled under the hood via Paystack (NGN or USD).
- **Payment Modes Supported:**
  - `mode: 'payment'` (One-time purchase, lifetime license, tokens).
  - `mode: 'subscription'` (Recurring monthly / annual recurring billing).

---

## 2. Gateway API Contract

Base Gateway URL: Configured via `PAYSTACK_GATEWAY_URL` (e.g., `http://localhost:3000` or production URL).

### Endpoint 1: Create Checkout Session
`POST {PAYSTACK_GATEWAY_URL}/api/v1/checkout/sessions`

**Request Payload (JSON):**
```json
{
  "mode": "subscription", // "subscription" | "payment"
  "subscription_interval": "monthly", // "monthly" | "annually" (if mode is subscription)
  "line_items": [
    {
      "name": "Pro Subscription",
      "description": "Full access to premium features",
      "amount": 9.99,
      "currency": "USD",
      "quantity": 1
    }
  ],
  "customer_email": "user@example.com",
  "customer_name": "Alex Smith",
  "success_url": "https://myapp.com/success?session_id={CHECKOUT_SESSION_ID}",
  "cancel_url": "https://myapp.com/pricing",
  "metadata": {
    "userId": "usr_12345",
    "planTier": "pro"
  }
}
```

**Response (JSON):**
```json
{
  "id": "cs_live_9f8a2c...",
  "object": "checkout.session",
  "status": "open",
  "payment_status": "unpaid",
  "mode": "subscription",
  "url": "https://gateway.com/checkout.html?sessionId=cs_live_9f8a2c...",
  "amount_total": 9.99,
  "currency": "USD"
}
```

### Endpoint 2: Check Session Status (Polling / Verification)
`GET {PAYSTACK_GATEWAY_URL}/api/v1/checkout/sessions/:sessionId/status`

**Response (JSON):**
```json
{
  "status": true,
  "sessionId": "cs_live_9f8a2c...",
  "paymentStatus": "paid", // "paid" | "unpaid"
  "sessionStatus": "complete",
  "paidAt": "2026-09-28T12:00:00.000Z",
  "customerEmail": "user@example.com"
}
```

### Endpoint 3: Webhook Receiver (Paystack -> Your Gateway)
`POST {PAYSTACK_GATEWAY_URL}/api/v1/webhooks/paystack`  
Header: `x-paystack-signature` (HMAC SHA512)

---

## 3. Implementation Recipes (AI: Choose matching stack)

```
┌─────────────────────────────────────────────────────────────┐
│ SELECT RECIPE FOR HOST APP:                                 │
│ ├─ A: Next.js (App Router / Server Actions)                │
│ ├─ B: React / Vue / SPA + Express Backend                   │
│ ├─ C: Chrome Extension (Manifest V3)                       │
│ └─ D: Mobile App (React Native / Expo / Flutter)            │
└─────────────────────────────────────────────────────────────┘
```

---

### RECIPE A: Next.js (App Router & Server Actions)

#### Step 1: Create Server Action `app/actions/checkout.ts`
```typescript
'use server';

export async function createCheckoutSession(plan: 'monthly' | 'lifetime', userEmail: string, userId: string) {
  const GATEWAY_URL = process.env.PAYSTACK_GATEWAY_URL || 'http://localhost:3000';
  const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3001';

  const isSub = plan === 'monthly';

  const res = await fetch(`${GATEWAY_URL}/api/v1/checkout/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: isSub ? 'subscription' : 'payment',
      subscription_interval: isSub ? 'monthly' : undefined,
      line_items: [
        {
          name: isSub ? 'Pro Subscription' : 'Lifetime License',
          amount: isSub ? 9.99 : 49.00,
          currency: 'USD',
          quantity: 1
        }
      ],
      customer_email: userEmail,
      success_url: `${APP_URL}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${APP_URL}/pricing`,
      metadata: { userId, plan }
    })
  });

  const session = await res.json();
  if (!session.url) throw new Error(session.error || 'Failed to initialize session');
  return session; // Returns { id, url }
}
```

#### Step 2: Trigger in UI `app/pricing/page.tsx`
```tsx
'use client';
import { createCheckoutSession } from '@/app/actions/checkout';

export default function PricingCard({ userEmail, userId }: { userEmail: string; userId: string }) {
  const handleUpgrade = async () => {
    const session = await createCheckoutSession('monthly', userEmail, userId);
    // Redirect to the Stripe-styled checkout page
    window.location.href = session.url;
  };

  return (
    <button 
      onClick={handleUpgrade}
      className="bg-[#635BFF] hover:bg-[#5046E5] text-white py-3 px-6 rounded-lg font-semibold"
    >
      Upgrade to Pro ($9.99/mo)
    </button>
  );
}
```

---

### RECIPE B: Chrome Extension (Manifest V3)

> **Agent Warning:** Never store Paystack secret keys in extension code. Manifest files are publicly inspectable.

#### Step 1: `popup.js` (Launch Checkout)
```javascript
const GATEWAY_URL = 'https://your-production-gateway.com';

async function launchExtensionCheckout(userEmail) {
  const res = await fetch(`${GATEWAY_URL}/api/v1/checkout/sessions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'subscription',
      subscription_interval: 'monthly',
      line_items: [{ name: 'Extension Pro', amount: 4.99, currency: 'USD' }],
      customer_email: userEmail,
      metadata: { extensionId: chrome.runtime.id }
    })
  });

  const session = await res.json();
  if (session.url) {
    // 1. Store session ID for verification on return
    await chrome.storage.local.set({ pendingSessionId: session.id, userEmail });
    // 2. Open tab
    chrome.tabs.create({ url: session.url });
  }
}
```

#### Step 2: `background.js` (Verify Activation)
```javascript
// Poll status when user returns or on tab complete
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('/success.html')) {
    const { pendingSessionId } = await chrome.storage.local.get(['pendingSessionId']);
    if (pendingSessionId) {
      const res = await fetch(`${GATEWAY_URL}/api/v1/checkout/sessions/${pendingSessionId}/status`);
      const data = await res.json();
      if (data.status && data.paymentStatus === 'paid') {
        await chrome.storage.local.set({ isPro: true });
        console.log('Pro features unlocked!');
      }
    }
  }
});
```

---

### RECIPE C: Mobile Apps (React Native / Expo)

#### Use `expo-web-browser` and Deep Linking:
```tsx
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export async function openMobileCheckout(email: string) {
  const returnUrl = Linking.createURL('payment-complete');

  const res = await fetch('https://your-gateway.com/api/v1/checkout/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mode: 'subscription',
      line_items: [{ name: 'Mobile Pro', amount: 9.99, currency: 'USD' }],
      customer_email: email,
      success_url: `${returnUrl}?session_id={CHECKOUT_SESSION_ID}`
    })
  });

  const session = await res.json();
  const result = await WebBrowser.openAuthSessionAsync(session.url, returnUrl);

  if (result.type === 'success' && result.url) {
    const { queryParams } = Linking.parse(result.url);
    return queryParams?.session_id; // Verify against backend
  }
  return null;
}
```

---

## 4. Database Schema Requirements

When persisting payments, the AI agent must implement or adapt these schemas:

### PostgreSQL / Supabase
```sql
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    paystack_subscription_code VARCHAR(100) UNIQUE,
    plan_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active' | 'canceled' | 'past_due'
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Prisma ORM
```prisma
model Subscription {
  id                       String   @id @default(uuid())
  userId                   String
  customerEmail            String
  paystackSubscriptionCode String?  @unique
  planName                 String
  status                   String   @default("active")
  currentPeriodEnd         DateTime
  createdAt                DateTime @default(now())
}
```

---

## 5. Webhook Handling Logic (CRITICAL)

The AI Agent must ensure the webhook listener executes the following state transitions:

```javascript
// POST /api/v1/webhooks/paystack
switch (event.event) {
  case 'charge.success':
    // 1. Find user by customer email or metadata.userId
    // 2. Mark order as paid
    // 3. If mode is one-time, generate and save license key
    break;

  case 'subscription.create':
    // Save paystack_subscription_code, set status = 'active'
    break;

  case 'subscription.disable':
    // Customer canceled -> set status = 'canceled'
    break;

  case 'invoice.payment_failed':
    // Card renewal failed -> set status = 'past_due', notify user
    break;
}
```

---

## 6. Strict AI Guardrails & Checklist

1. **NO NAIRA EXPOSURE:** Do NOT render NGN symbols or text to foreign customers. The client UI must always display the customer's native currency (USD, CNY, EUR, etc.).
2. **ENVIRONMENT VARIABLES:**
   - Store gateway URL in `.env`: `PAYSTACK_GATEWAY_URL=...`
   - Store Paystack Secret in Gateway `.env`: `PAYSTACK_SECRET_KEY=sk_...`
3. **IDEMPOTENCY:** Webhook handling must be idempotent. If Paystack sends the same `charge.success` event twice, do not duplicate records.
4. **REDIRECT URLs:** Always replace `{CHECKOUT_SESSION_ID}` dynamically in `success_url`.
