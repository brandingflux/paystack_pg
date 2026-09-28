// Chrome Extension Popup Script
const BACKEND_URL = 'http://localhost:3000';

document.addEventListener('DOMContentLoaded', async () => {
  const planBadge = document.getElementById('planBadge');
  const unpaidSection = document.getElementById('unpaidSection');
  const paidSection = document.getElementById('paidSection');
  const extPriceDisplay = document.getElementById('extPriceDisplay');
  const upgradeBtn = document.getElementById('upgradeBtn');
  const restoreBtn = document.getElementById('restoreBtn');
  const resetDemoBtn = document.getElementById('resetDemoBtn');

  // Check stored license
  const storage = await chrome.storage.local.get(['isPro', 'pendingSessionId', 'userEmail']);
  if (storage.isPro) {
    showProState();
  } else if (storage.pendingSessionId) {
    await checkSessionStatus(storage.pendingSessionId);
  }

  // Fetch localized pricing silently
  try {
    const detectRes = await fetch(`${BACKEND_URL}/api/v1/currencies/detect`);
    const detectData = await detectRes.json();
    const curr = detectData.currency || 'USD';

    const convRes = await fetch(`${BACKEND_URL}/api/v1/currencies/convert?amount=4.99&from=USD&to=${curr}`);
    const convData = await convRes.json();
    if (convData.formattedConverted) {
      extPriceDisplay.textContent = convData.formattedConverted;
    }
  } catch (e) {
    // Keep default $4.99
  }

  // Upgrade button
  upgradeBtn.onclick = async () => {
    upgradeBtn.disabled = true;
    upgradeBtn.textContent = 'Processing...';

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/checkout/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'subscription',
          subscription_interval: 'monthly',
          line_items: [
            {
              name: 'QuickExtension Pro',
              description: 'Unlimited access for Chrome Extension',
              amount: 4.99,
              currency: 'USD',
              quantity: 1
            }
          ],
          success_url: `${BACKEND_URL}/success.html?sessionId={CHECKOUT_SESSION_ID}`,
          cancel_url: `${BACKEND_URL}/cancel.html?sessionId={CHECKOUT_SESSION_ID}`,
          metadata: {
            app: 'quick_extension',
            extensionId: chrome.runtime?.id || 'demo'
          }
        })
      });

      const session = await res.json();
      if (session.url) {
        await chrome.storage.local.set({ pendingSessionId: session.id });
        chrome.tabs.create({ url: session.url });
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      upgradeBtn.disabled = false;
      upgradeBtn.textContent = 'Upgrade to Pro';
    }
  };

  // Restore purchase
  restoreBtn.onclick = async () => {
    const data = await chrome.storage.local.get(['pendingSessionId']);
    if (!data.pendingSessionId) {
      alert('No pending purchase found.');
      return;
    }
    restoreBtn.textContent = 'Verifying...';
    await checkSessionStatus(data.pendingSessionId, true);
    restoreBtn.textContent = 'Restore Purchase';
  };

  // Demo reset
  resetDemoBtn.onclick = async () => {
    await chrome.storage.local.clear();
    location.reload();
  };

  async function checkSessionStatus(sessionId, alertOnFail = false) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/checkout/sessions/${sessionId}/status`);
      const data = await res.json();
      if (data.status && data.paymentStatus === 'paid') {
        await chrome.storage.local.set({ isPro: true, userEmail: data.customerEmail });
        showProState();
        if (alertOnFail) alert('Pro membership verified successfully.');
      } else {
        if (alertOnFail) alert('Payment not detected yet.');
      }
    } catch (e) {
      if (alertOnFail) alert('Could not reach gateway server.');
    }
  }

  function showProState() {
    planBadge.textContent = 'Pro Active';
    planBadge.className = 'status-badge active-pro';
    unpaidSection.style.display = 'none';
    paidSection.style.display = 'block';
  }
});
