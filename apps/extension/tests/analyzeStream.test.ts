import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { AnalyzeStreamEvent } from '@ethical-shopper/core'
import { EthicalStatus } from '@ethical-shopper/core'
import { streamAnalysis } from '../src/services/analyzeStream'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const encoder = new TextEncoder()

/** Build a ReadableStream that emits the given NDJSON events as one chunk. */
function ndjsonStream(events: AnalyzeStreamEvent[]): ReadableStream<Uint8Array> {
  const text = events.map((e) => JSON.stringify(e)).join('\n') + '\n'
  return new ReadableStream({
    start(c) {
      c.enqueue(encoder.encode(text))
      c.close()
    },
  })
}

/** Build a ReadableStream that emits provided raw chunks in order. */
function chunkedStream(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(c) {
      if (i < chunks.length) c.enqueue(chunks[i++]!)
      else c.close()
    },
  })
}

function stubFetch(stream: ReadableStream | null, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      body: stream,
      text: async () => 'Error text',
    }),
  )
}

const CART_EVENT: AnalyzeStreamEvent = {
  type: 'cart',
  cart: {
    items: [{ name: 'Shoes', brand: 'Nike', sellingCompany: 'Nike', price: 100, url: null }],
    sourceUrl: 'https://nike.com/cart',
  },
}

const VIEW_EVENT: AnalyzeStreamEvent = {
  type: 'companyView',
  view: {
    companyName: 'Nike',
    overallScore: EthicalStatus.Mixed,
    ratingBand: EthicalStatus.Mixed,
    color: 'hsl(60,100%,85%)',
    emoji: '😐',
    visibleCategories: [],
    explanation: '',
  },
}

const DONE_EVENT: AnalyzeStreamEvent = { type: 'done' }

// ─── streamAnalysis ───────────────────────────────────────────────────────────

describe('streamAnalysis', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  it('yields all events from a single-chunk NDJSON stream', async () => {
    stubFetch(ndjsonStream([CART_EVENT, VIEW_EVENT, DONE_EVENT]))

    const result: AnalyzeStreamEvent[] = []
    for await (const e of streamAnalysis({ markdown: 'x', url: 'https://nike.com' })) {
      result.push(e)
    }

    expect(result).toHaveLength(3)
    expect(result[0]?.type).toBe('cart')
    expect(result[1]?.type).toBe('companyView')
    expect(result[2]?.type).toBe('done')
  })

  it('yields events in order across multiple chunks', async () => {
    // Simulate chunked delivery: first event split across two network packets
    const line0 = JSON.stringify(CART_EVENT)
    const line1 = JSON.stringify(DONE_EVENT)
    const mid = Math.floor(line0.length / 2)

    const stream = chunkedStream([
      encoder.encode(line0.slice(0, mid)),
      encoder.encode(line0.slice(mid) + '\n' + line1 + '\n'),
    ])
    stubFetch(stream)

    const result: AnalyzeStreamEvent[] = []
    for await (const e of streamAnalysis({ markdown: 'x', url: 'https://nike.com' })) {
      result.push(e)
    }

    expect(result).toHaveLength(2)
    expect(result[0]?.type).toBe('cart')
    expect(result[1]?.type).toBe('done')
  })

  it('handles a stream that flushes the last event without a trailing newline', async () => {
    // Server closes stream without a final \n — should still yield the last event
    const text = JSON.stringify(CART_EVENT) + '\n' + JSON.stringify(DONE_EVENT)
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(text))
        c.close()
      },
    })
    stubFetch(stream)

    const result: AnalyzeStreamEvent[] = []
    for await (const e of streamAnalysis({ markdown: 'x', url: 'https://example.com' })) {
      result.push(e)
    }

    expect(result).toHaveLength(2)
    expect(result[1]?.type).toBe('done')
  })

  it('skips malformed JSON lines without throwing', async () => {
    const ndjson = 'not-json\n' + JSON.stringify(DONE_EVENT) + '\n'
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(encoder.encode(ndjson))
        c.close()
      },
    })
    stubFetch(stream)

    const result: AnalyzeStreamEvent[] = []
    for await (const e of streamAnalysis({ markdown: 'x', url: 'https://example.com' })) {
      result.push(e)
    }

    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('done')
  })

  it('yields an error event when fetch throws (network failure)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network offline')))

    const result: AnalyzeStreamEvent[] = []
    for await (const e of streamAnalysis({ markdown: 'x', url: 'https://example.com' })) {
      result.push(e)
    }

    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('error')
    const err = result[0] as Extract<AnalyzeStreamEvent, { type: 'error' }>
    expect(err.message).toContain('Network offline')
  })

  it('yields an error event on a non-200 HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, status: 503, body: null, text: async () => 'down' }),
    )

    const result: AnalyzeStreamEvent[] = []
    for await (const e of streamAnalysis({ markdown: 'x', url: 'https://example.com' })) {
      result.push(e)
    }

    expect(result).toHaveLength(1)
    expect(result[0]?.type).toBe('error')
  })

  it('sends request body with correct markdown and url fields', async () => {
    stubFetch(ndjsonStream([DONE_EVENT]))

    const fetchSpy = vi.mocked(globalThis.fetch)
    for await (const _ of streamAnalysis({
      markdown: 'my-markdown',
      url: 'https://shop.example.com/cart',
    })) {
      /* consume */
    }

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [, init] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(init?.body as string)
    expect(body.markdown).toBe('my-markdown')
    expect(body.url).toBe('https://shop.example.com/cart')
  })

  it('POSTs to /api/analyze', async () => {
    stubFetch(ndjsonStream([DONE_EVENT]))

    const fetchSpy = vi.mocked(globalThis.fetch)
    for await (const _ of streamAnalysis({ markdown: 'x', url: 'u' })) {
      /* consume */
    }

    const [url] = fetchSpy.mock.calls[0]!
    expect(String(url)).toContain('/api/analyze')
  })
})
