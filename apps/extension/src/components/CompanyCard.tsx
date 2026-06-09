import React, { useState } from 'react'
import type { CompanyView } from '@ethical-shopper/core'
import { getEthicalStatusColor, getEthicalStatusEmoji } from '@ethical-shopper/core'
import { CategoryRow } from './CategoryRow'

interface CompanyCardProps {
  view: CompanyView
}

/**
 * Progressive disclosure card for a single company.
 *
 * Level 1 (always visible): emoji + company name + overall score badge
 * Level 2 (expand on click): per-category rows (non-neutral only)
 * Level 3 (per-category): ℹ toggle reveals blurb  ← handled in CategoryRow
 */
export function CompanyCard({ view }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false)
  const color = getEthicalStatusColor(view.overallScore)
  const emoji = getEthicalStatusEmoji(view.overallScore)

  return (
    <div
      style={{
        margin: '4px 8px',
        borderRadius: '8px',
        background: '#fafafa',
        border: '1px solid #ebebeb',
        overflow: 'hidden',
      }}
    >
      {/* ─── Level 1: summary row ────────────────────────────────────────────── */}
      <button
        onClick={() => setExpanded((e) => !e)}
        aria-expanded={expanded}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '9px 12px',
          background: 'transparent',
          border: 'none',
          borderLeft: `3px solid ${color}`,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
          fontSize: '14px',
        }}
      >
        <span style={{ fontSize: '20px', lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
        <span
          style={{
            fontWeight: 600,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: '#1a1a1a',
          }}
        >
          {view.companyName}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            background: color,
            color: '#333',
            padding: '2px 8px',
            borderRadius: '999px',
            flexShrink: 0,
          }}
        >
          {view.overallScore}
        </span>
        <span
          style={{ color: '#ccc', fontSize: '9px', flexShrink: 0, marginLeft: '2px' }}
          aria-hidden
        >
          {expanded ? '▲' : '▼'}
        </span>
      </button>

      {/* ─── Level 2: category breakdown ────────────────────────────────────── */}
      {expanded && (
        <div
          style={{
            padding: '4px 12px 10px',
            borderTop: '1px solid #f0f0f0',
          }}
        >
          {view.visibleCategories.length > 0 ? (
            view.visibleCategories.map((cat) => <CategoryRow key={cat.id} category={cat} />)
          ) : (
            <p
              style={{
                margin: '8px 0 0',
                fontSize: '12px',
                color: '#888',
                fontStyle: 'italic',
              }}
            >
              No notable concerns or highlights found.
            </p>
          )}

          {/* Summary sentence */}
          {view.explanation && (
            <p
              style={{
                margin: '10px 0 0',
                fontSize: '11px',
                color: '#666',
                lineHeight: 1.5,
              }}
            >
              {view.explanation}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
