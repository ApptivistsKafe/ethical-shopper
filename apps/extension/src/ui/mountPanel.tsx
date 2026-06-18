import React from 'react'
import ReactDOM from 'react-dom/client'
import { EthicalPanel } from '../components/EthicalPanel'
import { htmlToMarkdown } from '../services/htmlToMarkdown'
import { loadUserWeights } from '../services/userWeights'

const HOST_ID = 'ethical-shopper-host'

/**
 * Mounts the EthicalPanel into the current page inside a Shadow DOM
 * (full style isolation from the host page).
 *
 * Lives in a lazily-imported chunk together with React and Turndown —
 * see entrypoints/content.ts.
 *
 * @returns a dismiss function that unmounts and removes the panel.
 */
export function mountPanel(): () => void {
  // Prevent double-injection
  const existing = document.getElementById(HOST_ID)
  if (existing) existing.remove()

  const markdown = htmlToMarkdown(document.documentElement.outerHTML)

  const host = document.createElement('div')
  host.id = HOST_ID
  // `all: initial` isolates the host box from the page's CSS, but it also resets
  // any positioning set alongside it — so apply it FIRST, then force the fixed
  // positioning with !important so neither `all` nor hostile page CSS can move
  // the panel off-screen (it was rendering full-width at the page bottom).
  host.style.cssText = 'all: initial;'
  host.style.setProperty('position', 'fixed', 'important')
  host.style.setProperty('top', '12px', 'important')
  host.style.setProperty('right', '12px', 'important')
  host.style.setProperty('z-index', '2147483647', 'important')
  document.body.appendChild(host)

  const shadow = host.attachShadow({ mode: 'open' })
  const container = document.createElement('div')
  shadow.appendChild(container)

  const root = ReactDOM.createRoot(container)

  const dismiss = () => {
    root.unmount()
    host.remove()
  }

  // User weights load asynchronously; render once they're available
  void loadUserWeights().then((userWeights) => {
    root.render(
      <React.StrictMode>
        <EthicalPanel
          markdown={markdown}
          pageUrl={window.location.href}
          userWeights={userWeights}
          onDismiss={dismiss}
        />
      </React.StrictMode>,
    )
  })

  return dismiss
}
