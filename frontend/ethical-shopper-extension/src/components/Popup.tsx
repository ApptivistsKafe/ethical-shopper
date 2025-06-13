import '../style.css';
import '@mantine/core/styles.css';
import React, { useEffect, useState, useCallback } from 'react';
import { callAIModel, processHtmlForAI, AIResponse } from '../services/aiService';
import { isCheckoutPage } from '../services/checkoutDetector';
import { productIdentificationPrompt, ethicalAlternativesPrompt } from '../constants/prompts';
import { createTheme, MantineProvider, Group } from '@mantine/core';
import ProductDisplay from './ProductDisplay';
import { Product } from '../types'; // Import the Product interface

// EthicalAnalysisResult will now directly use the Product interface
export type EthicalAnalysisResult = Product[];

// --- Component Props ---
interface PopupProps {
  isCheckoutForTesting?: boolean;
  isContentScriptContext?: boolean;
  onDismiss?: () => void;
}

const theme = createTheme({
  /** Put your mantine theme override here */
});

// --- Model Options ---
// --- Model Options ---
// Only include models explicitly requested by the user
const stepOneModels: string[] = ['google/gemini-2.0-flash-lite-001']; // Only Gemini Flash for Step 1
const stepTwoModels: string[] = ['google/gemini-2.0-flash-lite-001']; // Only O3 Mini and Grounded Gemini Flash for Step 2

