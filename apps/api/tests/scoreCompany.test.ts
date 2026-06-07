import { describe, it, expect, beforeEach } from 'vitest'
import { FakeModelProvider } from '@ethical-shopper/core/fakes'
import { InMemoryStore } from '@ethical-shopper/core/fakes'
import { FakeContextSource } from '@ethical-shopper/core/fakes'
import { EthicalStatus, ALL_CATEGORY_IDS } from '@ethical-shopper/core'
import { makeScoreCompanyFn } from '../src/pipeline/scoreCompany.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build a model scoring response JSON string with full taxonomy.
 * Provide overrides as { categoryId: EthicalStatus | null }.
 */
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

// ─── scoreCompany ─────────────────────────────────────────────────────────────

describe('makeScoreCompanyFn', () => {
  let provider: FakeModelProvider
  let store: InMemoryStore

  beforeEach(() => {
    provider = new FakeModelProvider()
    store = new InMemoryStore()
  })

  it('scores a company and returns a valid EthicsReport', async () => {
    provider.enqueue(makeScoringResponse({ labor: EthicalStatus.Poor }))
    const scoreCompany = makeScoreCompanyFn()

    const report = await scoreCompany('Amazon', 'amazon.com', provider, store)

    expect(report.company.name).toBe('Amazon')
    expect(report.company.domain).toBe('amazon.com')
    expect(report.categories).toHaveLength(ALL_CATEGORY_IDS.length)
    expect(report.categories.find((c) => c.id === 'labor')?.score).toBe(EthicalStatus.Poor)
    expect(provider.callCount).toBe(1)
  })

  it('uses domain-based cache key (strips www)', async () => {
    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn()

    await scoreCompany('Amazon', 'www.amazon.com', provider, store)

    // Should be stored under "company:amazon.com" (www stripped)
    const cached = await store.getReport('company:amazon.com')
    expect(cached?.company.name).toBe('Amazon')
  })

  it('returns cached result without calling the model again', async () => {
    // Prime cache
    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn()
    await scoreCompany('Patagonia', 'patagonia.com', provider, store)

    // Second call — should serve from cache
    const report = await scoreCompany('Patagonia', 'patagonia.com', provider, store)

    expect(provider.callCount).toBe(1)
    expect(report.company.name).toBe('Patagonia')
  })

  it('re-scores a company when the cached report is stale', async () => {
    // Prime cache
    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn()
    await scoreCompany('Nike', 'nike.com', provider, store)

    // Mark cache as 8 days old (past the 7-day staleness window)
    store.setReportAge('company:nike.com', Date.now() - 8 * 24 * 60 * 60 * 1000)

    // Second call should trigger a fresh score
    provider.enqueue(makeScoringResponse({ labor: EthicalStatus.Concerning }))
    const report = await scoreCompany('Nike', 'nike.com', provider, store)

    expect(provider.callCount).toBe(2)
    expect(report.categories.find((c) => c.id === 'labor')?.score).toBe(EthicalStatus.Concerning)
  })

  it('computes overallScore deterministically from categories', async () => {
    // All Excellent → should be Excellent
    const allExcellent: Partial<Record<string, EthicalStatus>> = {}
    for (const id of ALL_CATEGORY_IDS) {
      allExcellent[id] = EthicalStatus.Excellent
    }
    provider.enqueue(makeScoringResponse(allExcellent))
    const scoreCompany = makeScoreCompanyFn()

    const report = await scoreCompany('GoodCo', 'goodco.com', provider, store)

    expect(report.overallScore).toBe(EthicalStatus.Excellent)
  })

  it('sends a system prompt containing all taxonomy category IDs', async () => {
    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn()
    await scoreCompany('Meta', 'meta.com', provider, store)

    const systemMsg = provider.calls[0]?.messages.find((m) => m.role === 'system')
    for (const id of ALL_CATEGORY_IDS) {
      expect(systemMsg?.content).toContain(id)
    }
  })

  it('includes company name and domain in the user message', async () => {
    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn()
    await scoreCompany('Walmart', 'walmart.com', provider, store)

    const userMsg = provider.calls[0]?.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toContain('Walmart')
    expect(userMsg?.content).toContain('walmart.com')
  })

  it('logs a suggested new category to the store', async () => {
    provider.enqueue(
      JSON.stringify({
        categories: ALL_CATEGORY_IDS.map((id) => ({
          id,
          score: null,
          blurb: 'No notable record.',
          confidence: 0.5,
        })),
        suggestedNewCategory: {
          label: 'Misinformation',
          rationale: 'Company funds disinformation campaigns targeting elections.',
          source: 'model',
        },
      }),
    )
    const scoreCompany = makeScoreCompanyFn()

    const report = await scoreCompany('Meta', 'meta.com', provider, store)

    expect(report.suggestedNewCategory?.label).toBe('Misinformation')
    const { modelSuggestions } = await store.getSuggestions()
    expect(modelSuggestions).toHaveLength(1)
    expect(modelSuggestions[0]?.normalizedLabel).toBe('misinformation')
    expect(modelSuggestions[0]?.count).toBe(1)
  })

  it('enriches the prompt with context source results when provided', async () => {
    const contextSource = new FakeContextSource()
    contextSource.setResults([
      { title: 'Walmart labor violations 2024', url: 'https://example.com', snippet: 'Wage theft documented.' },
    ])

    provider.enqueue(makeScoringResponse({ labor: EthicalStatus.Poor }))
    const scoreCompany = makeScoreCompanyFn(contextSource)
    await scoreCompany('Walmart', 'walmart.com', provider, store)

    // Context source was queried
    expect(contextSource.queries).toHaveLength(1)
    expect(contextSource.queries[0]).toContain('Walmart')

    // Context content was injected into the user message
    const userMsg = provider.calls[0]?.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toContain('Walmart labor violations 2024')
    expect(userMsg?.content).toContain('Wage theft documented.')
  })

  it('continues scoring even when context source throws', async () => {
    const brokenSource: FakeContextSource = new FakeContextSource()
    // Override search to throw
    brokenSource.search = async () => {
      throw new Error('search API down')
    }

    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn(brokenSource)

    // Should not throw — context failure is best-effort
    const report = await scoreCompany('Amazon', 'amazon.com', provider, store)
    expect(report.company.name).toBe('Amazon')
    expect(provider.callCount).toBe(1)
  })

  it('handles a company with no domain gracefully', async () => {
    provider.enqueue(makeScoringResponse())
    const scoreCompany = makeScoreCompanyFn()

    const report = await scoreCompany('Whole Foods Market', null, provider, store)

    expect(report.company.name).toBe('Whole Foods Market')
    expect(report.company.domain).toBeNull()
    // Falls back to slug-based cache key
    expect(report.meta.cacheKey).toBe('company:whole-foods-market')
  })

  it('throws when model returns invalid JSON', async () => {
    provider.enqueue('not json {{')
    const scoreCompany = makeScoreCompanyFn()

    await expect(scoreCompany('Acme', 'acme.com', provider, store)).rejects.toThrow(SyntaxError)
  })

  it('throws when model returns invalid scoring schema', async () => {
    provider.enqueue(JSON.stringify({ categories: [{ id: 'nonexistent', score: 'Stellar' }] }))
    const scoreCompany = makeScoreCompanyFn()

    await expect(scoreCompany('Acme', 'acme.com', provider, store)).rejects.toThrow()
  })
})
