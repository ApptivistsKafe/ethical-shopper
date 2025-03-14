import { describe, it, expect, vi, beforeEach } from 'vitest';
import { initBackgroundScript } from '../../src/background/background';

// Create the mock functions
const addTabListener = vi.fn();
const addMessageListener = vi.fn();
const executeScript = vi.fn();
const setBadgeText = vi.fn();
const setBadgeBackgroundColor = vi.fn();
const removeListener = vi.fn();

// Create a full mock Chrome API that satisfies the type requirements
const mockChrome = {
  tabs: {
    onUpdated: {
      addListener: addTabListener,
      removeListener: removeListener,
      hasListener: vi.fn(),
      hasListeners: vi.fn()
    },
    query: vi.fn()
  },
  runtime: {
    onMessage: {
      addListener: addMessageListener,
      removeListener: removeListener,
      hasListener: vi.fn(),
      hasListeners: vi.fn()
    }
  },
  scripting: {
    executeScript
  },
  action: {
    setBadgeText,
    setBadgeBackgroundColor
  }
} as unknown as typeof chrome;

// Store callbacks for testing
let tabUpdateCallback: Function;
let messageCallback: Function;

describe('background script', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset stored callbacks
    tabUpdateCallback = undefined as unknown as Function;
    messageCallback = undefined as unknown as Function;

    // Store callbacks when they're registered
    addTabListener.mockImplementation((callback) => {
      tabUpdateCallback = callback;
    });

    addMessageListener.mockImplementation((callback) => {
      messageCallback = callback;
    });

    // Initialize the background script
    initBackgroundScript(mockChrome);
  });

  describe('tab update listener', () => {
    it('should execute content script on complete status', async () => {
      // Mock successful script execution
      executeScript.mockResolvedValueOnce([{ result: true }]);
      
      // Call the callback with a completed status
      await tabUpdateCallback(123, { status: 'complete' }, { url: 'https://example.com' });
      
      // Verify script execution
      expect(executeScript).toHaveBeenCalledWith({
        target: { tabId: 123 },
        files: ['src/content/content.ts']
      });
      
      // Verify badge updates
      expect(setBadgeText).toHaveBeenCalledWith({
        text: '✓',
        tabId: 123
      });
      expect(setBadgeBackgroundColor).toHaveBeenCalledWith({
        color: '#4CAF50',
        tabId: 123
      });
    });

    it('should clear badge when content script returns false', async () => {
      executeScript.mockResolvedValueOnce([{ result: false }]);
      
      await tabUpdateCallback(123, { status: 'complete' }, { url: 'https://example.com' });
      
      expect(setBadgeText).toHaveBeenCalledWith({
        text: '',
        tabId: 123
      });
    });

    it('should handle script execution errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      executeScript.mockRejectedValueOnce(new Error('Script error'));
      
      await tabUpdateCallback(123, { status: 'complete' }, { url: 'https://example.com' });
      
      expect(consoleSpy).toHaveBeenCalledWith('Error executing content script:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  describe('message listener', () => {
    it('should handle GET_ALTERNATIVES message', () => {
      const sendResponse = vi.fn();
      
      messageCallback({ type: 'GET_ALTERNATIVES' }, {}, sendResponse);
      
      expect(sendResponse).toHaveBeenCalledWith({
        alternatives: expect.arrayContaining([
          expect.objectContaining({
            name: expect.any(String),
            url: expect.any(String),
            rating: expect.any(Number),
            description: expect.any(String)
          })
        ])
      });
    });

    it('should return true to keep message channel open', () => {
      const sendResponse = vi.fn();
      
      const result = messageCallback({ type: 'GET_ALTERNATIVES' }, {}, sendResponse);
      
      expect(result).toBe(true);
    });
  });
});