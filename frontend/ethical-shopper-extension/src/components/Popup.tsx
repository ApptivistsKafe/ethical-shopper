import '../style.css';
import React, { useEffect, useState, useCallback } from 'react';
import {
    callAIModel,
    processHtmlForAI,
    AIResponse,
} from '../services/aiService';
import { isCheckoutPage } from '../services/checkoutDetector';
import { productIdentificationPrompt, ethicalAlternativesPrompt } from '../constants/prompts';

// --- Interfaces for AI Responses (matching prompts.ts) ---
interface IdentifiedProduct {
  name: string;
  brand: string;
  company: string; // Selling site
  price: string;
  thumbnail: string; // URL of the product image
}

interface CompanyAlternative {
  name: string;
  logoThumbnail: string; // URL of the company logo
  reasoning: string; // Why they are considered more ethical
}

interface EthicalProduct {
  name: string;
  thumbnail: string; // URL of the product image
  company: string; // Selling site for the alternative
  brand: string;
  price: string;
  purchaseLink: string; // Link to buy the alternative
  description: string;
  url: string;
  title: string;
}

export type EthicalAnalysisResult = {
  name: string;
  brand: string;
  company: string; // Selling site
  price: number;
  thumbnail: string; // URL of the product image
  purchaseLink: string; // Link to buy the alternative
  ethicalStatus: string; // Description of original product/company ethics
  title: string;
  description: string;
  url: string;
}[];

// --- Component Props ---
interface PopupProps {
  isCheckoutForTesting?: boolean;
  isContentScriptContext?: boolean;
  onDismiss?: () => void;
}

// --- Model Options ---
// --- Model Options ---
// Only include models explicitly requested by the user
const stepOneModels: string[] = ['google/gemini-2.0-flash-lite-001']; // Only Gemini Flash for Step 1
const stepTwoModels: string[] = ['google/gemini-2.0-flash-lite-001']; // Only O3 Mini and Grounded Gemini Flash for Step 2

