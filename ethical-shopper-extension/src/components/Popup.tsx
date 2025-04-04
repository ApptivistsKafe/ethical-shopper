import React, { useEffect, useState } from 'react';
import { generateAIResponse } from '../services/aiService';
import { isCheckoutPage } from '../services/checkoutDetector'; // Import the detector

interface PopupProps {
  isCheckoutForTesting?: boolean;
  isContentScriptContext?: boolean; // Flag for content script context
  onDismiss?: () => void; // Optional dismiss handler
}

export const Popup: React.FC<PopupProps> = ({ isCheckoutForTesting, isContentScriptContext, onDismiss }) => {
  const [isCheckout, setIsCheckout] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const checkCurrentPage = async () => {
      setLoading(true);
      setError(null); // Reset error on check

      // If running in content script context, check directly
      if (isContentScriptContext) {
        try {
          const result = await isCheckoutPage(window.location.href, document); // Await the promise
          setIsCheckout(result);
        } catch (err) {
          setError('Error checking page status.');
          setIsCheckout(false);
        } finally {
          setLoading(false);
        }
        return; // Don't proceed with chrome.tabs logic
      }

      // --- Original Popup Context Logic ---
      if (isCheckoutForTesting !== undefined) {
        setIsCheckout(isCheckoutForTesting);
        setLoading(false);
        return;
      }

      // Check if chrome.tabs is available (robustness check)
      if (typeof chrome === 'undefined' || !chrome.tabs) {
          console.error("chrome.tabs API is not available in this context.");
          setError("Cannot check page status from this context.");
          setIsCheckout(false);
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
              // Don't assume it's not a checkout page, maybe the content script isn't injected yet or failed
              // setError(`Error communicating with page: ${chrome.runtime.lastError.message}`);
              // Keep isCheckout as null or handle appropriately, maybe retry? For now, set to false.
              setIsCheckout(false);
            } else {
              setIsCheckout(response?.isCheckout ?? false);
            }
            setLoading(false);
          }
        );
      } catch (error) {
        setError('Error checking page status.');
        setIsCheckout(false);
        setLoading(false);
      }
    };

    checkCurrentPage();
  }, [isCheckoutForTesting, isContentScriptContext]); // Add isContentScriptContext to dependency array

  const handleAiSubmit = async () => {
    if (!prompt.trim()) return;
    
    setAiLoading(true);
    try {
      const response = await generateAIResponse(prompt);
      setAiResponse(response);
      setError(null);
    } catch (error) {
      setError('Failed to generate response. Please try again.');
      console.error('Error getting AI response:', error);
      setAiResponse('Sorry, there was an error generating the response. Please try again.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) handleAiSubmit();
  };
  if (loading) {
    return (
      <div className="popup">
        <p>Checking page...</p>
      </div>
    );
  }

  // Refactored return to have a single parent div.popup
  return (
    <div className="popup" style={{ position: 'relative' }}> {/* Added relative positioning for absolute child */}
      {/* Dismiss Button - only shown in content script context */}
      {isContentScriptContext && onDismiss && (
        <button
          onClick={onDismiss}
          aria-label="Dismiss"
          style={{
            position: 'absolute',
            top: '5px',
            right: '5px',
            background: 'transparent',
            border: 'none',
            fontSize: '16px',
            lineHeight: '1',
            cursor: 'pointer',
            padding: '2px 5px',
            color: '#666', // Adjust color as needed
          }}
        >
          &times; {/* HTML entity for 'x' */}
        </button>
      )}

      {/* Conditional content based on checkout status */}
      {isCheckout ? (
        <div className="checkout-detected">
          <h2>Checkout Detected!</h2>
          <p>Would you like to see ethical alternatives?</p>
          <div className="ai-section">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask about ethical alternatives..."
              className="ai-input"
              disabled={aiLoading}
              rows={3}
              maxLength={500}
              aria-label="AI prompt input"
            />
            <button
              className="primary-button"
              onClick={handleAiSubmit}
              disabled={aiLoading || !prompt.trim()}
            >
              {aiLoading ? 'Thinking...' : 'Ask AI'}
            </button>
            {error && (
              <div className="error-message">
                {error}
              </div>
            )}
            {aiResponse && (
              <div className="ai-response" role="region" aria-label="AI response">{aiResponse}</div>
            )}
          </div>
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
          {/* Optionally show something different or nothing if not checkout in content script */}
          {/* {isContentScriptContext && <p>(This message is from the content script)</p>} */}
        </div>
      )}
    </div>
  );
};