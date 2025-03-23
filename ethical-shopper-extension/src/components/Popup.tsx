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
        if (!tab?.id || !tab?.url) {
          setIsCheckout(false);
          setLoading(false);
          return;
        }

        // Send message to content script to check if it's a checkout page
        chrome.tabs.sendMessage(
          tab.id,
          { type: 'CHECK_CHECKOUT' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error:', chrome.runtime.lastError);
              setIsCheckout(false);
            } else {
              setIsCheckout(response?.isCheckout ?? false);
            }
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Error checking page:', error);
        setIsCheckout(false);
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