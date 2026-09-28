import express from 'express';
import { paystackService } from '../services/paystackService.js';
import { sessionStore } from '../services/sessionStore.js';

const router = express.Router();

/**
 * POST /api/v1/webhooks/paystack
 * Paystack webhook handler
 */
router.post('/paystack', (req, res) => {
  const signature = req.headers['x-paystack-signature'];
  const rawBody = req.rawBody || JSON.stringify(req.body);

  // 1. Verify Webhook Signature
  if (!paystackService.verifyWebhookSignature(rawBody, signature)) {
    console.warn('[Webhook] Invalid Paystack signature received');
    return res.status(400).send('Invalid signature');
  }

  const event = req.body;
  console.log(`[Webhook Received] Event: ${event.event}`);

  try {
    switch (event.event) {
      case 'charge.success': {
        const data = event.data;
        const reference = data.reference;
        const sessionId = data.metadata?.sessionId;

        console.log(`[Webhook] Charge succeeded for ref=${reference}, session=${sessionId}, amount=${data.amount}`);

        let session = null;
        if (sessionId) {
          session = sessionStore.get(sessionId);
        }
        if (!session && reference) {
          session = sessionStore.getByReference(reference);
        }

        if (session) {
          sessionStore.markPaid(session.id, {
            paystackReference: reference,
            amount: data.amount,
            currency: data.currency,
            channel: data.channel,
            customer: data.customer,
            authorization: data.authorization,
            plan: data.plan
          });
          console.log(`[Webhook] Marked session ${session.id} as paid!`);
        }
        break;
      }

      case 'subscription.create': {
        console.log(`[Webhook] Subscription created: code=${event.data.subscription_code}, customer=${event.data.customer?.email}`);
        break;
      }

      case 'subscription.disable': {
        console.log(`[Webhook] Subscription cancelled/disabled: code=${event.data.subscription_code}`);
        break;
      }

      case 'invoice.payment_failed': {
        console.warn(`[Webhook] Subscription renewal payment failed: ${event.data.subscription?.subscription_code}`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.event}`);
    }

    // Acknowledge receipt to Paystack
    res.status(200).json({ received: true });
  } catch (err) {
    console.error('[Webhook Error]', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

export default router;