export const Popup: React.FC<PopupProps> = ({
  isCheckoutForTesting,
  isContentScriptContext,
  onDismiss,
}) => {
  // --- State ---
  const [isCheckout, setIsCheckout] = useState<boolean | null>(null);
  const [initialLoading, setInitialLoading] = useState(true); // For initial page check
  const [isPaused, setIsPaused] = useState<boolean>(false);
  // Removed pageMarkdown state. Will process on demand.

  // Step 1 State
  const [selectedStepOneModel, setselectedStepOneModel] = useState<string>(stepOneModels[0]);
  const [stepOneLoading, setStepOneLoading] = useState(false);
  const [stepOneError, setStepOneError] = useState<string | null>(null);
  const [identifiedProduct, setProduct] = useState<Product | null>(null);
  const [identifiedProductJson, setProductJson] = useState<string | null>(null); // Store raw JSON for step 2
  const [stepOneTimeMs, setStepOneTimeMs] = useState<number | null>(null);
  // Removed stepOneCost state

  // Step 2 State
  const [selectedStepTwoModel, setselectedStepTwoModel] = useState<string>(stepTwoModels[0]);
  const [stepTwoLoading, setStepTwoLoading] = useState(false);
  const [stepTwoError, setStepTwoError] = useState<string | null>(null);
  const [ethicalAnalysisResult, setEthicalAnalysisResult] = useState<EthicalAnalysisResult | null>(
    []
  );
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
      setProduct(null);
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
              console.warn(
                'Could not message content script (might not be injected yet or on a restricted page):',
                msgError
              );
              checkoutStatus = false; // Assume not checkout if we can't communicate
            }
          }
        } else {
          errorMsg = 'Cannot check page status from this context.';
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
          console.error(
            'Error setting pause state:',
            chrome.runtime.lastError?.message || 'Background script failed.'
          );
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
      if (!currentMarkdown || currentMarkdown === '[Error processing page content]') {
        throw new Error('Failed to process page content.');
      }
    } catch (err: any) {
      setStepOneError(`Error processing page HTML: ${err.message}`);
      setStepOneLoading(false); // Ensure loading stops if processing fails
      return;
    }

    setStepOneLoading(true);
    setStepOneError(null);
    setProduct(null);
    setProductJson(null);
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
      console.log('Step 1 Response:', response);

      setStepOneTimeMs(response.timeMs);
      // Removed cost setting

      // Attempt to parse the JSON response for Step 1
      try {
        const parsedData: Product = JSON.parse(response.data as unknown as string);
        // Ensure price is a number
        const productWithParsedPrice: Product = {
          ...parsedData,
          price: parseFloat(parsedData.price as unknown as string), // Convert to number
        };
        setProduct(productWithParsedPrice);
        setProductJson(response.data as unknown as string); // Store raw JSON for step 2
      } catch (parseError: any) {
        console.error(
          'Error parsing Step 1 JSON response:',
          parseError,
          'Raw response:',
          response.data
        );
        setStepOneError(
          `Failed to parse product data from AI: ${parseError.message}. Raw: ${response.data}`
        );
        setProduct(null);
        setProductJson(null);
      }
    } catch (error: any) {
      console.error('Error running Step 1:', error);
      setStepOneError(error.message || 'Failed to identify product.');
      setProduct(null);
      setProductJson(null);
    } finally {
      setStepOneLoading(false);
    }
  }, [selectedStepOneModel]); // Removed pageMarkdown from dependency array

  const handleRunStepTwo = useCallback(async () => {
    if (!identifiedProductJson) {
      setStepTwoError('Product must be identified in Step 1 first.');
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
      console.log('Step 2 Response:', response);

      setStepTwoTimeMs(response.timeMs);
      // Removed cost setting

      // Attempt to parse the JSON response for Step 2
      try {
        if (response?.data) {
          setEthicalAnalysisResult(response.data as EthicalAnalysisResult);
        } else {
          setStepTwoError('No data received from AI for Step 2.');
          setEthicalAnalysisResult(null);
        }
      } catch (parseError: any) {
        console.error(
          'Error parsing Step 2 JSON response:',
          parseError,
          'Raw response:',
          response.data
        );
        setStepTwoError(
          `Failed to parse alternatives data from AI: ${parseError.message}. Raw: ${response?.data}`
        );
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

  // --- Main Render ---

  return (
    <MantineProvider theme={theme}>
      <div className="popup" style={{ position: 'relative' }}>
        {/* Dismiss Button */}
        {isContentScriptContext && onDismiss && (
          <button onClick={onDismiss} aria-label="Dismiss" className="dismiss-button">
            &times;
          </button>
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
              <Group style={{ marginBottom: '10px' }}>
                <label htmlFor="step1-model">Model: </label>
                <select
                  id="step1-model"
                  value={selectedStepOneModel}
                  onChange={(e) => setselectedStepOneModel(e.target.value as string)}
                  disabled={stepOneLoading || stepTwoLoading}
                >
                  {stepOneModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </Group>
              <button
                className="primary-button"
                onClick={handleRunStepOne}
                disabled={stepOneLoading || stepTwoLoading}
              >
                {stepOneLoading ? 'Identifying...' : 'Identify Product'}
              </button>

              {stepOneError && <div className="error-message">{stepOneError}</div>}
            </div>

            <hr className="separator" />

            {/* --- Step 2: Ethical Alternatives --- */}
            <div className="step-section">
              <h3>Step 2: Find Ethical Alternatives</h3>
              <Group style={{ marginBottom: '10px' }}>
                <label htmlFor="step2-model">Model: </label>
                <select
                  id="step2-model"
                  value={selectedStepTwoModel}
                  onChange={(e) => setselectedStepTwoModel(e.target.value as string)}
                  disabled={stepOneLoading || stepTwoLoading || !identifiedProduct}
                >
                  {stepTwoModels.map((model) => (
                    <option key={model} value={model}>
                      {model}
                    </option>
                  ))}
                </select>
              </Group>
              <button
                className="primary-button"
                onClick={handleRunStepTwo}
                disabled={!identifiedProduct || stepOneLoading || stepTwoLoading}
              >
                {stepTwoLoading ? 'Searching...' : 'Find Alternatives'}
              </button>

              {stepTwoError && <div className="error-message">{stepTwoError}</div>}
            </div>

            {/* Product Display Section */}
            <ProductDisplay
              products={ethicalAnalysisResult || []}
              loadingStep1={stepOneLoading || initialLoading}
              loadingStep2={stepTwoLoading}
              currentProduct={identifiedProduct || undefined}
            />
          </div>
        ) : (
          <div className="no-checkout">
            <h2>Not a Checkout Page</h2>
            <p>Keep browsing and we'll notify you when you're ready to checkout!</p>
          </div>
        )}
      </div>
    </MantineProvider>
  );
};
