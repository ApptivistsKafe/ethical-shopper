import React, { useState } from 'react'
import { submitSuggestion } from '../services/analyzeStream'

/**
 * Collapsed footer that lets the user suggest an ethical concern we don't
 * cover yet. User suggestions are never deduplicated server-side — submission
 * frequency is the signal used to prioritize taxonomy review.
 */
export function SuggestionFooter() {
  const [open, setOpen] = useState(false)
  const [label, setLabel] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'failed'>('idle')

  const send = async () => {
    const trimmed = label.trim()
    if (trimmed.length < 2 || state === 'sending') return
    setState('sending')
    const ok = await submitSuggestion(trimmed)
    setState(ok ? 'sent' : 'failed')
  }

  if (state === 'sent') {
    return (
      <p style={{ margin: '8px 12px', fontSize: '11px', color: '#1a6e1a' }}>
        ✓ Thanks — your suggestion was recorded.
      </p>
    )
  }

  return (
    <div style={{ margin: '6px 12px 4px', fontSize: '11px' }}>
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#888',
            cursor: 'pointer',
            fontSize: '11px',
            padding: 0,
            textDecoration: 'underline',
            fontFamily: 'inherit',
          }}
        >
          Suggest a concern we should cover
        </button>
      ) : (
        <div style={{ display: 'flex', gap: '6px' }}>
          <input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void send()
            }}
            placeholder="e.g. Misinformation"
            maxLength={80}
            style={{
              flex: 1,
              padding: '4px 8px',
              fontSize: '11px',
              border: '1px solid #ddd',
              borderRadius: '4px',
              fontFamily: 'inherit',
            }}
          />
          <button
            onClick={() => void send()}
            disabled={state === 'sending' || label.trim().length < 2}
            style={{
              padding: '4px 10px',
              fontSize: '11px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              background: '#f7f7f7',
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            {state === 'sending' ? '…' : 'Send'}
          </button>
        </div>
      )}
      {state === 'failed' && (
        <p style={{ margin: '4px 0 0', color: '#c00' }}>Could not send — try again later.</p>
      )}
    </div>
  )
}
