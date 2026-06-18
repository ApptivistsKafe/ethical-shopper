import { isCheckoutPage } from '../src/services/checkoutDetector'
import { classifyDom, isLikelyCart } from '../src/services/pageGate'
import { mountPanel } from '../src/ui/mountPanel'

/**
 * Content script entry.
 *
 * The panel UI (React + Turndown) is bundled directly into this content script
 * so it runs in the content-script isolated world. (An earlier attempt to
 * lazy-load it via `import(chrome.runtime.getURL('panel.js'))` failed silently:
 * WXT builds unlisted scripts as IIFEs, not ES modules, so the dynamic import
 * yielded no `default` export and the mount threw.) The heavy work still only
 * runs after the gate passes — the per-page cost is just parsing the bundle.
 *
 * Handles:
 *  - pause state (extensionPaused in chrome.storage.local)
 *  - content-safety gate (never send non-commerce or adult content off-machine)
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
      // Trigger on a known checkout URL (fast path / big-site rules) OR on a
      // visible cart detected from the DOM (generalizable — catches cart drawers
      // and SPA carts that never change the URL).
      const looksLikeCart = isCheckoutPage(window.location.href, document) || isLikelyCart(document)
      if (paused || !looksLikeCart) {
        dismiss()
        return
      }

      // Content-safety gate — must positively look like a product checkout and
      // not look like adult content. Runs on the live DOM BEFORE anything is
      // sent, so non-commerce/adult pages never leave the user's machine.
      if (classifyDom(document).decision === 'reject') {
        dismiss()
        return
      }

      if (dismissPanel) return // already mounted on this page

      mounting = true
      try {
        if (!ctx.isValid) return
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

    // Watch for a cart appearing dynamically (a drawer/modal opening) without a
    // URL change. Debounced so it coalesces bursts of mutations into one check,
    // and it does nothing once the panel is mounted (or was dismissed) — the
    // stale dismissPanel ref guards against re-popping after the user closes it.
    let mutationTimer: number | undefined
    const observer = new MutationObserver(() => {
      if (dismissPanel || mounting) return
      if (mutationTimer !== undefined) clearTimeout(mutationTimer)
      mutationTimer = ctx.setTimeout(() => void evaluate(), 800)
    })
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true })
    }

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
