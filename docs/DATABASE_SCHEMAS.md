# Database Schema & Data Modeling Guide 🗄️

When building apps, extensions, or websites with recurring subscriptions and one-time payments, your database needs to track 4 key entities:
1. **Users** (Accounts)
2. **Checkout Sessions / Orders** (Transactions)
3. **Subscriptions** (Recurring billing state)
4. **Licenses** (For extensions, desktop tools, and lifetime purchases)

---

## 1. PostgreSQL / Supabase Schema (SQL)

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    paystack_customer_code VARCHAR(100), -- e.g. CUS_xxxxxxxx
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. CHECKOUT SESSIONS & ORDERS TABLE
CREATE TABLE orders (
    id VARCHAR(100) PRIMARY KEY, -- Stripe session ID: cs_live_xxx / cs_test_xxx
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    customer_email VARCHAR(255) NOT NULL,
    paystack_reference VARCHAR(100) UNIQUE NOT NULL,
    mode VARCHAR(50) NOT NULL, -- 'payment' (one-time) or 'subscription'
    status VARCHAR(50) DEFAULT 'open', -- 'open', 'complete', 'expired'
    payment_status VARCHAR(50) DEFAULT 'unpaid', -- 'unpaid', 'paid', 'failed'
    
    -- Currency & Pricing
    base_currency VARCHAR(10) DEFAULT 'USD',
    base_amount NUMERIC(10, 2) NOT NULL, -- e.g. 19.99
    charged_currency VARCHAR(10) NOT NULL, -- e.g. NGN or USD
    charged_amount NUMERIC(15, 2) NOT NULL, -- e.g. 26500.00
    
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- 3. RECURRING SUBSCRIPTIONS TABLE
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    
    -- Paystack Subscription Identifiers
    paystack_subscription_code VARCHAR(100) UNIQUE, -- e.g. SUB_xxxxxxxx
    paystack_plan_code VARCHAR(100) NOT NULL,       -- e.g. PLN_xxxxxxxx
    paystack_customer_code VARCHAR(100),
    paystack_authorization_code VARCHAR(100),    -- reusable card authorization token
    
    plan_name VARCHAR(100) NOT NULL, -- 'pro_monthly', 'team_annual'
    interval VARCHAR(50) NOT NULL,   -- 'monthly', 'annually'
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled'
    
    current_period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    current_period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    canceled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. LICENSES TABLE (For Chrome Extensions & Lifetime Purchases)
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    customer_email VARCHAR(255) NOT NULL,
    license_key VARCHAR(100) UNIQUE NOT NULL, -- e.g. PRO-XXXX-XXXX-XXXX
    order_id VARCHAR(100) REFERENCES orders(id),
    
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'revoked', 'expired'
    device_limit INT DEFAULT 3,
    activated_devices JSONB DEFAULT '[]'::jsonb, -- array of { deviceId, platform, lastSeen }
    expires_at TIMESTAMP WITH TIME ZONE, -- NULL for lifetime, date for annual
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lightning fast lookups
CREATE INDEX idx_orders_ref ON orders(paystack_reference);
CREATE INDEX idx_orders_email ON orders(customer_email);
CREATE INDEX idx_subs_user ON subscriptions(user_id);
CREATE INDEX idx_subs_status ON subscriptions(status);
CREATE INDEX idx_licenses_key ON licenses(license_key);
```

---

## 2. Prisma ORM Schema (`schema.prisma`)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id                    String         @id @default(uuid())
  email                 String         @unique
  fullName              String?
  paystackCustomerCode  String?
  orders                Order[]
  subscriptions         Subscription[]
  licenses              License[]
  createdAt             DateTime       @default(now())
  updatedAt             DateTime       @updatedAt
}

model Order {
  id                String    @id // cs_test_... or cs_live_...
  userId            String?
  user              User?     @relation(fields: [userId], references: [id])
  customerEmail     String
  paystackReference String    @unique
  mode              String    // "payment" | "subscription"
  status            String    @default("open")
  paymentStatus     String    @default("unpaid") // "paid"
  baseCurrency      String    @default("USD")
  baseAmount        Float
  chargedCurrency   String
  chargedAmount     Float
  metadata          Json?
  paidAt            DateTime?
  licenses          License[]
  createdAt         DateTime  @default(now())
}

model Subscription {
  id                       String    @id @default(uuid())
  userId                   String
  user                     User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  customerEmail            String
  paystackSubscriptionCode String?   @unique
  paystackPlanCode         String
  paystackAuthCode         String?
  planName                 String
  interval                 String    // "monthly" | "annually"
  status                   String    @default("active") // "active" | "canceled" | "past_due"
  currentPeriodStart       DateTime
  currentPeriodEnd         DateTime
  canceledAt               DateTime?
  createdAt                DateTime  @default(now())
  updatedAt                DateTime  @updatedAt
}

model License {
  id               String    @id @default(uuid())
  userId           String?
  user             User?     @relation(fields: [userId], references: [id])
  customerEmail    String
  licenseKey       String    @unique
  orderId          String?
  order            Order?    @relation(fields: [orderId], references: [id])
  status           String    @default("active")
  deviceLimit      Int       @default(3)
  activatedDevices Json      @default("[]")
  expiresAt        DateTime? // null = Lifetime
  createdAt        DateTime  @default(now())
}
```

---

## 3. MongoDB / Mongoose Models

```javascript
// models/Subscription.js
import mongoose from 'mongoose';

const SubscriptionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  customerEmail: { type: String, required: true, index: true },
  paystackSubscriptionCode: { type: String, unique: true, sparse: true },
  paystackPlanCode: { type: String, required: true },
  paystackAuthCode: { type: String },
  planName: { type: String, default: 'Pro' },
  interval: { type: String, enum: ['monthly', 'annually'], default: 'monthly' },
  status: { type: String, enum: ['active', 'past_due', 'canceled'], default: 'active' },
  currentPeriodEnd: { type: Date, required: true },
  canceledAt: { type: Date }
}, { timestamps: true });

export const Subscription = mongoose.model('Subscription', SubscriptionSchema);
```

---

## 4. How Webhooks Automatically Update the DB

```javascript
// Example webhook handler logic (Node.js)
switch (event.event) {
  case 'charge.success': {
    const { reference, customer, plan, authorization } = event.data;
    
    // 1. Mark order paid
    await prisma.order.update({
      where: { paystackReference: reference },
      data: { paymentStatus: 'paid', paidAt: new Date() }
    });

    // 2. If it's a one-time license purchase, generate key
    const order = await prisma.order.findUnique({ where: { paystackReference: reference } });
    if (order.mode === 'payment') {
      await prisma.license.create({
        data: {
          customerEmail: customer.email,
          licenseKey: `PRO-${crypto.randomBytes(4).toString('hex').toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
          orderId: order.id
        }
      });
    }
    break;
  }

  case 'subscription.create': {
    const { subscription_code, plan, customer, next_payment_date } = event.data;
    await prisma.subscription.upsert({
      where: { paystackSubscriptionCode: subscription_code },
      update: {
        status: 'active',
        currentPeriodEnd: new Date(next_payment_date)
      },
      create: {
        customerEmail: customer.email,
        paystackSubscriptionCode: subscription_code,
        paystackPlanCode: plan.plan_code,
        planName: plan.name,
        interval: plan.interval,
        status: 'active',
        currentPeriodStart: new Date(),
        currentPeriodEnd: new Date(next_payment_date)
      }
    });
    break;
  }

  case 'subscription.disable': {
    const { subscription_code } = event.data;
    await prisma.subscription.update({
      where: { paystackSubscriptionCode: subscription_code },
      data: { status: 'canceled', canceledAt: new Date() }
    });
    break;
  }
}
```
