import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// Check if we're in the extension context
const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;

// Only set up message handling if we're in the extension context
if (isExtensionContext) {
  const genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'GENERATE_AI_RESPONSE') {
      generateAIResponse(message.prompt)
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

  async function generateAIResponse(prompt: string): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw error;
    }
  }
}