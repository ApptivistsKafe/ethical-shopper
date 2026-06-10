import { describe, it, expect, beforeEach } from 'vitest'
import { FakeModelProvider } from '../src/fakes/FakeModelProvider.js'
import { InMemoryStore } from '../src/fakes/InMemoryStore.js'
import { FakeContextSource } from '../src/fakes/FakeContextSource.js'
import { EthicalStatus, type EthicsReport } from '../src/types.js'
import { buildSuggestion } from '../src/suggestions.js'

// ─── FakeModelProvider ────────────────────────────────────────────────────────

describe('FakeModelProvider', () => {
  let provider: FakeModelProvider

  beforeEach(() => {
    provider = new FakeModelProvider()
  })

  it('returns queued responses in order', async () => {
    provider.enqueue('{"response": "first"}').enqueue('{"response": "second"}')
    const r1 = await provider.complete([{ role: 'user', content: 'hello' }])
    const r2 = await provider.complete([{ role: 'user', content: 'hello' }])
    expect(r1.content).toBe('{"response": "first"}')
    expect(r2.content).toBe('{"response": "second"}')
    expect(provider.callCount).toBe(2)
  })

  it('throws queued errors', async () => {
    provider.enqueue(new Error('model timeout'))
    await expect(provider.complete([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'model timeout',
    )
  })

  it('throws when queue is exhausted', async () => {
    await expect(provider.complete([{ role: 'user', content: 'test' }])).rejects.toThrow(
      'queue exhausted',
    )
  })

  it('records all calls for inspection', async () => {
    provider.enqueue('ok')
    await provider.complete([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ])
    expect(provider.calls[0]?.messages).toHaveLength(2)
  })

  it('supports function factories for dynamic responses', async () => {
    let count = 0
    provider.enqueue(() => `response ${++count}`)
    provider.enqueue(() => `response ${++count}`)
    const r1 = await provider.complete([{ role: 'user', content: 'x' }])
    const r2 = await provider.complete([{ role: 'user', content: 'x' }])
    expect(r1.content).toBe('response 1')
    expect(r2.content).toBe('response 2')
  })
})

// ─── InMemoryStore ────────────────────────────────────────────────────────────

function makeReport(cacheKey: string): EthicsReport {
  return {
    company: { name: 'TestCo', domain: 'testco.com', aliases: [] },
    categories: [],
    overallScore: EthicalStatus.Mixed,
    ratingBand: EthicalStatus.Mixed,
    meta: { modelUsed: 'fake', scoredAt: new Date().toISOString(), cacheKey },
  }
}

describe('InMemoryStore', () => {
  let store: InMemoryStore

  beforeEach(() => {
    store = new InMemoryStore()
  })

  it('returns null on cache miss', async () => {
    expect(await store.getReport('missing')).toBeNull()
  })

  it('stores and retrieves a report', async () => {
    const report = makeReport('company:testco.com')
    await store.setReport(report)
    const retrieved = await store.getReport('company:testco.com')
    expect(retrieved?.company.name).toBe('TestCo')
  })

  it('a newly set report is not stale', async () => {
    const report = makeReport('company:fresh.com')
    await store.setReport(report)
    expect(await store.isStale('company:fresh.com')).toBe(false)
  })

  it('a missing key is considered stale', async () => {
    expect(await store.isStale('company:never-cached.com')).toBe(true)
  })

  it('simulates staleness via setReportAge', async () => {
    const report = makeReport('company:old.com')
    await store.setReport(report)
    // Simulate a timestamp from 8 days ago
    store.setReportAge('company:old.com', Date.now() - 8 * 24 * 60 * 60 * 1000)
    expect(await store.isStale('company:old.com')).toBe(true)
  })

  it('overwrites an existing report on setReport', async () => {
    const key = 'company:testco.com'
    await store.setReport(makeReport(key))
    const updated = {
      ...makeReport(key),
      overallScore: EthicalStatus.Poor,
      ratingBand: EthicalStatus.Poor,
    }
    await store.setReport(updated)
    const result = await store.getReport(key)
    expect(result?.overallScore).toBe(EthicalStatus.Poor)
  })

  describe('suggestions', () => {
    it('deduplicates model suggestions by normalizedLabel', async () => {
      await store.logSuggestion(buildSuggestion('Misinformation', 'funds disinfo', 'model', 'Meta'))
      await store.logSuggestion(buildSuggestion('misinformation', 'funds disinfo', 'model', 'Fox'))
      await store.logSuggestion(
        buildSuggestion('MISINFORMATION', 'funds disinfo', 'model', 'Breitbart'),
      )
      const { modelSuggestions } = await store.getSuggestions()
      expect(modelSuggestions).toHaveLength(1)
      expect(modelSuggestions[0]?.count).toBe(3)
      expect(modelSuggestions[0]?.normalizedLabel).toBe('misinformation')
    })

    it('does NOT deduplicate user suggestions — retains all for frequency signal', async () => {
      await store.logSuggestion(buildSuggestion('Tax avoidance', 'offshore profits', 'user'))
      await store.logSuggestion(buildSuggestion('tax avoidance', 'offshore profits', 'user'))
      const { userSuggestions } = await store.getSuggestions()
      expect(userSuggestions).toHaveLength(2)
    })

    it('keeps model and user suggestions separate', async () => {
      await store.logSuggestion(buildSuggestion('Prison labor', 'uses prison labor', 'model'))
      await store.logSuggestion(buildSuggestion('Prison labor', 'uses prison labor', 'user'))
      const result = await store.getSuggestions()
      expect(result.modelSuggestions).toHaveLength(1)
      expect(result.userSuggestions).toHaveLength(1)
    })
  })
})

// ─── FakeContextSource ────────────────────────────────────────────────────────

describe('FakeContextSource', () => {
  it('returns configured results and records queries', async () => {
    const source = new FakeContextSource()
    source.setResults([{ title: 'Test result', url: 'https://example.com', snippet: 'A snippet.' }])
    const results = await source.search('patagonia ethics')
    expect(results).toHaveLength(1)
    expect(source.queries).toContain('patagonia ethics')
  })

  it('returns empty array when no results configured', async () => {
    const source = new FakeContextSource()
    expect(await source.search('anything')).toHaveLength(0)
  })
})
