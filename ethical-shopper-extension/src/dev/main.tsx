import React from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from '../components/Popup';
import '../styles.scss';

// Create simple dev version that shows both states
const DevApp = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Development Preview</h1>
      
      <h2>Checkout Detected State:</h2>
      <div style={{ marginBottom: '20px' }}>
        <Popup isCheckoutForTesting={true} />
      </div>

      <h2>Non-Checkout State:</h2>
      <div>
        <Popup isCheckoutForTesting={false} />
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

const root = createRoot(rootElement);
root.render(
  <React.StrictMode>
    <DevApp />
  </React.StrictMode>
);