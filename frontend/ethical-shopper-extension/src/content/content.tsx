/// <reference types="chrome" />

import React from 'react';
import * as ReactDOM from 'react-dom/client';
import { Popup } from '../components/Popup'; // Import the main Popup component
import ShadowDOMWrapper from '../components/ShadowDOMWrapper'; // Import Shadow DOM wrapper
import { isCheckoutPage } from '../services/checkoutDetector'; // Import the detector
// Remove global styles import - styles will be injected into Shadow DOM

let rootElement: HTMLDivElement | null = null;
let reactRoot: ReactDOM.Root | null = null;

const injectPopup = () => {
  // Only create the element if it doesn't exist
  if (!rootElement) {
    rootElement = document.createElement('div');
    rootElement.id = 'ethical-shopper-root';
    // Remove inline styles - positioning will be handled by Shadow DOM wrapper
    document.body.appendChild(rootElement);
  }

  // Only create the root if it doesn't exist
  if (!reactRoot) {
    reactRoot = ReactDOM.createRoot(rootElement);
  }

  // Render the Popup component wrapped in Shadow DOM
  reactRoot.render(
    <React.StrictMode>
      <ShadowDOMWrapper
        style={{
          position: 'fixed',
          top: '10px',
          right: '10px',
          zIndex: '2147483647', // Maximum z-index to ensure it's on top
        }}
      >
        <Popup isContentScriptContext={true} onDismiss={dismissPopup} />
      </ShadowDOMWrapper>
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
