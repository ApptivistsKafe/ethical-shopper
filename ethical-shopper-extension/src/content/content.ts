import { isCheckoutPage } from '../services/checkoutDetector';

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'CHECK_CHECKOUT') {
    isCheckoutPage(window.location.href, document)
      .then(result => {
        sendResponse({ isCheckout: result });
      })
      .catch(error => {
        console.error('Error checking checkout status:', error);
        sendResponse({ isCheckout: false, error: error.message });
      });
    return true; // Required for async response
  }
});