# Production Deployment & Webhook Setup Guide 🚀

Follow these steps to deploy your **Paystack-Stripe Gateway** to production and configure Paystack webhooks.

---

## 1. Production Checklist

Before switching to live payments:
- [ ] Replace `sk_test_...` and `pk_test_...` with your **Live Paystack Keys** (`sk_live_...` and `pk_live_...`).
- [ ] Set `NODE_ENV=production`.
- [ ] Update `BASE_URL` to your production domain (e.g. `https://checkout.yourdomain.com`).
- [ ] Ensure HTTPS is enabled (required for modern browser payment APIs and webhooks).
- [ ] Register your Webhook URL in the Paystack Dashboard.

---

## 2. Deploying the Backend Server

### Option A: Railway (Recommended - Fastest)
1. Push your code to a private GitHub repository.
2. Log into [Railway.app](https://railway.app) and click **"New Project"** -> **"Deploy from GitHub repo"**.
3. Select your repository.
4. Add your Environment Variables in Railway's Variables tab:
   - `PAYSTACK_SECRET_KEY` = `sk_live_...`
   - `PAYSTACK_PUBLIC_KEY` = `pk_live_...`
   - `BASE_URL` = `https://your-app.up.railway.app`
   - `DEFAULT_BASE_CURRENCY` = `USD`
   - `MERCHANT_SETTLEMENT_CURRENCY` = `NGN`
   - `MERCHANT_NAME` = `"Your Brand Name"`
5. Railway deploys and provides an instant HTTPS domain!

### Option B: Render.com
1. Create a **New Web Service** connected to your repository.
2. Runtime: **Node**.
3. Build Command: `npm install`.
4. Start Command: `npm start`.
5. Add the environment variables from your `.env`.

### Option C: Docker Container
A `Dockerfile` is provided:

```dockerfile
FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

Build and run:
```bash
docker build -t paystack-stripe-gateway .
docker run -p 3000:3000 --env-file .env paystack-stripe-gateway
```

---

## 3. Configuring Paystack Webhooks

Webhooks ensure that even if a user closes their browser window before redirecting, their subscription or license is instantly activated in your database.

1. Go to your [Paystack Dashboard](https://dashboard.paystack.com/#/settings/developer).
2. Click **API Keys & Webhooks**.
3. In the **Live Webhook URL** (or Test Webhook URL) field, paste:
   ```
   https://your-domain.com/api/v1/webhooks/paystack
   ```
4. Click **Save Changes**.
5. Click **"Test Webhook"** — Paystack will send a sample payload to verify your endpoint returns HTTP 200 OK.

---

## 4. Switching Between Test and Live Modes

- When using `sk_test_...`, all transactions run against Paystack's sandbox (no real cards charged).
- When using `sk_live_...`, real Visa, Mastercard, Verve, and international cards are charged and settled into your Nigerian bank account or domiciliary account.
- The UI automatically adapts, preserving the clean Stripe look and feel with live currency conversion for every customer worldwide.
