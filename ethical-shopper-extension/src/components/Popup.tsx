import React, { useEffect, useState } from 'react';
import { generateAIResponse } from '../services/aiService';

interface PopupProps {
  isCheckoutForTesting?: boolean;
}

export const Popup: React.FC<PopupProps> = ({ isCheckoutForTesting }) => {
  const [isCheckout, setIsCheckout] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

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