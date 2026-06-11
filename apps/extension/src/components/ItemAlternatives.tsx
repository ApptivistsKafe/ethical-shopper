import React, { useState } from 'react'
import type { CartItem, UserWeights, AlternativeWithView } from '@ethical-shopper/core'
import { fetchAlternatives } from '../services/analyzeStream'

interface ItemAlternativesProps {
  item: CartItem
  userWeights?: UserWeights
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'loaded'; alternatives: AlternativeWithView[] }
  | { phase: 'failed' }

/**
 * One cart item row with an on-demand "ethical alternatives" lookup (Spec 2).
 * Alternatives are fetched only on click — recommendations cost a model call,
 * so they are never auto-fired for every item.
 */
export function ItemAlternatives({ item, userWeights }: ItemAlternativesProps) {
  const [state, setState] = useState<State>({ phase: 'idle' })

  const load = async () => {
    setState({ phase: 'loading' })
    try {
      const result = await fetchAlternatives(item, userWeights)
      setState({ phase: 'loaded', alternatives: result.alternatives })
    } catch {
      setState({ phase: 'failed' })
    }
  }

  return (
    <div style={{ padding: '7px 0', borderBottom: '1px solid #f5f5f5', fontSize: '12px' }}>
      {/* Item row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span
          style={{
            flex: 1,
            color: '#444',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={item.name}
        >
          {item.name}
        </span>
        {item.price != null && (
          <span style={{ color: '#888', flexShrink: 0 }}>${item.price.toFixed(2)}</span>
        )}
        {state.phase === 'idle' && (
          <button
            onClick={() => void load()}
            style={{
              flexShrink: 0,
              padding: '2px 8px',
              fontSize: '10px',
              fontWeight: 600,
              color: '#2e7d32',
              background: 'hsl(120,60%,95%)',
              border: '1px solid hsl(120,40%,80%)',
              borderRadius: '999px',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Alternatives
          </button>
        )}
        {state.phase === 'loading' && (
          <span style={{ color: '#999', fontSize: '10px', fontStyle: 'italic', flexShrink: 0 }}>
            Searching…
          </span>
        )}
      </div>

      {/* Results */}
      {state.phase === 'failed' && (
        <p style={{ margin: '5px 0 0', color: '#c00', fontSize: '11px' }}>
          Could not load alternatives — try again later.
        </p>
      )}

      {state.phase === 'loaded' && state.alternatives.length === 0 && (
        <p style={{ margin: '5px 0 0', color: '#888', fontSize: '11px', fontStyle: 'italic' }}>
          No clearly better alternative found for this item.
        </p>
      )}

      {state.phase === 'loaded' &&
        state.alternatives.map((alt) => <AlternativeRow key={alt.productName} alt={alt} />)}
    </div>
  )
}

function AlternativeRow({ alt }: { alt: AlternativeWithView }) {
  const name = alt.url ? (
    <a
      href={alt.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: '#1a6e1a', textDecoration: 'underline' }}
    >
      {alt.productName}
    </a>
  ) : (
    <span style={{ color: '#333' }}>{alt.productName}</span>
  )

  return (
    <div
      style={{
        margin: '6px 0 0 10px',
        padding: '6px 8px',
        background: '#fafff7',
        border: '1px solid #e4f0e0',
        borderRadius: '6px',
        fontSize: '11px',
        lineHeight: 1.45,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {alt.companyView && (
          <span style={{ fontSize: '13px', lineHeight: 1 }} title={alt.companyView.overallScore}>
            {alt.companyView.emoji}
          </span>
        )}
        <span style={{ fontWeight: 600, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {name}
        </span>
        {alt.approxPrice != null && (
          <span style={{ color: '#888', flexShrink: 0 }}>~${alt.approxPrice.toFixed(2)}</span>
        )}
      </div>
      <div style={{ color: '#666', marginTop: '2px' }}>
        by <strong>{alt.brand}</strong>
        {alt.companyView && (
          <span
            style={{
              marginLeft: '6px',
              fontSize: '9px',
              fontWeight: 600,
              background: alt.companyView.color,
              color: '#333',
              padding: '1px 6px',
              borderRadius: '999px',
            }}
          >
            {alt.companyView.overallScore}
          </span>
        )}
      </div>
      <div style={{ color: '#777', marginTop: '2px' }}>{alt.reason}</div>
    </div>
  )
}
