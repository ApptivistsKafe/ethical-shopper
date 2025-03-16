import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Popup } from '../components/Popup';
import '../styles.scss';
import { isCheckoutPage } from '../services/checkoutDetector';

// Create simple dev version that shows both states
const DevApp = () => {
  const [url, setUrl] = useState('amazon.com/checkouts');
  const [formHtml, setFormHtml] = useState('<form>checkout</form>');
  const [isCheckout, setIsCheckout] = useState(false);
  const [hasChecked, setHasChecked] = useState(false);
  
  const checkUrl = async () => {
    // Create a mock document with the form HTML
    const parser = new DOMParser();
    const mockDoc = parser.parseFromString(formHtml, 'text/html');
    
    const result = await isCheckoutPage(url, mockDoc);
    setIsCheckout(result);
    setHasChecked(true);
  };

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
      
      <h2>Test Checkout Detection:</h2>
      <div style={{ marginTop: '20px', marginBottom: '20px' }}>
        <div style={{ marginBottom: '10px' }}>
          <label htmlFor="url" style={{ display: 'block', marginBottom: '5px' }}>URL to test:</label>
          <input
            id="url"
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            style={{ width: '100%', padding: '5px' }}
            placeholder="Enter URL (e.g. https://amazon.com/checkout)"
          />
        </div>
        
        <div style={{ marginBottom: '10px' }}>
          <form>
          <label htmlFor="form" style={{ display: 'block', marginBottom: '5px' }}>HTML content (optional):</label>
          <textarea
            id="form"
            value={formHtml}
            onChange={(e) => setFormHtml(e.target.value)}
            style={{ width: '100%', height: '100px', padding: '5px' }}
            placeholder="Enter HTML content to test DOM-based detection (e.g. <form action='/checkout'><input type='email' name='email'><input type='tel' name='phone'></form>)"
          />
          </form>
        </div>
        
        <button onClick={checkUrl} style={{ marginBottom: '10px' }}>Test Detection</button>
        
        {hasChecked && <div style={{ marginTop: '20px' }}>
          <Popup isCheckoutForTesting={isCheckout} />
        </div>}
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