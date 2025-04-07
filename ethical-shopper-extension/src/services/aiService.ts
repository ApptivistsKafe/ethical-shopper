import { GoogleGenerativeAI } from '@google/generative-ai';
import TurndownService from 'turndown';
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
    let fullPrompt = prompt;
    if (pageHtml) {
      const pageMarkdown = processHtmlForAI(pageHtml);
      fullPrompt = `User Prompt: ${prompt}\n\nPage Content (Markdown):\n\`\`\`markdown\n${pageMarkdown}\n\`\`\`\n\nPlease analyze the page content in relation to the user prompt.`;
    }
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;
    return response.text();
  } catch (error) {
    console.error('Error in direct AI call:', error);
    throw error;
  }
};

// Helper function to clean HTML and convert to Markdown
const processHtmlForAI = (html: string): string => {
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

// Extension message-based implementation
const generateExtensionAIResponse = async (prompt: string, pageHtml?: string): Promise<string> => {
  try {
    let messagePayload: { type: string; prompt: string; pageMarkdown?: string } = {
        type: 'GENERATE_AI_RESPONSE',
        prompt,
    };

    if (pageHtml) {
        messagePayload.pageMarkdown = processHtmlForAI(pageHtml); // Process and send Markdown
    }

    const response = await chrome.runtime.sendMessage(messagePayload);

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