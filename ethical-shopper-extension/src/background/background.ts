interface ChromeAPI {
  tabs: Pick<typeof chrome.tabs, 'onUpdated'>;
  runtime: Pick<typeof chrome.runtime, 'onMessage'>;
  scripting: Pick<typeof chrome.scripting, 'executeScript'>;
  action: Pick<typeof chrome.action, 'setBadgeText' | 'setBadgeBackgroundColor'>;
}

// Initialize background script with dependency injection for better testability
export function initBackgroundScript(chromeInstance: ChromeAPI) {
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