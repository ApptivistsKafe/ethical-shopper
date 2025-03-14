interface ChromeAPI {
  tabs: Pick<typeof chrome.tabs, 'onUpdated'>;
  runtime: Pick<typeof chrome.runtime, 'onMessage'>;
  scripting: Pick<typeof chrome.scripting, 'executeScript'>;
  action: Pick<typeof chrome.action, 'setBadgeText' | 'setBadgeBackgroundColor'>;
}

// Initialize background script with dependency injection for better testability
export function initBackgroundScript(chromeInstance: ChromeAPI) {
  // Listen for tab updates to detect checkout pages automatically
  chromeInstance.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
      try {
        const result = await chromeInstance.scripting.executeScript({
          target: { tabId },
          files: ['src/content/content.ts']
        });

        // If it's a checkout page:
        // 1. Update the extension icon
        // 2. Show a notification
        // 3. Cache the result
        if (result[0]?.result) {
          chromeInstance.action.setBadgeText({
            text: '✓',
            tabId
          });
          chromeInstance.action.setBadgeBackgroundColor({
            color: '#4CAF50',
            tabId
          });
        } else {
          chromeInstance.action.setBadgeText({
            text: '',
            tabId
          });
        }
      } catch (error) {
        console.error('Error executing content script:', error);
      }
    }
  });

  // Listen for messages from other parts of the extension
  chromeInstance.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_ALTERNATIVES') {
      // TODO: Implement fetching ethical alternatives
      // This would connect to a backend service or database
      sendResponse({
        alternatives: [
          // Example data - would be replaced with real alternatives
          {
            name: 'Ethical Store 1',
            url: 'https://example.com/ethical1',
            rating: 4.5,
            description: 'Fair trade certified'
          },
          {
            name: 'Ethical Store 2',
            url: 'https://example.com/ethical2',
            rating: 4.8,
            description: 'Sustainable and eco-friendly'
          }
        ]
      });
      return true;
    }
  });
}

// Initialize with the real chrome API when running as extension
if (typeof chrome !== 'undefined') {
  initBackgroundScript(chrome);
}