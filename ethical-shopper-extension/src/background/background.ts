// Listen for tab updates to detect checkout pages automatically
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    try {
      const result = await chrome.scripting.executeScript({
        target: { tabId },
        files: ['src/content/content.ts']
      });

      // If it's a checkout page, we could:
      // 1. Update the extension icon
      // 2. Show a notification
      // 3. Cache the result
      if (result[0]?.result) {
        chrome.action.setBadgeText({
          text: '✓',
          tabId
        });
        chrome.action.setBadgeBackgroundColor({
          color: '#4CAF50',
          tabId
        });
      } else {
        chrome.action.setBadgeText({
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
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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