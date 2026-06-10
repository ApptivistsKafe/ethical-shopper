export default defineBackground(() => {
  // Handle pause-state toggle sent from the popup.
  chrome.runtime.onMessage.addListener(
    (message: { type: string; paused?: boolean }, _sender, sendResponse): boolean => {
      if (message.type === 'SET_PAUSE_STATE' && message.paused !== undefined) {
        chrome.storage.local.set({ extensionPaused: message.paused }, () => {
          if (chrome.runtime.lastError) {
            sendResponse({ success: false, error: chrome.runtime.lastError.message })
          } else {
            sendResponse({ success: true })
          }
        })
        return true // async response
      }
      return false
    },
  )
})
