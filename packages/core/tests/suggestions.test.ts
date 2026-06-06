import { describe, it, expect } from 'vitest'
import { normalizeSuggestionLabel, buildSuggestion } from '../src/suggestions.js'

describe('normalizeSuggestionLabel', () => {
  it('lowercases and trims', () => {
    expect(normalizeSuggestionLabel('  Misinformation  ')).toBe('misinformation')
    expect(normalizeSuggestionLabel('TAX AVOIDANCE')).toBe('tax avoidance')
  })

  it('removes special characters', () => {
    expect(normalizeSuggestionLabel('Prison-Labor!')).toBe('prisonlabor')
  })

  it('collapses multiple spaces', () => {
    expect(normalizeSuggestionLabel('tax   avoidance')).toBe('tax avoidance')
  })
})

describe('buildSuggestion', () => {
  it('builds a model suggestion with source=model', () => {
    const s = buildSuggestion('Misinformation', 'funds disinfo campaigns', 'model', 'Meta')
    expect(s.source).toBe('model')
    expect(s.company).toBe('Meta')
    expect(s.normalizedLabel).toBe('misinformation')
    expect(s.timestamp).toBeTruthy()
  })

  it('builds a user suggestion with source=user', () => {
    const s = buildSuggestion('Tax avoidance', 'offshore profits', 'user')
    expect(s.source).toBe('user')
    expect(s.company).toBeUndefined()
  })

  it('normalized label matches normalizeSuggestionLabel', () => {
    const raw = '  Prison Labor!  '
    const s = buildSuggestion(raw, 'test', 'model')
    expect(s.normalizedLabel).toBe(normalizeSuggestionLabel(raw))
  })
})
