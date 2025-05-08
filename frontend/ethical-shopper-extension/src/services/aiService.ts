import TurndownService from 'turndown';
import { config } from '../config';

// --- Types ---
// Consider moving these to a central types file (e.g., src/types/index.d.ts) later
export type StepOneModel = 'gemini-flash-2.0'; // Only allowed Step 1 model
export type StepTwoModel = 'openai-gpt-o3-mini' | 'gemini-flash-2.0-grounded'; // Only allowed Step 2 models
export type ModelName = StepOneModel | StepTwoModel; // Combined type

export interface AIResponse {
    data: string; // The actual text/JSON response from the model
    timeMs: number; // Execution time in milliseconds
}

export interface AIRequestParams {
    step: 1 | 2;
    modelName: ModelName;
    basePrompt: string; // The base prompt constant (e.g., productIdentificationPrompt)
    pageMarkdown?: string; // For step 1
    identifiedProductJson?: string; // For step 2, replaces placeholder in basePrompt
}

// --- Helper Functions ---

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

// --- API Call Implementation (using fetch to backend) ---

export const callAIModel = async (params: AIRequestParams): Promise<AIResponse> => {
  const startTime = performance.now();
  let endpoint = '';
  let body: any = {
      basePrompt: params.basePrompt,
      modelName: params.modelName,
  };

  if (params.step === 1) {
    endpoint = '/identify-product';
    if (!params.pageMarkdown) {
        throw new Error("Page markdown is required for Step 1.");
    }
    body.pageContent = params.pageMarkdown;
  } else if (params.step === 2) {
    endpoint = '/find-alternatives';
    if (!params.identifiedProductJson) {
        throw new Error("Identified product JSON is required for Step 2.");
    }
    body.productDetails = params.identifiedProductJson;
  } else {
      throw new Error(`Invalid step number: ${params.step}`);
  }

  try {
    const response = await fetch(`${config.BACKEND_API_URL}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`Backend API error: ${response.status} ${response.statusText} - ${errorData.error || 'Unknown error'}`);
    }

    const result = await response.json();
    const endTime = performance.now();
    const totalTimeMs = Math.round(endTime - startTime);

    // The backend now returns the execution time
    return {
        data: result.data,
        timeMs: result.timeMs ?? totalTimeMs, // Prefer backend time if provided
    };

  } catch (error) {
    const endTime = performance.now();
    console.error(`Error calling backend API ${endpoint}:`, error);
    return {
        data: `[Failed to get AI response from backend: ${error instanceof Error ? error.message : String(error)}]`,
        timeMs: Math.round(endTime - startTime), // Return frontend roundtrip time on error
    };
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