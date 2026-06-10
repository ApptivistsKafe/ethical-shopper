import { isCheckoutPage } from '../src/services/checkoutDetector'

/**
 * Content script entry — deliberately tiny.
 *
 * React, Turndown, and the panel components live in a separate chunk that is
 * dynamically imported ONLY after checkout detection passes, so the ~240 kB
 * UI bundle is never parsed on ordinary browsing.
 *
 * Handles:
 *  - pause state (extensionPaused in chrome.storage.local)
 *  - SPA navigation (wxt:locationchange) — mounts/dismisses as the URL changes
 */
export default defineContentScript({
  matches: ['<all_urls>'],

  async main(ctx) {
    let dismissPanel: (() => void) | null = null
    let mounting = false

    const dismiss = () => {
      dismissPanel?.()
      dismissPanel = null
    }

    const evaluate = async () => {
      if (mounting) return

      const paused = await isPaused()
      if (paused || !isCheckoutPage(window.location.href, document)) {
        dismiss()
        return
      }
      if (dismissPanel) return // already mounted on this page

      mounting = true
      try {
        // Heavy bundle (React + Turndown + panel UI) loads only now, via the
        // web-accessible unlisted script — see entrypoints/panel.ts.
        const mod = (await import(/* @vite-ignore */ chrome.runtime.getURL('/panel.js'))) as {
          default: Promise<() => () => void>
        }
        const mountPanel = await mod.default
        // Re-check state after the async gap — the user may have navigated away.
        if (!ctx.isValid || !isCheckoutPage(window.location.href, document)) return
        dismissPanel = mountPanel()
      } finally {
        mounting = false
      }
    }

    const schedule = () => {
      // Short delay lets SPAs finish rendering before we strip the HTML —
      // reduces skeleton-loader noise in the extracted markdown.
      ctx.setTimeout(() => void evaluate(), 400)
    }

    // Initial load
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', schedule, { once: true })
    } else {
      schedule()
    }

    // SPA navigation — re-evaluate whenever the URL changes without a reload.
    ctx.addEventListener(window, 'wxt:locationchange', () => {
      dismiss()
      schedule()
    })

    // React to the pause toggle while the page is open.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && 'extensionPaused' in changes) {
        if (changes['extensionPaused']?.newValue) dismiss()
        else schedule()
      }
    })
  },
})

async function isPaused(): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) return false
  try {
    const result = await chrome.storage.local.get('extensionPaused')
    return !!result['extensionPaused']
  } catch {
    return false
  }
}
