import { describe, it, expect } from 'vitest'
import { EthicsReportSchema, ModelScoringResponseSchema, CartSchema, parseScoringResponse, parseCart } from '../src/schemas.js'
import { EthicalStatus } from '../src/types.js'

const validScoringResponse = {
  categories: [
    { id: 'labor', score: 'Poor', blurb: 'Documented union-busting.', confidence: 0.9 },
    { id: 'climate', score: null, blurb: 'No notable environmental record.', confidence: 0.5 },
    { id: 'political_giving', score: 'Concerning', blurb: 'Donates to anti-democracy candidates.', confidence: 0.85 },
    { id: 'animal_welfare', score: null, blurb: 'No notable animal welfare record.', confidence: 0.5 },
    { id: 'data_privacy_surveillance', score: null, blurb: 'No notable privacy record.', confidence: 0.5 },
    { id: 'governance_anticompetitive', score: null, blurb: 'No notable governance record.', confidence: 0.5 },
    { id: 'supply_chain', score: null, blurb: 'No notable supply chain record.', confidence: 0.5 },
  ],
}

const validCart = {
  items: [{
    name: 'Wireless Headphones',
    brand: 'Sony',
    sellingCompany: 'Amazon',
    price: 79.99,
    url: 'https://amazon.com/dp/B08N5WRWNW',
  }],
  sourceUrl: 'https://www.amazon.com/cart',
}

describe('ModelScoringResponseSchema', () => {
  it('accepts a valid scoring response', () => {
    expect(() => ModelScoringResponseSchema.parse(validScoringResponse)).not.toThrow()
  })

  it('accepts neutral (null) scores', () => {
    const result = parseScoringResponse(validScoringResponse)
    const climate = result.categories.find((c) => c.id === 'climate')
    expect(climate?.score).toBeNull()
  })

  it('rejects unknown category IDs', () => {
    const bad = {
      categories: [{ id: 'made_up_category', score: 'Good', blurb: 'test', confidence: 1 }],
    }
    expect(() => ModelScoringResponseSchema.parse(bad)).toThrow()
  })

  it('rejects unknown EthicalStatus values', () => {
    const bad = {
      categories: [{ id: 'labor', score: 'Stellar', blurb: 'test', confidence: 1 }],
    }
    expect(() => ModelScoringResponseSchema.parse(bad)).toThrow()
  })

  it('rejects missing blurb', () => {
    const bad = { categories: [{ id: 'labor', score: 'Poor', confidence: 1 }] }
    expect(() => ModelScoringResponseSchema.parse(bad)).toThrow()
  })

  it('rejects confidence out of range', () => {
    const bad = {
      categories: [{ id: 'labor', score: 'Poor', blurb: 'test', confidence: 1.5 }],
    }
    expect(() => ModelScoringResponseSchema.parse(bad)).toThrow()
  })

  it('accepts a suggestedNewCategory', () => {
    const withSuggestion = {
      ...validScoringResponse,
      suggestedNewCategory: {
        label: 'Misinformation',
        rationale: 'Company funds disinformation campaigns.',
        source: 'model',
      },
    }
    const result = parseScoringResponse(withSuggestion)
    expect(result.suggestedNewCategory?.label).toBe('Misinformation')
  })

  it('rejects suggestedNewCategory with source other than model', () => {
    const bad = {
      ...validScoringResponse,
      suggestedNewCategory: { label: 'Misinformation', rationale: 'test', source: 'user' },
    }
    expect(() => ModelScoringResponseSchema.parse(bad)).toThrow()
  })
})

describe('CartSchema', () => {
  it('accepts a valid cart', () => {
    expect(() => CartSchema.parse(validCart)).not.toThrow()
  })

  it('rejects an empty items array', () => {
    expect(() => CartSchema.parse({ ...validCart, items: [] })).toThrow()
  })

  it('rejects a cart item with missing sellingCompany', () => {
    const bad = {
      items: [{ name: 'Headphones', brand: 'Sony', price: 79, url: null }],
      sourceUrl: 'https://amazon.com/cart',
    }
    expect(() => CartSchema.parse(bad)).toThrow()
  })

  it('allows null brand and null price', () => {
    const withNulls = {
      items: [{ name: 'Mystery Item', brand: null, sellingCompany: 'Amazon', price: null, url: null }],
      sourceUrl: 'https://amazon.com/cart',
    }
    expect(() => CartSchema.parse(withNulls)).not.toThrow()
  })
})

describe('EthicsReportSchema', () => {
  it('accepts a valid full EthicsReport', () => {
    const report = {
      company: { name: 'Amazon', domain: 'amazon.com', aliases: ['AWS'] },
      categories: validScoringResponse.categories,
      overallScore: EthicalStatus.Concerning,
      ratingBand: EthicalStatus.Concerning,
      meta: { modelUsed: 'claude-sonnet', scoredAt: new Date().toISOString(), cacheKey: 'company:amazon.com' },
    }
    expect(() => EthicsReportSchema.parse(report)).not.toThrow()
  })
})
