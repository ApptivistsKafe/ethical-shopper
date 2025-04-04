import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// Check if we're in the extension context
const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;

// Only set up message handling if we're in the extension context
if (isExtensionContext) {
  const genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GENERATE_AI_RESPONSE') {
      // Extract prompt and pageHtml from the message
      const { prompt, pageHtml } = message;
      generateAIResponse(prompt, pageHtml) // Pass both to the internal function
        .then(response => {
          sendResponse({ success: true, data: response });
        })
        .catch(error => {
          console.error('Background script error:', error);
          sendResponse({ success: false, error: error.message });
        });
      return true; // Will respond asynchronously
    }
  });

  async function generateAIResponse(prompt: string, pageHtml?: string): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      // Combine prompt and page HTML if provided
      const fullPrompt = pageHtml
        ? `User Prompt: ${prompt}\n\nPage HTML Content:\n\`\`\`html\n${pageHtml}\n\`\`\`\n\nPlease analyze the page content in relation to the user prompt.`
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