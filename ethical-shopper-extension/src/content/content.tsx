/// <reference types="chrome" />

import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Popup } from '../components/Popup'; // Import the main Popup component
import { isCheckoutPage } from '../services/checkoutDetector'; // Import the detector
import '../styles.scss'; // Import global styles

let rootElement: HTMLDivElement | null = null;
let reactRoot: ReactDOM.Root | null = null;

const injectPopup = () => {
  // Only create the element if it doesn't exist
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'ethical-shopper-root';
    rootElement.style.position = 'fixed'; // Use fixed to stay in viewport
    rootElement.style.top = '10px';
    rootElement.style.right = '10px';
    rootElement.style.zIndex = '9999'; // Ensure it's on top
    document.body.appendChild(rootElement);
  }

  // Only create the root if it doesn't exist
  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(rootElement);
  }

  // Render the Popup component into the root element
  reactRoot.render(
    <React.StrictMode>
      <Popup isContentScriptContext={true} onDismiss={dismissPopup} />
    </React.StrictMode>
  );
  console.log('Ethical Shopper content script injected Popup component.');
};

const dismissPopup = () => {
  if (reactRoot) {
    reactRoot.unmount(); // Unmount the React component
    reactRoot = null;
  }
  if (rootElement) {
    rootElement.remove(); // Remove the container element from the DOM
    rootElement = null;
  }
  console.log('Ethical Shopper content script dismissed Popup component.');
};

// Check pause state and then if it's a checkout page before injecting
const initialize = async () => {
  // Check if the extension is paused first
  if (typeof chrome !== 'undefined' && chrome.storage?.local) {
    try {
      const result = await new Promise<{ extensionPaused?: boolean }>((resolve, reject) => {
        chrome.storage.local.get(['extensionPaused'], (res) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(res);
          }
        });
      });

      if (result.extensionPaused) {
        console.log('Ethical Shopper: Extension is paused, content script inactive.');
        // Ensure any existing popup is removed if the extension was just paused
        dismissPopup();
        return; // Stop execution if paused
      }
    } catch (error) {
      console.error('Ethical Shopper: Error getting pause state:', error);
      // Decide if we should proceed or stop if state is unknown. Let's proceed for now.
    }
  } else {
    console.warn('Ethical Shopper: Cannot check pause state - chrome.storage.local not available.');
  }

  // If not paused, proceed with checkout check
  try {
    const isCheckout = await isCheckoutPage(window.location.href, document);
    if (isCheckout) {
      console.log('Ethical Shopper: Checkout page detected, injecting Popup.');
      injectPopup();
    } else {
      console.log('Ethical Shopper: Not a checkout page, not injecting Popup.');
      // Ensure any existing popup is removed if navigation changes state
      dismissPopup();
    }
  } catch (error) {
    console.error('Ethical Shopper: Error checking checkout status:', error);
    // Ensure cleanup if error occurs
    dismissPopup();
  }
};

// Run the initialization logic
initialize();

// Optional: Listen for potential SPA navigation changes if needed
// This is basic; a more robust solution might use MutationObserver or specific framework events
// window.addEventListener('popstate', initialize);
// window.addEventListener('hashchange', initialize);