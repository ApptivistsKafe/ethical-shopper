import { isCheckoutPage } from '../services/checkoutDetector';

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_CHECKOUT') {
    // Execute immediately and handle response
    (async () => {
      const result = await isCheckoutPage(window.location.href, document);
      sendResponse({ isCheckout: result });
    })().catch(error => sendResponse({ isCheckout: false, error: error.message }));

    // Return true to indicate we will respond asynchronously
    return true;
  }
});