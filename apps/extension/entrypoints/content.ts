import React from 'react'
import ReactDOM from 'react-dom/client'
import { EthicalPanel } from '../src/components/EthicalPanel'
import { isCheckoutPage } from '../src/services/checkoutDetector'
import { htmlToMarkdown } from '../src/services/htmlToMarkdown'

export default defineContentScript({
  matches: ['<all_urls>'],

  main() {
    // Only activate on checkout/cart pages
    if (!isCheckoutPage(window.location.href, document)) return

    // Check pause state before injecting
    const inject = () => {
      // Prevent double-injection
      if (document.getElementById('ethical-shopper-host')) return

      const markdown = htmlToMarkdown(document.documentElement.outerHTML)

      // Mount inside a Shadow DOM so the panel's styles are fully isolated
      // from whatever the host page is doing.
      const host = document.createElement('div')
      host.id = 'ethical-shopper-host'
      Object.assign(host.style, {
        position: 'fixed',
        top: '12px',
        right: '12px',
        zIndex: '2147483647',
        // These have no effect on the shadow DOM content but prevent the host
        // element from being accidentally styled by the page.
        all: 'initial',
      })
      document.body.appendChild(host)

      const shadow = host.attachShadow({ mode: 'open' })
      const container = document.createElement('div')
      shadow.appendChild(container)

      const root = ReactDOM.createRoot(container)

      const dismiss = () => {
        root.unmount()
        host.remove()
      }

      root.render(
        React.createElement(
          React.StrictMode,
          null,
          React.createElement(EthicalPanel, {
            markdown,
            pageUrl: window.location.href,
            onDismiss: dismiss,
          }),
        ),
      )
    }

    // Short delay to let the page finish rendering before we strip its HTML.
    // Reduces noise from skeleton loaders on SPAs.
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => setTimeout(inject, 400))
    } else {
      setTimeout(inject, 400)
    }
  },
})
