import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import { isCheckoutPage } from '../../src/services/checkoutDetector'

const s = {
  wrap: {
    padding: '16px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontSize: '13px',
    color: '#333',
    lineHeight: '1.5',
  },
  heading: { margin: '0 0 6px', fontSize: '16px', fontWeight: 700 as const },
  muted: { margin: '0 0 12px', fontSize: '12px', color: '#666' },
  badge: (active: boolean) => ({
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    padding: '3px 10px',
    borderRadius: '999px',
    fontSize: '11px',
    fontWeight: 600 as const,
    background: active ? 'hsl(120,60%,90%)' : '#f0f0f0',
    color: active ? '#1a6e1a' : '#666',
  }),
  divider: { margin: '12px 0', border: 'none', borderTop: '1px solid #f0f0f0' },
  pauseRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '12px',
    color: '#444',
  },
}

function PopupApp() {
  const [onCheckout, setOnCheckout] = useState<boolean | null>(null)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    // Read pause state
    if (typeof chrome !== 'undefined' && chrome.storage?.local) {
      chrome.storage.local.get(['extensionPaused'], (result) => {
        setIsPaused(!!result['extensionPaused'])
      })
    }

    // Check if current tab is a checkout page
    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
        if (tab?.url) {
          setOnCheckout(isCheckoutPage(tab.url, document))
        }
      })
    }
  }, [])

  const togglePause = (e: React.ChangeEvent<HTMLInputElement>) => {
    const paused = e.target.checked
    setIsPaused(paused)
    if (typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({ type: 'SET_PAUSE_STATE', paused })
    }
  }

  return (
    <div style={s.wrap}>
      <h1 style={s.heading}>🛒 Ethical Shopper</h1>
      <p style={s.muted}>Ethics scores for companies in your cart, as you check out.</p>

      {onCheckout !== null && (
        <span style={s.badge(onCheckout && !isPaused)}>
          {onCheckout && !isPaused ? '✓ Active on this page' : '— Not a checkout page'}
        </span>
      )}

      <hr style={s.divider} />

      <div style={s.pauseRow}>
        <span>Pause extension</span>
        <input type="checkbox" checked={isPaused} onChange={togglePause} />
      </div>
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>,
)
