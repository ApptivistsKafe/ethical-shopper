import React, { useEffect, useState } from 'react';
import { generateAIResponse } from '../services/aiService';
import { isCheckoutPage } from '../services/checkoutDetector'; // Import the detector

interface PopupProps {
  isCheckoutForTesting?: boolean;
  isContentScriptContext?: boolean; // Flag for content script context
}

export const Popup: React.FC<PopupProps> = ({ isCheckoutForTesting, isContentScriptContext }) => {
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
          console.log('Popup (Content Script): Checking current page directly...');
          const result = await isCheckoutPage(window.location.href, document); // Await the promise
          console.log('Popup (Content Script): Direct check result:', result);
          setIsCheckout(result);
        } catch (err) {
          console.error('Popup (Content Script): Error during direct checkout check:', err);
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
        console.log('Popup (Extension Popup): Querying active tab...');
        // Get the active tab
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id || !tab?.url) {
          console.log('Popup (Extension Popup): No active tab found or missing ID/URL.');
          setIsCheckout(false);
          setLoading(false);
          return;
        }
        console.log('Popup (Extension Popup): Found active tab:', tab.id, tab.url);

        // Send message to content script to check if it's a checkout page
        console.log('Popup (Extension Popup): Sending CHECK_CHECKOUT message to tab:', tab.id);
        chrome.tabs.sendMessage(
          tab.id,
          { type: 'CHECK_CHECKOUT' },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Popup (Extension Popup): Error receiving message:', chrome.runtime.lastError.message);
              // Don't assume it's not a checkout page, maybe the content script isn't injected yet or failed
              // setError(`Error communicating with page: ${chrome.runtime.lastError.message}`);
              // Keep isCheckout as null or handle appropriately, maybe retry? For now, set to false.
              setIsCheckout(false);
            } else {
              console.log('Popup (Extension Popup): Received response:', response);
              setIsCheckout(response?.isCheckout ?? false);
            }
            setLoading(false);
          }
        );
      } catch (error) {
        console.error('Popup (Extension Popup): Error checking page:', error);
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

  return (
    <div className="popup">
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
        </div>
      )}
    </div>
  );
};