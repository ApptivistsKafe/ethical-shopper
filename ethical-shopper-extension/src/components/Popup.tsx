import React, { useEffect, useState } from 'react';
import { generateAIResponse } from '../services/aiService';
import { isCheckoutPage } from '../services/checkoutDetector'; // Import the detector
import { alternativesPrompt } from '../constants/prompts'; // Import the alternatives prompt

// Define interfaces for the expected AI response structure
interface AlternativeProducts {
  name: string;
  thumbnail: string; // URL of the product image
  company: string; // Selling site
  brand: string;
  price: string;
  ethicalStatus: string; // Description of ethics
  ethicalAlternatives?: CompanyAlternative[]; // More ethical companies
  comparableProducts?: EthicalProduct[]; // Specific product alternatives
  purchaseLink?: string; // Added for comparable products
}

interface CompanyAlternative {
  name: string;
  logoThumbnail: string; // URL of the company logo
  reasoning: string; // Why they are considered more ethical
}

interface EthicalProduct {
  name: string;
  thumbnail: string; // URL of the product image
  company: string;
  brand: string;
  price: string;
  purchaseLink: string;
}


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
  const [aiLoading, setAiLoading] = useState(false); // For the generic AI prompt
  const [isPaused, setIsPaused] = useState<boolean>(false); // State for pause toggle
  const [showAlternatives, setShowAlternatives] = useState(false); // Control visibility of alternatives section
  const [alternativesLoading, setAlternativesLoading] = useState(false); // Loading state for alternatives
  const [alternativesData, setAlternativesData] = useState<AlternativeProducts[] | null>(null); // Store parsed alternatives
  const [alternativesError, setAlternativesError] = useState<string | null>(null); // Error state for alternatives fetch

  // Effect to load initial pause state (only in popup context)
  useEffect(() => {
    if (!isContentScriptContext && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['extensionPaused'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting pause state:', chrome.runtime.lastError);
        } else {
          setIsPaused(!!result.extensionPaused); // Default to false if not set
        }
      });
    }
  }, [isContentScriptContext]);

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
      // Get the current page's HTML content
      const pageHtml = document.documentElement.outerHTML;
      const response = await generateAIResponse(prompt, pageHtml);
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

  // Handler for the pause toggle
  const handlePauseToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPauseState = event.target.checked;
    setIsPaused(newPauseState);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      // Send message to background to update storage
      chrome.runtime.sendMessage({ type: 'SET_PAUSE_STATE', paused: newPauseState }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error setting pause state:', chrome.runtime.lastError.message);
          // Optionally revert UI state or show error
        } else if (!response?.success) {
          console.error('Background script failed to set pause state.');
          // Optionally revert UI state or show error
        } else {
          console.log('Pause state updated successfully.');
        }
      });
    } else {
      console.warn('Cannot send pause state message: Chrome runtime not available.');
    }
  };

  // Handler for the "Show Alternatives" button
  const handleShowAlternativesClick = async () => {
    setShowAlternatives(true); // Show the alternatives section immediately
    setAlternativesLoading(true);
    setAlternativesData(null);
    setAlternativesError(null);
    setAiResponse(null); // Clear generic AI response if shown

    try {
      const pageHtml = document.documentElement.outerHTML;
      // Use the specific alternativesPrompt
      const rawResponse = await generateAIResponse(alternativesPrompt, pageHtml);

      if (!rawResponse) {
        throw new Error('Received empty response from AI.');
      }

      // Attempt to parse the JSON response
      try {
        // Find the start and end of the JSON array/object
        const jsonStart = rawResponse.indexOf('[');
        const jsonEnd = rawResponse.lastIndexOf(']');
        let jsonData: AlternativeProducts[];

        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonString = rawResponse.substring(jsonStart, jsonEnd + 1);
          jsonData = JSON.parse(jsonString);
           // Basic validation (check if it's an array)
          if (!Array.isArray(jsonData)) {
            throw new Error('AI response is not a valid JSON array.');
          }
          setAlternativesData(jsonData);
        } else {
           // Handle cases where the response might be a single object or malformed
           // Try parsing as an object if array markers aren't found
           const objectStart = rawResponse.indexOf('{');
           const objectEnd = rawResponse.lastIndexOf('}');
           if (objectStart !== -1 && objectEnd !== -1) {
               const jsonString = rawResponse.substring(objectStart, objectEnd + 1);
               const singleProduct = JSON.parse(jsonString);
               // Wrap single object in an array if needed, or handle appropriately
               // For now, assume the prompt *should* return an array as requested.
               // If it's consistently an object, the prompt/type needs adjustment.
               console.warn("AI returned a single object, expected array. Wrapping.");
               setAlternativesData([singleProduct]); // Example: wrap it
           } else {
               throw new Error('Could not find valid JSON array or object markers in the AI response.');
           }
        }


      } catch (parseError) {
        console.error('Error parsing AI JSON response:', parseError, 'Raw response:', rawResponse);
        throw new Error('Failed to parse ethical alternatives data from AI.');
      }

    } catch (error: any) {
      console.error('Error fetching alternatives:', error);
      setAlternativesError(error.message || 'Failed to fetch ethical alternatives. Please try again.');
      setAlternativesData(null); // Ensure data is null on error
    } finally {
      setAlternativesLoading(false);
    }
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

      {/* Pause Toggle - only shown in popup context */}
      {!isContentScriptContext && (
        <div className="pause-toggle" style={{ paddingBottom: '10px', borderBottom: '1px solid #eee', marginBottom: '10px' }}>
          <label htmlFor="pause-switch" style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <input
              type="checkbox"
              id="pause-switch"
              checked={isPaused}
              onChange={handlePauseToggle}
              style={{ marginRight: '8px' }}
            />
            <span>{isPaused ? 'Extension Paused' : 'Extension Active'}</span>
          </label>
        </div>
      )}

      {/* Conditional content based on checkout status */}
      {isCheckout ? (
        <div className="checkout-detected">
          <h2>Checkout Detected!</h2>

          {/* Hide generic AI prompt when alternatives are shown/loading */}
          {!showAlternatives && (
            <>
              <p>Ask our AI about this product or company:</p>
              <div className="ai-section">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="e.g., Is this company ethical?"
                  className="ai-input"
                  disabled={aiLoading}
                  rows={3}
                  aria-label="AI prompt input"
                />
                <button
                  className="secondary-button" // Changed style
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
              <hr className="separator" />
              <p>Or, let us find ethical alternatives for you:</p>
            </>
          )}

          {/* Show Alternatives Button - always visible if checkout detected, unless loading alternatives */}
           {!alternativesLoading && (
             <button
               className="primary-button show-alternatives-button"
               onClick={handleShowAlternativesClick}
               disabled={alternativesLoading} // Disable while loading alternatives
             >
               {showAlternatives ? 'Refresh Alternatives' : 'Show Ethical Alternatives'}
             </button>
           )}


          {/* Alternatives Section */}
          {showAlternatives && (
            <div className="alternatives-section">
              {alternativesLoading && (
                <div className="spinner">Loading alternatives...</div> // Simple spinner text for now
              )}
              {alternativesError && (
                <div className="error-message">{alternativesError}</div>
              )}
              {alternativesData && !alternativesLoading && (
                <div className="alternatives-results">
                  <h3>Ethical Analysis & Alternatives</h3>
                  {alternativesData.length === 0 && <p>No specific products identified on this page for analysis.</p>}
                  {alternativesData.map((product, index) => (
                    <div key={index} className="original-product-analysis">
                      <h4>Original Product: {product.name || 'Unknown Product'}</h4>
                      <p><strong>Brand:</strong> {product.brand || 'N/A'}</p>
                      <p><strong>Sold By:</strong> {product.company || 'N/A'}</p>
                      <p><strong>Price:</strong> {product.price || 'N/A'}</p>
                      <p><strong>Ethical Status:</strong> {product.ethicalStatus || 'No information available.'}</p>

                      {product.comparableProducts && product.comparableProducts.length > 0 && (
                        <div className="ethical-alternatives-list">
                          <h5>Suggested Ethical Alternatives:</h5>
                          {product.comparableProducts.map((alt, altIndex) => (
                            // Make the entire div a clickable link if purchaseLink exists
                            <a
                              key={altIndex}
                              href={alt.purchaseLink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="alternative-product-link" // New class for styling the link block
                            >
                              <div className="alternative-product"> {/* Keep inner div for structure */}
                                {alt.thumbnail && (
                                  <img src={alt.thumbnail} alt={alt.name} className="alternative-thumbnail" />
                                )}
                                <div className="alternative-details">
                                  <p><strong>{alt.name}</strong></p>
                                  <p>Brand: {alt.brand}, Sold By: {alt.company}</p>
                                  <p>Price: {alt.price}</p>
                                </div>
                              </div>
                            </a>
                          ))}
                        </div>
                      )}
                       {!product.comparableProducts || product.comparableProducts.length === 0 && (
                         <p><em>No specific alternative products found.</em></p>
                       )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
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