import { describe, it, expect } from 'vitest'
import { normalizeStoredWeights, effectiveWeight } from '../src/services/userWeights'
import { MAX_USER_WEIGHT } from '@ethical-shopper/core'

describe('normalizeStoredWeights', () => {
  it('returns empty weights for non-object input', () => {
    expect(normalizeStoredWeights(undefined)).toEqual({})
    expect(normalizeStoredWeights(null)).toEqual({})
    expect(normalizeStoredWeights('junk')).toEqual({})
    expect(normalizeStoredWeights(42)).toEqual({})
  })

  it('passes through valid weights', () => {
    expect(normalizeStoredWeights({ labor: 2, political_giving: 0 })).toEqual({
      labor: 2,
      political_giving: 0,
    })
  })

  it('drops unknown category IDs (stale taxonomy)', () => {
    expect(normalizeStoredWeights({ labor: 1, retired_category: 5 })).toEqual({ labor: 1 })
  })

  it('clamps negative weights to 0 — polarity inversion impossible from storage', () => {
    expect(normalizeStoredWeights({ political_giving: -10 })).toEqual({ political_giving: 0 })
  })

  it('clamps oversized weights to MAX_USER_WEIGHT', () => {
    expect(normalizeStoredWeights({ climate: 9999 })).toEqual({ climate: MAX_USER_WEIGHT })
  })

  it('drops non-numeric and non-finite values', () => {
    expect(normalizeStoredWeights({ labor: 'high', climate: NaN, supply_chain: Infinity })).toEqual(
      {},
    )
  })
})

describe('effectiveWeight', () => {
  it('returns the override when set', () => {
    expect(effectiveWeight({ labor: 2 }, 'labor', 1)).toBe(2)
  })

  it('falls back to the default when unset', () => {
    expect(effectiveWeight({}, 'political_giving', 1.5)).toBe(1.5)
  })

  it('returns 0 for an opted-out category', () => {
    expect(effectiveWeight({ labor: 0 }, 'labor', 1)).toBe(0)
  })
})
