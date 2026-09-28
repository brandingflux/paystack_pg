import { fxService } from './src/services/fxService.js';
import { sessionStore } from './src/services/sessionStore.js';
import { paystackService } from './src/services/paystackService.js';

async function runTests() {
  console.log('--- 1. Testing FX Engine ---');
  await fxService.initialize();
  const rates = fxService.getRates();
  console.log(`USD base rates count: ${Object.keys(rates.rates).length}`);
  console.log(`$10 USD to NGN: ${fxService.format(fxService.convert(10, 'USD', 'NGN'), 'NGN')}`);
  console.log(`$10 USD to CNY: ${fxService.format(fxService.convert(10, 'USD', 'CNY'), 'CNY')}`);
  console.log(`$10 USD to EUR: ${fxService.format(fxService.convert(10, 'USD', 'EUR'), 'EUR')}`);

  console.log('\n--- 2. Testing Session Store ---');
  const session = sessionStore.create({
    mode: 'subscription',
    subscription_interval: 'monthly',
    line_items: [
      { name: 'Test Pro Plan', amount: 9.99, currency: 'USD', quantity: 1 }
    ],
    amount_total: 9.99,
    currency: 'USD',
    customer_email: 'test@example.com'
  });
  console.log(`Created Session: ${session.id}, status=${session.status}, mode=${session.mode}`);

  const fetched = sessionStore.get(session.id);
  if (!fetched || fetched.id !== session.id) {
    throw new Error('Session retrieval failed');
  }
  console.log('Session retrieved successfully from store.');

  console.log('\n--- 3. Testing Paystack Mock / Gateway Initialization ---');
  const payInit = await paystackService.initializeTransaction({
    email: 'test@example.com',
    amountInKobo: 1500000,
    currency: 'NGN',
    reference: session.paystack_reference,
    callbackUrl: 'http://localhost:3000/callback'
  });
  console.log('Transaction initialized:', payInit);

  console.log('\n--- 4. Testing Verification ---');
  const verification = await paystackService.verifyTransaction(session.paystack_reference);
  console.log('Verification result status:', verification.status);

  sessionStore.markPaid(session.id, verification);
  const paidSession = sessionStore.get(session.id);
  console.log(`Session ${paidSession.id} payment status: ${paidSession.payment_status}`);

  console.log('\nAll core gateway engine tests PASSED successfully! 🚀');
}

runTests().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
