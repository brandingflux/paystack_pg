// Chrome Extension Background Service Worker
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Paystack-Stripe Extension Demo] Service Worker Installed.');
});

// Listen for tab updates (e.g. when user finishes checkout in the success tab)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url && tab.url.includes('/success.html?sessionId=')) {
    const url = new URL(tab.url);
    const sessionId = url.searchParams.get('sessionId');
    if (sessionId) {
      console.log('[Extension Background] Detected success page for session:', sessionId);
      await chrome.storage.local.set({ isPro: true, pendingSessionId: sessionId });
    }
  }
});
