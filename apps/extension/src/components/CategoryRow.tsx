import React, { useState } from 'react'
import type { CategoryView } from '@ethical-shopper/core'
import { getEthicalStatusColor, getEthicalStatusEmoji, getTaxonomyEntry } from '@ethical-shopper/core'

interface CategoryRowProps {
  category: CategoryView
}

/**
 * A single non-neutral category in the expanded CompanyCard.
 *
 * Shows: emoji + label + coloured score badge.
 * Tapping the ℹ icon toggles the blurb (the 1–2 sentence rationale).
 *
 * Progressive disclosure step 3 of 3.
 */
export function CategoryRow({ category }: CategoryRowProps) {
  const [showBlurb, setShowBlurb] = useState(false)
  const color = getEthicalStatusColor(category.score)
  const emoji = getEthicalStatusEmoji(category.score)

  let label: string
  try {
    label = getTaxonomyEntry(category.id).label
  } catch {
    label = category.id
  }

  return (
    <div
      style={{
        padding: '6px 0',
        borderBottom: '1px solid #f5f5f5',
        fontSize: '12px',
      }}
    >
      {/* Summary row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '14px', lineHeight: 1, flexShrink: 0 }}>{emoji}</span>
        <span style={{ flex: 1, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
        <span
          style={{
            fontSize: '10px',
            fontWeight: 600,
            background: color,
            color: '#333',
            padding: '1px 7px',
            borderRadius: '999px',
            flexShrink: 0,
          }}
        >
          {category.score}
        </span>

        {/* ℹ toggle */}
        <button
          onClick={() => setShowBlurb((b) => !b)}
          aria-label={showBlurb ? 'Hide rationale' : 'Show rationale'}
          title={showBlurb ? 'Hide rationale' : 'Show rationale'}
          style={{
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '16px',
            height: '16px',
            background: 'transparent',
            border: `1px solid ${showBlurb ? '#bbb' : '#ddd'}`,
            borderRadius: '50%',
            cursor: 'pointer',
            fontSize: '10px',
            color: showBlurb ? '#555' : '#aaa',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ℹ
        </button>
      </div>

      {/* Blurb — revealed on ℹ click */}
      {showBlurb && (
        <p
          style={{
            margin: '5px 0 0 20px',
            fontSize: '11px',
            color: '#666',
            lineHeight: 1.5,
          }}
        >
          {category.blurb}
        </p>
      )}
    </div>
  )
}
