import { GoogleGenerativeAI } from '@google/generative-ai';
import TurndownService from 'turndown';
import { config } from '../config';
// TODO: Potentially add OpenAI client if needed for direct calls (less likely needed here)
// import OpenAI from 'openai';

// --- Types ---
// Consider moving these to a central types file (e.g., src/types/index.d.ts) later
export type StepOneModel = 'gemini-flash-2.0'; // Only allowed Step 1 model
export type StepTwoModel = 'openai-gpt-o3-mini' | 'gemini-flash-2.0-grounded'; // Only allowed Step 2 models
export type ModelName = StepOneModel | StepTwoModel; // Combined type

export interface AIResponse {
    data: string; // The actual text/JSON response from the model
    timeMs: number; // Execution time in milliseconds
    // Cost fields removed
}

export interface AIRequestParams {
    step: 1 | 2;
    modelName: ModelName;
    basePrompt: string; // The base prompt constant (e.g., productIdentificationPrompt)
    pageMarkdown?: string; // For step 1
    identifiedProductJson?: string; // For step 2, replaces placeholder in basePrompt
}

// Type for messages sent to the background script
export interface ExtensionAICallPayload extends AIRequestParams {
    type: 'CALL_AI_MODEL'; // New message type
}

// Type for responses received from the background script
export interface ExtensionAICallResponse {
    success: boolean;
    data?: AIResponse; // Contains data, timeMs
    error?: string;
}

// --- Helper Functions ---

const isExtensionContext = (): boolean => {
  return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
};

// Helper function to clean HTML and convert to Markdown (Unchanged)
export const processHtmlForAI = (html: string): string => {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Remove unwanted elements
    const selectorsToRemove = ['script', 'style', 'link', 'meta', 'noscript', 'svg', 'img', 'header', 'footer', 'nav'];
    selectorsToRemove.forEach(selector => {
      doc.querySelectorAll(selector).forEach(el => el.remove());
    });

    // Remove comments
    const iterator = doc.createNodeIterator(doc.documentElement, NodeFilter.SHOW_COMMENT);
    let currentNode;
    while (currentNode = iterator.nextNode()) {
        currentNode.parentNode?.removeChild(currentNode);
    }

    // Get the body content or the whole document if body is empty
    const contentElement = doc.body?.innerHTML ? doc.body : doc.documentElement;

    // Convert cleaned HTML to Markdown
    const turndownService = new TurndownService({
        headingStyle: 'atx', // Use # for headings
        codeBlockStyle: 'fenced', // Use ``` for code blocks
        bulletListMarker: '-', // Use - for bullets
    });
    // Add a rule to handle potential empty nodes or nodes Turndown might skip
    turndownService.addRule('skipEmpty', {
        filter: (node) => {
            // Skip nodes that are essentially empty or just whitespace
            return !node.textContent?.trim() && node.childNodes.length === 0 && !['br', 'hr', 'img'].includes(node.nodeName.toLowerCase());
        },
        replacement: () => ''
    });

    let markdown = turndownService.turndown(contentElement);

    // Further cleanups - remove excessive newlines
    markdown = markdown.replace(/\n{3,}/g, '\n\n'); // Replace 3+ newlines with 2
    markdown = markdown.trim(); // Trim leading/trailing whitespace

    return markdown;
  } catch (error) {
    console.error("Error processing HTML for AI:", error);
    // Fallback: return a simple message or empty string if processing fails
    return "[Error processing page content]";
  }
};

// --- API Call Implementations ---

