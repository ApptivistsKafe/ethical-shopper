import { describe, it, expect, beforeEach } from 'vitest'
import { FakeModelProvider, InMemoryStore, FakeContextSource } from '@ethical-shopper/core/fakes'
import { EthicalStatus, ALL_CATEGORY_IDS, type CartItem } from '@ethical-shopper/core'
import { makeRecommendFn } from '../src/pipeline/recommendAlternatives.js'
import { makeScoreCompanyFn } from '../src/pipeline/scoreCompany.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeScoringResponse(
  overrides: Partial<Record<string, EthicalStatus | null>> = {},
): string {
  return JSON.stringify({
    categories: ALL_CATEGORY_IDS.map((id) => ({
      id,
      score: id in overrides ? overrides[id] : null,
      blurb: `No notable ${id} record found.`,
      confidence: 0.5,
    })),
  })
}

function makeRecommendModelResponse(brands: string[]): string {
  return JSON.stringify({
    alternatives: brands.map((brand, i) => ({
      productName: `${brand} Alternative Product ${(i + 1).toString()}`,
      brand,
      sellingCompany: brand,
      approxPrice: 50 + i,
      url: `https://${brand.toLowerCase().replace(/\s+/g, '')}.com/product`,
      reason: `${brand} is a certified B-Corp with a documented living-wage policy.`,
    })),
  })
}

const ITEM: CartItem = {
  name: "Nike Men's Revolution 7 Running Shoe",
  brand: 'Nike',
  sellingCompany: 'Amazon',
  price: 64.99,
  url: 'https://amazon.com/dp/x',
  requiredAttributes: { type: 'running shoe', size: '10.5' },
}

// ─── makeRecommendFn ──────────────────────────────────────────────────────────

