import React, { useEffect, useState } from 'react';

interface PopupProps {
  isCheckoutForTesting?: boolean;
}

export const Popup: React.FC<PopupProps> = ({ isCheckoutForTesting }) => {
  const [isCheckout, setIsCheckout] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkCurrentPage = async () => {
      if (isCheckoutForTesting !== undefined) {
        setIsCheckout(isCheckoutForTesting);
        setLoading(false);
        return;
      }

      try {
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.url) return;

        // Check if it's a checkout page
        const result = await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          func: (url) => {
            console.log(url);
            return document.location.href.includes('checkout');  // Simplified for dev
          },
          args: [tab.url]
        });

        setIsCheckout(result[0]?.result ?? false);
      } catch (error) {
        console.error('Error checking page:', error);
        setIsCheckout(false);
      } finally {
        setLoading(false);
      }
    };

    checkCurrentPage();
  }, [isCheckoutForTesting]);

  if (loading) {
    return (
      <div className="popup">
        <p>Checking page...</p>
      </div>
    );
  }

  return (
    <div className="popup">
      {isCheckout ? (
        <div className="checkout-detected">
          <h2>Checkout Detected!</h2>
          <p>Would you like to see ethical alternatives?</p>
          <button 
            className="primary-button"
            onClick={() => {
              // TODO: Implement showing alternatives
              console.log('Show alternatives clicked');
            }}
          >
            Show Alternatives
          </button>
        </div>
      ) : (
        <div className="no-checkout">
          <h2>Not a Checkout Page</h2>
          <p>Keep browsing and we'll notify you when you're ready to checkout!</p>
        </div>
      )}
    </div>
  );
};