export const Popup: React.FC<PopupProps> = ({ isCheckoutForTesting, isContentScriptContext, onDismiss }) => {
  // --- State ---
  const [isCheckout, setIsCheckout] = useState<boolean | null>(null);
  const [initialLoading, setInitialLoading] = useState(true); // For initial page check
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // Removed pageMarkdown state. Will process on demand.

  // Step 1 State
  const [selectedStepOneModel, setselectedStepOneModel] = useState<string>(stepOneModels[0]);
  const [stepOneLoading, setStepOneLoading] = useState(false);
  const [stepOneError, setStepOneError] = useState<string | null>(null);
  const [identifiedProduct, setIdentifiedProduct] = useState<IdentifiedProduct | null>(null);
  const [identifiedProductJson, setIdentifiedProductJson] = useState<string | null>(null); // Store raw JSON for step 2
  const [stepOneTimeMs, setStepOneTimeMs] = useState<number | null>(null);
  // Removed stepOneCost state

  // Step 2 State
  const [selectedStepTwoModel, setselectedStepTwoModel] = useState<string>(stepTwoModels[0]);
  const [stepTwoLoading, setStepTwoLoading] = useState(false);
  const [stepTwoError, setStepTwoError] = useState<string | null>(null);
  const [ethicalAnalysisResult, setEthicalAnalysisResult] = useState<EthicalAnalysisResult | null>([]);
  const [stepTwoTimeMs, setStepTwoTimeMs] = useState<number | null>(null);
  // Removed stepTwoCost state

  // --- Effects ---

  // Load pause state
  useEffect(() => {
    if (!isContentScriptContext && typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['extensionPaused'], (result) => {
        if (chrome.runtime.lastError) {
          console.error('Error getting pause state:', chrome.runtime.lastError);
        } else {
          setIsPaused(!!result.extensionPaused);
        }
      });
    }
  }, [isContentScriptContext]);

  // Check page and process HTML -> Markdown
  useEffect(() => {
    const checkAndProcessPage = async () => {
      setInitialLoading(true);
      setStepOneError(null); // Reset errors on page check
      setStepTwoError(null);
      setIdentifiedProduct(null);
      setEthicalAnalysisResult(null);
      // Removed pageMarkdown reset

      let checkoutStatus = false;
      let errorMsg: string | null = null;

      try {
        if (isContentScriptContext) {
          checkoutStatus = await isCheckoutPage(window.location.href, document);
        } else if (isCheckoutForTesting !== undefined) {
          checkoutStatus = isCheckoutForTesting;
        } else if (typeof chrome !== 'undefined' && chrome.tabs) {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) {
            // Use try-catch for sendMessage as it can throw if the tab/content script isn't ready
            try {
                const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_CHECKOUT' });
                checkoutStatus = response?.isCheckout ?? false;
            } catch (msgError) {
                console.warn("Could not message content script (might not be injected yet or on a restricted page):", msgError);
                checkoutStatus = false; // Assume not checkout if we can't communicate
            }
          }
        } else {
           errorMsg = "Cannot check page status from this context.";
        }

        setIsCheckout(checkoutStatus);

        // Removed HTML processing from initial check

      } catch (err: any) {
        console.error('Error checking/processing page:', err);
        errorMsg = `Error checking page status: ${err.message || String(err)}`;
        setIsCheckout(false);
      } finally {
        if (errorMsg) setStepOneError(errorMsg); // Show error in step 1 area
        setInitialLoading(false);
      }
    };

    checkAndProcessPage();
  }, [isCheckoutForTesting, isContentScriptContext]); // Re-run if context changes

  // --- Handlers ---

  const handlePauseToggle = (event: React.ChangeEvent<HTMLInputElement>) => {
    const newPauseState = event.target.checked;
    setIsPaused(newPauseState);
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SET_PAUSE_STATE', paused: newPauseState }, (response) => {
        if (chrome.runtime.lastError || !response?.success) {
          console.error('Error setting pause state:', chrome.runtime.lastError?.message || 'Background script failed.');
          // Optionally revert UI state or show error
        } else {
          console.log('Pause state updated successfully.');
        }
      });
    } else {
      console.warn('Cannot send pause state message: Chrome runtime not available.');
    }
  };

  const handleRunStepOne = useCallback(async () => {
    // Get HTML and process it here, just before the call
    let currentMarkdown: string | null = null;
    try {
        const html = document.documentElement.outerHTML;
        currentMarkdown = processHtmlForAI(html);
        if (!currentMarkdown || currentMarkdown === "[Error processing page content]") {
             throw new Error("Failed to process page content.");
        }
    } catch (err: any) {
         setStepOneError(`Error processing page HTML: ${err.message}`);
         setStepOneLoading(false); // Ensure loading stops if processing fails
         return;
    }

    setStepOneLoading(true);
    setStepOneError(null);
    setIdentifiedProduct(null);
    setIdentifiedProductJson(null);
    setStepOneTimeMs(null);
    // Removed cost reset
    // Clear step 2 results as well
    setStepTwoLoading(false);
    setStepTwoError(null);
    setEthicalAnalysisResult(null);
    setStepTwoTimeMs(null);
    // Removed cost reset


    try {
        console.log(`Running Step 1 with model: ${selectedStepOneModel}`);
        const response: AIResponse = await callAIModel({
            step: 1,
            modelName: selectedStepOneModel,
            basePrompt: productIdentificationPrompt,
            pageMarkdown: currentMarkdown, // Use the just-processed markdown
        });
        console.log("Step 1 Response:", response);

        setStepOneTimeMs(response.timeMs);
        // Removed cost setting

        // Attempt to parse the JSON response for Step 1
        try {
            // Basic check for JSON structure before parsing
            const trimmedData = response.data.trim();
            if (trimmedData.startsWith('{') && trimmedData.endsWith('}')) {
                const parsedData: IdentifiedProduct = JSON.parse(trimmedData);
                // TODO: Add more robust validation if needed
                setIdentifiedProduct(parsedData);
                setIdentifiedProductJson(trimmedData); // Store raw JSON for step 2
            } else {
                 throw new Error('AI response for Step 1 is not a valid JSON object.');
            }
        } catch (parseError: any) {
            console.error('Error parsing Step 1 JSON response:', parseError, 'Raw response:', response.data);
            setStepOneError(`Failed to parse product data from AI: ${parseError.message}. Raw: ${response.data}`);
            setIdentifiedProduct(null);
            setIdentifiedProductJson(null);
        }

    } catch (error: any) {
        console.error('Error running Step 1:', error);
        setStepOneError(error.message || 'Failed to identify product.');
        setIdentifiedProduct(null);
        setIdentifiedProductJson(null);
    } finally {
        setStepOneLoading(false);
    }
  }, [selectedStepOneModel]); // Removed pageMarkdown from dependency array

  const handleRunStepTwo = useCallback(async () => {
    if (!identifiedProductJson) {
        setStepTwoError("Product must be identified in Step 1 first.");
        return;
    }
    setStepTwoLoading(true);
    setStepTwoError(null);
    setEthicalAnalysisResult(null);
    setStepTwoTimeMs(null);
     // Removed cost reset

    try {
        console.log(`Running Step 2 with model: ${selectedStepTwoModel}`);
        const response: AIResponse = await callAIModel({
            step: 2,
            modelName: selectedStepTwoModel,
            basePrompt: ethicalAlternativesPrompt,
            identifiedProductJson: identifiedProductJson,
        });
         console.log("Step 2 Response:", response);

        setStepTwoTimeMs(response.timeMs);
        // Removed cost setting

        // Attempt to parse the JSON response for Step 2
        try {
          if (response?.data) {
            setEthicalAnalysisResult(response.data as EthicalAnalysisResult);
          } else {
            setStepTwoError("No data received from AI for Step 2.");
            setEthicalAnalysisResult(null);
          }
        } catch (parseError: any) {
            console.error('Error parsing Step 2 JSON response:', parseError, 'Raw response:', response.data);
            setStepTwoError(`Failed to parse alternatives data from AI: ${parseError.message}. Raw: ${response?.data}`);
            setEthicalAnalysisResult(null);
        }

    } catch (error: any) {
        console.error('Error running Step 2:', error);
        setStepTwoError(error.message || 'Failed to find alternatives.');
        setEthicalAnalysisResult(null);
    } finally {
        setStepTwoLoading(false);
    }
  }, [identifiedProductJson, selectedStepTwoModel]);


  // --- Render Helper ---
  const renderTime = (timeMs: number | null) => {
      if (timeMs === null) return null;
      return (
          <div className="perf-info">
              <span>Time: {(timeMs / 1000).toFixed(2)}s</span>
          </div>
      );
  };

  // --- Main Render ---

  if (initialLoading) {
    return (
      <div className="popup">
        <p>Checking page...</p>
      </div>
    );
  }

  return (
    <div className="popup" style={{ position: 'relative' }}>
      {/* Dismiss Button */}
      {isContentScriptContext && onDismiss && (
        <button onClick={onDismiss} aria-label="Dismiss" className="dismiss-button">&times;</button>
      )}

      {/* Pause Toggle */}
      {!isContentScriptContext && (
        <div className="pause-toggle">
          <label htmlFor="pause-switch">
            <input
              type="checkbox"
              id="pause-switch"
              checked={isPaused}
              onChange={handlePauseToggle}
            />
            <span>{isPaused ? 'Extension Paused' : 'Extension Active'}</span>
          </label>
        </div>
      )}

      {/* Main Content */}
      {isCheckout ? (
        <div className="checkout-detected">
          <h2>Ethical Shopper Analysis</h2>

          {/* --- Step 1: Product Identification --- */}
          <div className="step-section">
            <h3>Step 1: Identify Product</h3>
            <div className="model-selector">
                <label htmlFor="step1-model">Model: </label>
                <select
                    id="step1-model"
                    value={selectedStepOneModel}
                    onChange={(e) => setselectedStepOneModel(e.target.value as string)}
                    disabled={stepOneLoading || stepTwoLoading}
                >
                    {stepOneModels.map(model => <option key={model} value={model}>{model}</option>)}
                </select>
            </div>
            <button
                className="primary-button"
                onClick={handleRunStepOne}
                disabled={stepOneLoading || stepTwoLoading} // Button is enabled once initial check is done if it's a checkout page
            >
                {stepOneLoading ? 'Identifying...' : 'Identify Product'}
            </button>

            {stepOneLoading && <div className="spinner">Running Step 1...</div>}
            {stepOneError && <div className="error-message">{stepOneError}</div>}
            {renderTime(stepOneTimeMs)}

            {identifiedProduct && !stepOneLoading && (
                <div className="step-result identified-product">
                    <h4>Identified Product:</h4>
                    <div className="product-card">
                         {identifiedProduct.thumbnail && (
                            <img src={identifiedProduct.thumbnail} alt={identifiedProduct.name} className="product-thumbnail-small" />
                         )}
                         <div className="product-details-small">
                            <p><strong>Name:</strong> {identifiedProduct.name || 'N/A'}</p>
                            <p><strong>Brand:</strong> {identifiedProduct.brand || 'N/A'}</p>
                            <p><strong>Seller:</strong> {identifiedProduct.company || 'N/A'}</p>
                            <p><strong>Price:</strong> {identifiedProduct.price || 'N/A'}</p>
                         </div>
                    </div>
                </div>
            )}
          </div>

          <hr className="separator" />

          {/* --- Step 2: Ethical Alternatives --- */}
          <div className="step-section">
            <h3>Step 2: Find Ethical Alternatives</h3>
             <div className="model-selector">
                <label htmlFor="step2-model">Model: </label>
                <select
                    id="step2-model"
                    value={selectedStepTwoModel}
                    onChange={(e) => setselectedStepTwoModel(e.target.value as string)}
                    disabled={stepOneLoading || stepTwoLoading || !identifiedProduct}
                >
                    {stepTwoModels.map(model => <option key={model} value={model}>{model}</option>)}
                </select>
            </div>
            <button
                className="primary-button"
                onClick={handleRunStepTwo}
                disabled={!identifiedProduct || stepOneLoading || stepTwoLoading} // Disabled until step 1 is complete
            >
                {stepTwoLoading ? 'Searching...' : 'Find Alternatives'}
            </button>

            {stepTwoLoading && <div className="spinner">Running Step 2...</div>}
            {stepTwoError && <div className="error-message">{stepTwoError}</div>}
            {renderTime(stepTwoTimeMs)}

            {ethicalAnalysisResult && ethicalAnalysisResult.length > 0 && !stepTwoLoading && (
              <div className="step-result alternatives-section">
                <h4>Ethical Analysis & Alternatives:</h4>
                {ethicalAnalysisResult.map((result, index) => (
                  <div key={index} className="ethical-product">
                    <h5>{result.name}</h5>
                    <img src={result.thumbnail} alt={result.name} style={{ width: '100px', height: '100px' }} />
                    <p>Brand: {result.brand}</p>
                    <p>Company: {result.company}</p>
                    <p>Price: {result.price}</p>
                    <p>Ethical Status: {result.ethicalStatus}</p>
                    <p>Title: {result.title}</p>
                    <p>Description: {result.description}</p>
                    <a href={result.url} target="_blank" rel="noopener noreferrer">
                      Product URL
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

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