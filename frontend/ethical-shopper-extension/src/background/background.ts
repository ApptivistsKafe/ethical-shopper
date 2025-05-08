// Check if we're in the extension context
const isExtensionContext = typeof chrome !== 'undefined' && chrome.runtime?.id !== undefined;

// --- Message Listener ---
if (isExtensionContext) {
    chrome.runtime.onMessage.addListener((message: { type: string, paused?: boolean }, sender, sendResponse) => {
        if (message.type === 'SET_PAUSE_STATE') {
            const newPauseState = (message as { type: string, paused: boolean }).paused;
            chrome.storage.local.set({ extensionPaused: newPauseState }, () => {
                if (chrome.runtime.lastError) {
                    sendResponse({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    sendResponse({ success: true });
                }
            });
            return true; // Indicate asynchronous response
        }
        // Optional: Handle other message types or return false/undefined
    });
}

console.log("Ethical Shopper Background Script Loaded"); // Log successful load