describe('makeRecommendFn', () => {
  let provider: FakeModelProvider
  let store: InMemoryStore

  beforeEach(() => {
    provider = new FakeModelProvider()
    store = new InMemoryStore()
  })

  function build(contextSource?: FakeContextSource) {
    return makeRecommendFn({
      contextSource,
      scoreCompany: makeScoreCompanyFn(contextSource),
    })
  }

  it('returns alternatives with ethics views attached', async () => {
    // 1 recommend call + 2 scoring calls (one per alternative brand)
    provider.enqueue(makeRecommendModelResponse(['Allbirds', 'Veja']))
    provider.enqueue(makeScoringResponse({ labor: EthicalStatus.Excellent }))
    provider.enqueue(makeScoringResponse({ climate: EthicalStatus.Good }))

    const recommend = build()
    const result = await recommend(ITEM, provider, store)

    expect(result.alternatives).toHaveLength(2)
    expect(result.alternatives[0]?.brand).toBe('Allbirds')
    expect(result.alternatives[0]?.companyView?.companyName).toBe('Allbirds')
    expect(result.alternatives[0]?.reason).toContain('B-Corp')
    expect(result.alternatives[1]?.companyView?.companyName).toBe('Veja')
    expect(provider.callCount).toBe(3)
  })

  it('includes item details and requiredAttributes in the prompt', async () => {
    provider.enqueue(makeRecommendModelResponse([]))

    const recommend = build()
    await recommend(ITEM, provider, store)

    const userMsg = provider.calls[0]?.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toContain('Revolution 7')
    expect(userMsg?.content).toContain('Nike')
    expect(userMsg?.content).toContain('running shoe')
    expect(userMsg?.content).toContain('10.5')
  })

  it('system prompt forbids same-brand recommendations and demands real products', async () => {
    provider.enqueue(makeRecommendModelResponse([]))

    const recommend = build()
    await recommend(ITEM, provider, store)

    const systemMsg = provider.calls[0]?.messages.find((m) => m.role === 'system')
    expect(systemMsg?.content).toMatch(/NEVER recommend products from the same brand/i)
    expect(systemMsg?.content).toMatch(/never invent/i)
    expect(systemMsg?.content).toMatch(/untrusted/i)
  })

  it('enriches the prompt with sanitized, delimited search context', async () => {
    const contextSource = new FakeContextSource()
    contextSource.setResults([
      {
        title: 'Best ethical running​ shoes 2026',
        url: 'https://example.com/guide',
        snippet: 'Allbirds and Veja top the sustainability‮ rankings.',
      },
    ])
    provider.enqueue(makeRecommendModelResponse([]))

    const recommend = build(contextSource)
    await recommend(ITEM, provider, store)

    expect(contextSource.queries[0]).toContain('alternatives')
    const userMsg = provider.calls[0]?.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toContain('WEB SEARCH RESULTS')
    expect(userMsg?.content).toContain('Allbirds and Veja')
    expect(userMsg?.content).not.toContain('​')
    expect(userMsg?.content).not.toContain('‮')
  })

  it('continues without context when the search source throws', async () => {
    const broken = new FakeContextSource()
    broken.search = async () => {
      throw new Error('search down')
    }
    provider.enqueue(makeRecommendModelResponse(['Patagonia']))
    provider.enqueue(makeScoringResponse())

    const recommend = build(broken)
    const result = await recommend(ITEM, provider, store)
    expect(result.alternatives).toHaveLength(1)
  })

  it('returns an empty list when the model finds no better alternative', async () => {
    provider.enqueue(JSON.stringify({ alternatives: [] }))

    const recommend = build()
    const result = await recommend(ITEM, provider, store)
    expect(result.alternatives).toHaveLength(0)
    expect(provider.callCount).toBe(1) // no scoring calls for zero alternatives
  })

  it('degrades to companyView: null when scoring an alternative fails', async () => {
    provider.enqueue(makeRecommendModelResponse(['Allbirds']))
    provider.enqueue(new Error('scoring exploded'))

    const recommend = build()
    const result = await recommend(ITEM, provider, store)

    expect(result.alternatives).toHaveLength(1)
    expect(result.alternatives[0]?.brand).toBe('Allbirds')
    expect(result.alternatives[0]?.companyView).toBeNull()
  })

  it('reuses the scoring cache — second recommend pays no scoring calls', async () => {
    provider.enqueue(makeRecommendModelResponse(['Allbirds']))
    provider.enqueue(makeScoringResponse())
    const recommend = build()
    await recommend(ITEM, provider, store)
    expect(provider.callCount).toBe(2)

    // Second item recommending the same brand: 1 recommend call, 0 scoring (cache hit)
    provider.enqueue(makeRecommendModelResponse(['Allbirds']))
    await recommend({ ...ITEM, name: 'Different shoe' }, provider, store)
    expect(provider.callCount).toBe(3)
  })

  it('applies user weights to the attached company views', async () => {
    provider.enqueue(makeRecommendModelResponse(['Allbirds']))
    provider.enqueue(makeScoringResponse({ political_giving: EthicalStatus.Poor }))

    const recommend = build()
    const result = await recommend(ITEM, provider, store, { political_giving: 0 })

    // Opted-out category must be hidden from the alternative's view
    const view = result.alternatives[0]?.companyView
    expect(view?.visibleCategories.some((c) => c.id === 'political_giving')).toBe(false)
  })

  it('tolerates fenced model output', async () => {
    provider.enqueue('```json\n' + makeRecommendModelResponse(['Veja']) + '\n```')
    provider.enqueue(makeScoringResponse())

    const recommend = build()
    const result = await recommend(ITEM, provider, store)
    expect(result.alternatives[0]?.brand).toBe('Veja')
  })

  it('throws on malformed model output', async () => {
    provider.enqueue('not json at all')
    const recommend = build()
    await expect(recommend(ITEM, provider, store)).rejects.toThrow()
  })

  it('caps alternatives at 3 even if the model returns more', async () => {
    provider.enqueue(makeRecommendModelResponse(['A Co', 'B Co', 'C Co', 'D Co', 'E Co']))
    provider.enqueueMany([makeScoringResponse(), makeScoringResponse(), makeScoringResponse()])

    const recommend = build()
    const result = await recommend(ITEM, provider, store)
    expect(result.alternatives).toHaveLength(3)
  })
})
