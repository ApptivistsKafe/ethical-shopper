import { GoogleGenerativeAI } from '@google/generative-ai';
import { config } from '../config';

// Helper to determine if we're running in the extension context
const isExtensionContext = (): boolean => {
  return typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;
};

// Direct API call implementation
const generateDirectAIResponse = async (prompt: string, pageHtml?: string): Promise<string> => {
  const genAI = new GoogleGenerativeAI(config.GOOGLE_AI_API_KEY);
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
    console.error('Error in direct AI call:', error);
    throw error;
  }
};

// Extension message-based implementation
const generateExtensionAIResponse = async (prompt: string, pageHtml?: string): Promise<string> => {
  try {
    const response = await chrome.runtime.sendMessage({
      type: 'GENERATE_AI_RESPONSE',
      prompt,
      pageHtml // Pass the HTML content in the message
    });

    if (!response.success) {
      throw new Error(response.error || 'Failed to generate AI response');
    }

    return response.data;
  } catch (error) {
    console.error('Error in extension AI call:', error);
    throw error;
  }
};

// Main export that handles both environments
export const generateAIResponse = async (prompt: string, pageHtml?: string): Promise<string> => {
  try {
    // Use extension implementation if in extension context, otherwise direct call
    if (isExtensionContext()) {
      return await generateExtensionAIResponse(prompt, pageHtml);
    } else {
      return await generateDirectAIResponse(prompt, pageHtml);
    }
  } catch (error) {
    console.error('Error generating AI response:', error);
    throw error;
  }
};