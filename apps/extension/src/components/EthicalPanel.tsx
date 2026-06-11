import React, { useState, useEffect, useRef } from 'react'
import type { Cart, CompanyView, AnalyzeStreamEvent, UserWeights } from '@ethical-shopper/core'
import { streamAnalysis } from '../services/analyzeStream'
import { CompanyCard } from './CompanyCard'
import { SuggestionFooter } from './SuggestionFooter'
import { ItemAlternatives } from './ItemAlternatives'

interface EthicalPanelProps {
  markdown: string
  pageUrl: string
  userWeights?: UserWeights
  onDismiss: () => void
}

// ─── Shared style tokens ──────────────────────────────────────────────────────

const FONT_STACK = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"

const panel: React.CSSProperties = {
  width: '320px',
  maxHeight: '540px',
  overflowY: 'auto',
  background: '#ffffff',
  borderRadius: '12px',
  boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
  border: '1px solid rgba(0,0,0,0.07)',
  fontFamily: FONT_STACK,
  fontSize: '14px',
  color: '#333',
  lineHeight: '1.5',
}

const header: React.CSSProperties = {
  padding: '11px 12px 11px 14px',
  fontWeight: 600,
  fontSize: '13px',
  color: '#444',
  borderBottom: '1px solid #f0f0f0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  position: 'sticky',
  top: 0,
  background: '#fff',
  zIndex: 1,
}

const dismissBtn: React.CSSProperties = {
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  fontSize: '15px',
  color: '#bbb',
  padding: '2px 4px',
  lineHeight: 1,
  borderRadius: '4px',
  fontFamily: 'inherit',
}

const loadingMsg: React.CSSProperties = {
  padding: '16px',
  textAlign: 'center',
  color: '#999',
  fontSize: '12px',
  fontStyle: 'italic',
}

const errorMsg: React.CSSProperties = {
  margin: '4px 8px',
  padding: '8px 12px',
  background: '#fff3f3',
  border: '1px solid #ffd5d5',
  borderRadius: '6px',
  color: '#c00',
  fontSize: '11px',
  lineHeight: 1.5,
}

// ─── Component ────────────────────────────────────────────────────────────────

/**
 * Main content script UI.  Streams analysis results from the API and renders
 * them progressively as they arrive.
 *
 * State machine:
 *   idle → streaming cart → cart received → streaming company scores → done
 */
export function EthicalPanel({ markdown, pageUrl, userWeights, onDismiss }: EthicalPanelProps) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [views, setViews] = useState<CompanyView[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [done, setDone] = useState(false)

  // Use a ref to track cancellation on unmount
  const cancelledRef = useRef(false)

  useEffect(() => {
    cancelledRef.current = false

    const run = async () => {
      for await (const event of streamAnalysis({ markdown, url: pageUrl, userWeights })) {
        if (cancelledRef.current) break
        dispatch(event)
      }
    }

    run()

    return () => {
      cancelledRef.current = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dispatch(event: AnalyzeStreamEvent) {
    switch (event.type) {
      case 'cart':
        setCart(event.cart)
        break
      case 'companyView':
        setViews((prev) => {
          // Guard against duplicate events (e.g., reconnection retries)
          if (prev.some((v) => v.companyName === event.view.companyName)) return prev
          return [...prev, event.view]
        })
        break
      case 'done':
        setDone(true)
        break
      case 'error':
        setErrors((prev) => [...prev, event.message])
        break
    }
  }

  // The server decides which companies to score (sellers + brands, capped),
  // so the client can't predict an exact count — show the indicator until done.
  const isScoring = cart !== null && cart.items.length > 0 && !done

  return (
    <div style={{ ...panel, boxSizing: 'border-box' }}>
      {/* ─── Header ─────────────────────────────────────────────────────────── */}
      <div style={header}>
        <span>🛒 Ethical Shopper</span>
        <button style={dismissBtn} onClick={onDismiss} aria-label="Dismiss panel">
          ✕
        </button>
      </div>

      {/* ─── Body ───────────────────────────────────────────────────────────── */}
      <div style={{ paddingBottom: '8px' }}>
        {/* Extracting cart */}
        {!cart && errors.length === 0 && <p style={loadingMsg}>Scanning your cart…</p>}

        {/* Company cards stream in as they resolve */}
        {views.map((view) => (
          <CompanyCard key={view.companyName} view={view} />
        ))}

        {/* Scoring in-progress indicator */}
        {isScoring && <p style={loadingMsg}>Scoring companies…</p>}

        {/* Errors */}
        {errors.map((err, i) => (
          <div key={i} style={errorMsg}>
            ⚠ {err}
          </div>
        ))}

        {/* Empty state — scored everything and found nothing */}
        {done && views.length === 0 && errors.length === 0 && (
          <p style={loadingMsg}>No companies identified in this cart.</p>
        )}

        {/* Per-item ethical alternatives (Spec 2) — on-demand, never auto-fired */}
        {done && cart !== null && cart.items.length > 0 && (
          <div style={{ margin: '8px 8px 0', borderTop: '1px solid #f0f0f0', paddingTop: '6px' }}>
            <div
              style={{
                fontSize: '10px',
                fontWeight: 600,
                color: '#999',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '2px',
              }}
            >
              Your items
            </div>
            {cart.items.map((item, i) => (
              <ItemAlternatives
                key={`${item.name}-${i.toString()}`}
                item={item}
                userWeights={userWeights}
              />
            ))}
          </div>
        )}

        {/* User suggestion footer — appears once results are in */}
        {done && <SuggestionFooter />}
      </div>
    </div>
  )
}
