// Stripe Checkout Frontend Controller
(function() {
  const urlParams = new URLSearchParams(window.location.search);
  const sessionId = urlParams.get('sessionId');

  // DOM Elements
  const backBtn = document.getElementById('backBtn');
  const backBtnText = document.getElementById('backBtnText');
  const brandName = document.getElementById('brandName');
  const brandAvatar = document.getElementById('brandAvatar');
  const orderHeadline = document.getElementById('orderHeadline');
  const heroPrice = document.getElementById('heroPrice');
  const heroInterval = document.getElementById('heroInterval');
  const itemTitle = document.getElementById('itemTitle');
  const itemSubtitle = document.getElementById('itemSubtitle');
  const itemAmount = document.getElementById('itemAmount');
  const totalDueAmount = document.getElementById('totalDueAmount');
  const currencySelect = document.getElementById('currencySelect');
  
  const customerEmail = document.getElementById('customerEmail');
  const cardNumber = document.getElementById('cardNumber');
  const cardExpiry = document.getElementById('cardExpiry');
  const cardCvc = document.getElementById('cardCvc');
  const cardholderName = document.getElementById('cardholderName');
  const billingCountry = document.getElementById('billingCountry');
  const cardBrandIconSlot = document.getElementById('cardBrandIconSlot');
  
  const paymentForm = document.getElementById('stripePaymentForm');
  const submitPayBtn = document.getElementById('submitPayBtn');
  const btnSpinner = document.getElementById('btnSpinner');
  const btnLabel = document.getElementById('btnLabel');
  const expressLinkBtn = document.getElementById('expressLinkBtn');

  let sessionData = null;
  let currentPricing = null;
  let merchantConfig = null;

  if (!sessionId) {
    alert('No checkout session found.');
    return;
  }

  // Load Session and Currency Prices
  async function loadSession(selectedCurrency = null) {
    try {
      let url = `/api/v1/checkout/sessions/${sessionId}`;
      if (selectedCurrency) {
        url += `?currency=${selectedCurrency}`;
      }

      const res = await fetch(url);
      const data = await res.json();

      if (!data.status) {
        throw new Error(data.error || 'Failed to load session');
      }

      sessionData = data.session;
      currentPricing = data.pricing;
      merchantConfig = data.merchant;

      renderStripeCheckout();
    } catch (err) {
      console.error('Checkout error:', err);
    }
  }

  function renderStripeCheckout() {
    // 1. Merchant branding
    const name = merchantConfig?.name || 'Store';
    brandName.textContent = name;
    brandAvatar.textContent = name.charAt(0).toUpperCase();
    backBtnText.textContent = name;

    if (sessionData.cancel_url) {
      backBtn.href = sessionData.cancel_url;
    } else {
      backBtn.href = '#';
      backBtn.onclick = (e) => { e.preventDefault(); history.back(); };
    }

    // 2. Headings & Mode
    const isSub = sessionData.mode === 'subscription';
    orderHeadline.textContent = isSub ? 'Subscribe to' : 'Pay';

    // 3. Main Hero Price (100% in user's selected/detected currency, NO Naira)
    heroPrice.textContent = currentPricing.displayFormatted;
    if (isSub) {
      const rawInterval = (sessionData.subscription_interval || 'monthly').toLowerCase();
      const intervalMap = {
        hourly: { unit: 'hour', adverb: 'hourly' },
        daily: { unit: 'day', adverb: 'daily' },
        weekly: { unit: 'week', adverb: 'weekly' },
        monthly: { unit: 'month', adverb: 'monthly' },
        biannually: { unit: '6 months', adverb: 'biannually' },
        annually: { unit: 'year', adverb: 'annually' }
      };

      const info = intervalMap[rawInterval] || {
        unit: rawInterval.replace(/ly$/, ''),
        adverb: rawInterval.endsWith('ly') ? rawInterval : `${rawInterval}ly`
      };

      heroInterval.textContent = `/ ${info.unit}`;
      itemSubtitle.textContent = `Billed ${info.adverb}`;
    } else {
      heroInterval.textContent = '';
      itemSubtitle.textContent = 'One-time payment';
    }

    // 4. Line items
    const firstItem = sessionData.line_items[0] || {};
    itemTitle.textContent = firstItem.name || 'Pro Access';
    itemAmount.textContent = currentPricing.displayFormatted;
    totalDueAmount.textContent = currentPricing.displayFormatted;

    // 5. Currency picker sync
    if (currencySelect.value !== currentPricing.displayCurrency) {
      // If currency option exists in select, pick it
      const optionExists = Array.from(currencySelect.options).some(o => o.value === currentPricing.displayCurrency);
      if (optionExists) {
        currencySelect.value = currentPricing.displayCurrency;
      }
    }

    // 6. Billing country sync
    if (dataDetectedCountry = currentPricing.displayMeta?.country || sessionData.detectedCountry) {
      billingCountry.value = dataDetectedCountry;
    }

    // 7. Prefill customer details
    if (sessionData.customer_email && !customerEmail.value) {
      customerEmail.value = sessionData.customer_email;
    }
    if (sessionData.customer_name && !cardholderName.value) {
      cardholderName.value = sessionData.customer_name;
    }

    // 8. Submit button text
    updateSubmitButtonText();
  }

  function updateSubmitButtonText() {
    if (submitPayBtn.disabled) return;
    const isSub = sessionData?.mode === 'subscription';
    if (isSub) {
      btnLabel.textContent = `Subscribe`;
    } else {
      btnLabel.textContent = `Pay ${currentPricing?.displayFormatted || ''}`;
    }
  }

  // Currency select listener
  currencySelect.addEventListener('change', (e) => {
    loadSession(e.target.value);
  });

  // Card formatting and Brand Detection
  cardNumber.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '').substring(0, 16);
    // Format in blocks of 4
    let formatted = val.match(/.{1,4}/g)?.join(' ') || val;
    e.target.value = formatted;

    // Detect brand
    detectCardBrand(val);
  });

  // Expiry formatting MM / YY with seamless backspacing
  cardExpiry.addEventListener('keydown', (e) => {
    if (e.key === 'Backspace') {
      const val = cardExpiry.value;
      // If cursor is at the separator (e.g. "MM / "), cleanly delete into the month
      if (val.length === 5 && val.endsWith(' / ')) {
        e.preventDefault();
        cardExpiry.value = val.substring(0, 1);
      }
    }
  });

  cardExpiry.addEventListener('input', (e) => {
    let inputVal = e.target.value;
    
    // When deleting backward, let user backspace cleanly past separator
    if (e.inputType === 'deleteContentBackward') {
      if (inputVal.endsWith(' /') || inputVal.endsWith(' ')) {
        e.target.value = inputVal.replace(/\D+$/, '');
        return;
      }
    }

    let digits = inputVal.replace(/\D/g, '').substring(0, 4);

    // Auto-prefix months 2-9 with 0 (e.g. typing 4 -> 04 / )
    if (digits.length === 1 && parseInt(digits, 10) > 1 && e.inputType !== 'deleteContentBackward') {
      digits = '0' + digits;
    }

    if (digits.length >= 2) {
      let month = parseInt(digits.substring(0, 2), 10);
      if (month > 12) month = 12;
      if (month === 0) month = 1;
      const monthStr = String(month).padStart(2, '0');
      const yearStr = digits.substring(2);

      e.target.value = monthStr + ' / ' + yearStr;
    } else {
      e.target.value = digits;
    }
  });

  // CVC formatting
  cardCvc.addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').substring(0, 4);
  });

  function detectCardBrand(digits) {
    if (digits.startsWith('4')) {
      // Visa
      cardBrandIconSlot.innerHTML = `<svg class="brand-icon-svg" viewBox="0 0 36 24"><rect width="36" height="24" rx="3" fill="#1A1F71"/><text x="18" y="16" fill="white" font-size="11" font-weight="900" text-anchor="middle" font-style="italic">VISA</text></svg>`;
    } else if (/^(5[1-5]|2[2-7])/.test(digits)) {
      // Mastercard
      cardBrandIconSlot.innerHTML = `<svg class="brand-icon-svg" viewBox="0 0 36 24"><rect width="36" height="24" rx="3" fill="#0A2540"/><circle cx="14" cy="12" r="7" fill="#EB001B"/><circle cx="22" cy="12" r="7" fill="#F79E1B" fill-opacity="0.8"/></svg>`;
    } else if (/^3[47]/.test(digits)) {
      // Amex
      cardBrandIconSlot.innerHTML = `<svg class="brand-icon-svg" viewBox="0 0 36 24"><rect width="36" height="24" rx="3" fill="#0077A6"/><text x="18" y="16" fill="white" font-size="9" font-weight="900" text-anchor="middle">AMEX</text></svg>`;
    } else {
      // Default
      cardBrandIconSlot.innerHTML = `<svg class="brand-icon-svg" viewBox="0 0 36 24" fill="none"><rect width="36" height="24" rx="3" fill="#0A2540"/><circle cx="13" cy="12" r="6" fill="#8898AA" fill-opacity="0.6"/><circle cx="23" cy="12" r="6" fill="#8898AA" fill-opacity="0.4"/></svg>`;
    }
  }

  // Express Link button
  expressLinkBtn.addEventListener('click', () => {
    if (!customerEmail.value) {
      customerEmail.focus();
      return;
    }
    paymentForm.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
  });

  // Handle Form Submission
  paymentForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    setLoading(true);

    try {
      const email = customerEmail.value.trim();
      const name = cardholderName.value.trim() || customerEmail.value.split('@')[0];

      // Call backend to initialize transaction
      const res = await fetch(`/api/v1/checkout/sessions/${sessionId}/pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          displayCurrency: currencySelect.value
        })
      });

      const data = await res.json();
      if (!data.status) {
        throw new Error(data.error || 'Failed to initialize payment');
      }

      // Check if Paystack Popup is available and keys are set
      if (window.PaystackPop && merchantConfig.paystackPublicKey && !merchantConfig.isMockMode && data.accessCode) {
        const handler = window.PaystackPop.setup({
          key: merchantConfig.paystackPublicKey,
          access_code: data.accessCode,
          callback: function(response) {
            const finalRef = response.reference || response.trxref || data.reference;
            window.location.href = `/api/v1/checkout/sessions/${sessionId}/verify?reference=${encodeURIComponent(finalRef)}`;
          },
          onClose: function() {
            setLoading(false);
          }
        });
        handler.openIframe();
      } else {
        // Fallback to direct authorization URL
        window.location.href = data.authorizationUrl;
      }
    } catch (err) {
      alert('Checkout error: ' + err.message);
      setLoading(false);
    }
  });

  function setLoading(isLoading) {
    submitPayBtn.disabled = isLoading;
    if (isLoading) {
      btnSpinner.style.display = 'inline-block';
      btnLabel.textContent = 'Processing...';
    } else {
      btnSpinner.style.display = 'none';
      updateSubmitButtonText();
    }
  }

  // Load session immediately
  loadSession();
})();
