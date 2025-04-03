import React from 'react';
import * as ReactDOM from 'react-dom/client';
import {Popup from '../components/Popup'; // Import the main Popup component
import '../styles.scss'; // Import global styles

// Create a root element in the host page
const rootElement = document.createElement('div');
rootElement.id = 'ethical-shopper-root';
rootElement.style.position = 'fixed'; // Use fixed to stay in viewport
rootElement.style.top = '10px';
rootElement.style.right = '10px';
rootElement.style.zIndex = '9999'; // Ensure it's on top
document.body.appendChild(rootElement);

// Render the Popup component into the root element
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Popup />
  </React.StrictMode>
);

console.log('Ethical Shopper content script loaded and Popup component injected.');