// Direct API call implementation (Refactored)
// NOTE: This currently only supports Gemini Flash directly. Adding other models
// here would require their respective SDKs and API key handling outside the extension context.
const callDirectAIModel = async (params: AIRequestParams): Promise<AIResponse> => {
  const startTime = performance.now();
  let responseText = '';
  // Removed cost variable

  // --- Model Selection & Prompt Construction ---
  let finalPrompt = params.basePrompt;
  let modelId = 'gemini-1.5-flash-latest'; // Default / Fallback

  if (params.step === 1) {
    if (!params.pageMarkdown) {
        throw new Error("Page markdown is required for Step 1.");
    }
    // Simple prompt construction for Step 1
    finalPrompt = `Page Content (Markdown):\n\`\`\`markdown\n${params.pageMarkdown}\n\`\`\`\n\nInstructions:\n${params.basePrompt}`;
    // Basic model mapping (expand as needed if direct calls for others are implemented)
    switch(params.modelName) {
        case 'gemini-flash-2.0':
             modelId = 'gemini-1.5-flash-latest';
             break;
        // Removed other cases
        // Add cases for DeepSeek if direct API/SDK exists and is desired
        default:
            console.warn(`Direct call for model ${params.modelName} not fully implemented, using default Gemini Flash.`);
            modelId = 'gemini-1.5-flash-latest';
    }

  } else if (params.step === 2) {
    if (!params.identifiedProductJson) {
        throw new Error("Identified product JSON is required for Step 2.");
    }
    // Inject identified product into the prompt for Step 2
    finalPrompt = params.basePrompt.replace('[IDENTIFIED_PRODUCT_JSON]', params.identifiedProductJson);

    // Basic model mapping (expand as needed)
    switch(params.modelName) {
        case 'gemini-flash-2.0-grounded':
             modelId = 'gemini-1.5-flash-latest'; // Grounding needs specific API params not handled here
             break;
        // Removed OpenAI/DeepSeek cases for direct calls
        default:
            console.warn(`Direct call for model ${params.modelName} not fully implemented, using default Gemini Flash.`);
            modelId = 'gemini-1.5-flash-latest';
    }
  } else {
      throw new Error(`Invalid step number: ${params.step}`);
  }

  // --- API Call (Example: Gemini) ---
  try {
    // Only proceed if it's a Gemini model for direct call example
    if (modelId.startsWith('gemini')) {
        const genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);
        const model = genAI.getGenerativeModel({ model: modelId });
        // TODO: Add grounding options if modelId indicates it and API supports it directly
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        responseText = response.text();
        // TODO: Extract token usage from response if available for cost calculation
    } else {
        // Placeholder for other direct model calls (OpenAI, DeepSeek)
        console.warn(`Direct API call for model ${modelId} not implemented.`);
        responseText = `[Direct call simulation for ${modelId}]`;
    }

  } catch (error) {
    console.error(`Error in direct AI call for model ${modelId}:`, error);
    throw error; // Re-throw error to be caught by the main function
  }

  const endTime = performance.now();
  const timeMs = Math.round(endTime - startTime);

  // --- Cost Estimation (Placeholder) ---
  // Very basic estimation based on input length, refine if possible
  const inputTokenEstimate = Math.ceil(finalPrompt.length / 4); // Rough estimate
  // Output cost is highly variable, cannot estimate accurately beforehand.
  // Actual cost depends on API providing token usage data.
  // Removed cost calculation placeholder

  return {
    data: responseText,
    timeMs: timeMs,
    // Cost fields removed from return object
  };
};

// Extension message-based implementation (Refactored)
const callExtensionAIModel = async (params: AIRequestParams): Promise<AIResponse> => {
  const startTime = performance.now();

  const messagePayload: ExtensionAICallPayload = {
    type: 'CALL_AI_MODEL',
    step: params.step,
    modelName: params.modelName,
    basePrompt: params.basePrompt,
    pageMarkdown: params.pageMarkdown, // Will be undefined for step 2
    identifiedProductJson: params.identifiedProductJson, // Will be undefined for step 1
  };

  try {
    // Send message to background script
    const response: ExtensionAICallResponse = await chrome.runtime.sendMessage(messagePayload);
    const endTime = performance.now(); // End timer after response received

    if (!response || !response.success || !response.data) {
      throw new Error(response?.error || 'Background script failed to process AI request.');
    }

    // Return the structured data received from the background script
    // Ensure the time measured here (frontend roundtrip) isn't confused with backend execution time if needed
    // For simplicity, we'll use the roundtrip time for now. Background could return its own execution time.
    const timeMs = Math.round(endTime - startTime);

    // If background script calculated time/cost, use that, otherwise use frontend time and no cost
    return {
        data: response.data.data,
        timeMs: response.data.timeMs ?? timeMs, // Prefer background time if provided
        // Cost fields removed from return object
    };

  } catch (error) {
    const endTime = performance.now();
    console.error('Error sending message to background script or processing response:', error);
    // Return a structured error response
     return {
        data: `[Error communicating with background script: ${error instanceof Error ? error.message : String(error)}]`,
        timeMs: Math.round(endTime - startTime),
        // Cost fields removed from error return object
    };
    // Or re-throw if preferred: throw error;
  }
};

// --- Main Export ---

// New main export function
export const callAIModel = async (params: AIRequestParams): Promise<AIResponse> => {
  try {
    // Use extension implementation if in extension context, otherwise direct call
    if (isExtensionContext()) {
      return await callExtensionAIModel(params);
    } else {
      // Note: Direct calls currently have limited model support in this example
      return await callDirectAIModel(params);
    }
  } catch (error) {
    console.error(`Error calling AI model (Step ${params.step}, Model ${params.modelName}):`, error);
    // Return a structured error response
    return {
        data: `[Failed to get AI response: ${error instanceof Error ? error.message : String(error)}]`,
        timeMs: 0, // Indicate error with 0 time? Or measure try/catch block?
        // Cost fields removed from error return object
    };
    // Or re-throw: throw error;
  }
};

// Deprecate or remove the old function
/** @deprecated Use callAIModel instead */
export const generateAIResponse = async (prompt: string, pageHtml?: string): Promise<string> => {
    console.warn("generateAIResponse is deprecated. Use callAIModel instead.");
    // Basic fallback to mimic old behavior using new structure (Step 1, default model)
    const pageMarkdown = pageHtml ? processHtmlForAI(pageHtml) : undefined;
    const result = await callAIModel({
        step: 1,
        modelName: 'gemini-flash-2.0', // Default old behavior
        basePrompt: prompt, // Treat old prompt as base prompt for step 1
        pageMarkdown: pageMarkdown,
    });
    return result.data;
};