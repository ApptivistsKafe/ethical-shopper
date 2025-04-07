import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// Check if we're in the extension context
const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;

// Only set up message handling if we're in the extension context
if (isExtensionContext) {
  const genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GENERATE_AI_RESPONSE') {
      // Extract prompt and pageMarkdown from the message
      const { prompt, pageMarkdown } = message; // Expect pageMarkdown now
      generateAIResponse(prompt, pageMarkdown) // Pass Markdown to the internal function
        .then(response => {
          sendResponse({ success: true, data: response });
        })
        .catch(error => {
          console.error('Background script error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
    } else if (message.type === 'SET_PAUSE_STATE') {
      const newPauseState = message.paused;
      chrome.storage.local.set({ extensionPaused: newPauseState }, () => {
        if (chrome.runtime.lastError) {
          sendResponse({ success: false, error: chrome.runtime.lastError.message });
        } else {
          sendResponse({ success: true });
        }
      });
      return true; // Will respond asynchronously
    }
    // Handle other message types if needed, or return false if not handled
    // return false; // Uncomment if you need to indicate synchronous handling for other types
  });

  async function generateAIResponse(prompt: string, pageMarkdown?: string): Promise<string> { // Parameter renamed
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      // Combine prompt and page HTML if provided
      // Combine prompt and page Markdown if provided
      const fullPrompt = pageMarkdown
        ? `User Prompt: ${prompt}\n\nPage Content (Markdown):\n\`\`\`markdown\n${pageMarkdown}\n\`\`\`\n\nPlease analyze the page content in relation to the user prompt.`
        : prompt;
      const result = await model.generateContent(fullPrompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }
}