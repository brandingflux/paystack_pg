import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '../../data');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

class SessionStore {
  constructor() {
    this.sessions = new Map();
    this.ensureDataDir();
    this.loadSessions();
  }

  ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.warn('Could not create data dir:', e.message);
    }
  }

  loadSessions() {
    try {
      if (fs.existsSync(SESSIONS_FILE)) {
        const raw = fs.readFileSync(SESSIONS_FILE, 'utf8');
        const list = JSON.parse(raw);
        for (const s of list) {
          this.sessions.set(s.id, s);
        }
        console.log(`[SessionStore] Loaded ${this.sessions.size} sessions from disk.`);
      }
    } catch (e) {
      console.warn('[SessionStore] Could not load persisted sessions:', e.message);
    }
  }

  persistSessions() {
    try {
      const list = Array.from(this.sessions.values());
      fs.writeFileSync(SESSIONS_FILE, JSON.stringify(list.slice(-500), null, 2), 'utf8');
    } catch (e) {
      console.warn('[SessionStore] Failed to persist sessions:', e.message);
    }
  }

  /**
   * Create a new Stripe-style checkout session
   * @param {Object} data
   * @returns {Object}
   */
  create(data) {
    const isTest = !data.isLive;
    const prefix = isTest ? 'cs_test_' : 'cs_live_';
    const id = `${prefix}${crypto.randomBytes(16).toString('hex')}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24h expiration

    const session = {
      id,
      object: 'checkout.session',
      mode: data.mode || 'payment', // 'payment' | 'subscription'
      status: 'open',
      payment_status: 'unpaid',
      customer_email: data.customer_email || null,
      customer_name: data.customer_name || null,
      merchant_name: data.merchant_name || null,
      merchant_logo: data.merchant_logo || null,
      line_items: data.line_items || [],
      amount_total: data.amount_total || 0,
      currency: (data.currency || 'USD').toUpperCase(),
      success_url: data.success_url || null,
      cancel_url: data.cancel_url || null,
      metadata: data.metadata || {},
      subscription_interval: data.subscription_interval || 'monthly', // for mode: 'subscription'
      paystack_reference: data.paystack_reference || `ref_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`,
      all_references: [data.paystack_reference || `ref_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`],
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
      payment_details: null
    };

    this.sessions.set(id, session);
    this.persistSessions();
    return session;
  }

  get(id) {
    return this.sessions.get(id) || null;
  }

  getByReference(ref) {
    if (!ref) return null;
    const cleanRef = String(ref).trim();
    for (const session of this.sessions.values()) {
      if (session.paystack_reference === cleanRef) {
        return session;
      }
      if (Array.isArray(session.all_references) && session.all_references.includes(cleanRef)) {
        return session;
      }
    }
    return null;
  }

  findByEmail(email) {
    if (!email) return [];
    const normalized = String(email).trim().toLowerCase();
    const matches = [];
    for (const session of this.sessions.values()) {
      if (session.customer_email && session.customer_email.toLowerCase() === normalized) {
        matches.push(session);
      }
    }
    return matches;
  }

  update(id, partial) {
    const session = this.sessions.get(id);
    if (!session) return null;

    const allRefs = new Set(session.all_references || []);
    if (session.paystack_reference) allRefs.add(session.paystack_reference);
    if (partial.paystack_reference) allRefs.add(partial.paystack_reference);

    const updated = { 
      ...session, 
      ...partial,
      all_references: Array.from(allRefs)
    };
    this.sessions.set(id, updated);
    this.persistSessions();
    return updated;
  }

  markPaid(id, paymentDetails = {}) {
    return this.update(id, {
      status: 'complete',
      payment_status: 'paid',
      payment_details: paymentDetails,
      paid_at: new Date().toISOString()
    });
  }
}

export const sessionStore = new SessionStore();
