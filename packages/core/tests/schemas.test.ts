import { describe, it, expect } from 'vitest'
import {
  EthicsReportSchema,
  ModelScoringResponseSchema,
  CartSchema,
  AnalyzeRequestSchema,
  SuggestRequestSchema,
  parseScoringResponse,
  parseCart,
} from '../src/schemas.js'
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

  it('accepts an empty items array (graceful "nothing found" outcome)', () => {
    expect(() => CartSchema.parse({ ...validCart, items: [] })).not.toThrow()
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

describe('AnalyzeRequestSchema', () => {
  const validRequest = { markdown: '# Cart\n- item', url: 'https://amazon.com/cart' }

  it('accepts a valid request without userWeights', () => {
    expect(() => AnalyzeRequestSchema.parse(validRequest)).not.toThrow()
  })

  it('accepts valid userWeights including opt-out (0)', () => {
    const req = { ...validRequest, userWeights: { political_giving: 0, labor: 2.5 } }
    expect(() => AnalyzeRequestSchema.parse(req)).not.toThrow()
  })

  it('REJECTS negative weights — polarity inversion is disallowed', () => {
    const req = { ...validRequest, userWeights: { political_giving: -5 } }
    expect(() => AnalyzeRequestSchema.parse(req)).toThrow()
  })

  it('rejects weights above the maximum', () => {
    const req = { ...validRequest, userWeights: { labor: 100 } }
    expect(() => AnalyzeRequestSchema.parse(req)).toThrow()
  })

  it('rejects unknown category IDs in userWeights', () => {
    const req = { ...validRequest, userWeights: { made_up: 1 } }
    expect(() => AnalyzeRequestSchema.parse(req)).toThrow()
  })

  it('rejects empty markdown', () => {
    expect(() => AnalyzeRequestSchema.parse({ ...validRequest, markdown: '' })).toThrow()
  })

  it('rejects oversized markdown', () => {
    expect(() =>
      AnalyzeRequestSchema.parse({ ...validRequest, markdown: 'x'.repeat(300_000) }),
    ).toThrow()
  })
})

describe('SuggestRequestSchema', () => {
  it('accepts a valid suggestion', () => {
    expect(() =>
      SuggestRequestSchema.parse({ label: 'Misinformation', rationale: 'funds disinfo' }),
    ).not.toThrow()
  })

  it('rejects a too-short label', () => {
    expect(() => SuggestRequestSchema.parse({ label: 'x' })).toThrow()
  })

  it('rejects an oversized rationale', () => {
    expect(() =>
      SuggestRequestSchema.parse({ label: 'Valid label', rationale: 'y'.repeat(600) }),
    ).toThrow()
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
