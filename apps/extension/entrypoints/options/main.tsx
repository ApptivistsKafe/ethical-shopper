import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import type { UserWeights, CategoryId } from '@ethical-shopper/core'
import { TAXONOMY } from '@ethical-shopper/core'
import { loadUserWeights, saveUserWeights } from '../../src/services/userWeights'

/**
 * Preference levels exposed to users. Simpler than raw numeric weights —
 * each maps to a multiplier used in the rollup. "Default" removes the
 * override so the taxonomy default weight applies (1.5 for political giving,
 * 1.0 elsewhere).
 */
const LEVELS: Array<{ label: string; value: number | undefined }> = [
  { label: "Don't show (opt out)", value: 0 },
  { label: 'Matters less', value: 0.5 },
  { label: 'Default', value: undefined },
  { label: 'Matters more', value: 2 },
  { label: 'Top priority', value: 4 },
]

function levelIndexFor(weight: number | undefined): number {
  const idx = LEVELS.findIndex((l) => l.value === weight)
  return idx === -1 ? 2 : idx // unknown stored value → Default
}

const s = {
  page: {
    maxWidth: '560px',
    margin: '0 auto',
    padding: '32px 20px',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    color: '#333',
    fontSize: '14px',
    lineHeight: 1.5,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    padding: '12px 0',
    borderBottom: '1px solid #eee',
  },
  select: {
    padding: '6px 8px',
    fontSize: '13px',
    borderRadius: '6px',
    border: '1px solid #ccc',
    background: '#fff',
    fontFamily: 'inherit',
  },
  save: {
    marginTop: '20px',
    padding: '10px 24px',
    fontSize: '14px',
    fontWeight: 600 as const,
    color: '#fff',
    background: '#2e7d32',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
}

function OptionsApp() {
  const [weights, setWeights] = useState<UserWeights>({})
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    void loadUserWeights().then((w) => {
      setWeights(w)
      setLoaded(true)
    })
  }, [])

  const setLevel = (id: CategoryId, levelIdx: number) => {
    setSaved(false)
    setWeights((prev) => {
      const next = { ...prev }
      const value = LEVELS[levelIdx]?.value
      if (value === undefined) delete next[id]
      else next[id] = value
      return next
    })
  }

  const save = async () => {
    await saveUserWeights(weights)
    setSaved(true)
  }

  if (!loaded) return null

  return (
    <div style={s.page}>
      <h1 style={{ fontSize: '20px', margin: '0 0 4px' }}>🛒 Ethical Shopper — Preferences</h1>
      <p style={{ color: '#666', margin: '0 0 24px', fontSize: '13px' }}>
        Tell us which concerns matter to you. Opted-out categories are hidden and excluded from a
        company&apos;s overall score; weighted categories pull the score more or less.
      </p>

      {TAXONOMY.map((entry) => (
        <div key={entry.id} style={s.row}>
          <div>
            <div style={{ fontWeight: 600 }}>{entry.label}</div>
            {entry.defaultWeight !== 1 && (
              <div style={{ fontSize: '11px', color: '#888' }}>
                Weighted more heavily by default
              </div>
            )}
          </div>
          <select
            style={s.select}
            value={levelIndexFor(weights[entry.id])}
            onChange={(e) => setLevel(entry.id, Number(e.target.value))}
          >
            {LEVELS.map((level, i) => (
              <option key={level.label} value={i}>
                {level.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button style={s.save} onClick={() => void save()}>
        Save preferences
      </button>
      {saved && <span style={{ marginLeft: '12px', color: '#2e7d32' }}>✓ Saved</span>}
    </div>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <OptionsApp />
  </React.StrictMode>,
)
