import { describe, it, expect } from 'vitest'
import { FakeModelProvider } from '@ethical-shopper/core/fakes'
import { extractCart } from '../src/pipeline/extractCart.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validCartJson(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    items: [
      {
        name: 'Wireless Headphones',
        brand: 'Sony',
        sellingCompany: 'Amazon',
        price: 79.99,
        url: 'https://amazon.com/dp/B08N5WRWNW',
      },
    ],
    sourceUrl: 'https://www.amazon.com/cart',
    ...overrides,
  })
}

// ─── extractCart ──────────────────────────────────────────────────────────────

describe('extractCart', () => {
  it('parses a valid cart from model response', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(validCartJson())

    const cart = await extractCart('Mock page content with cart items', provider)

    expect(cart.items).toHaveLength(1)
    expect(cart.items[0]?.sellingCompany).toBe('Amazon')
    expect(cart.items[0]?.brand).toBe('Sony')
    expect(cart.items[0]?.price).toBe(79.99)
    expect(cart.sourceUrl).toBe('https://www.amazon.com/cart')
  })

  it('makes exactly one model call', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(validCartJson())

    await extractCart('some markdown', provider)

    expect(provider.callCount).toBe(1)
  })

  it('sends a system prompt that mentions shopping cart and JSON', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(validCartJson())

    await extractCart('some markdown', provider)

    const systemMsg = provider.calls[0]?.messages.find((m) => m.role === 'system')
    expect(systemMsg?.content).toContain('shopping cart')
    expect(systemMsg?.content).toContain('JSON')
  })

  it('truncates very long markdown before sending', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(validCartJson())

    const longMarkdown = 'x'.repeat(50_000)
    await extractCart(longMarkdown, provider)

    const userMsg = provider.calls[0]?.messages.find((m) => m.role === 'user')
    // The user message should contain truncated markdown, not the full 50k chars
    expect(userMsg!.content.length).toBeLessThan(20_000)
  })

  it('supports multiple items in the cart', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(
      JSON.stringify({
        items: [
          { name: 'Item A', brand: 'BrandA', sellingCompany: 'Amazon', price: 10, url: null },
          { name: 'Item B', brand: null, sellingCompany: 'Amazon', price: null, url: null },
          { name: 'Item C', brand: 'BrandC', sellingCompany: 'Target', price: 25.5, url: null },
        ],
        sourceUrl: 'https://amazon.com/cart',
      }),
    )

    const cart = await extractCart('content', provider)

    expect(cart.items).toHaveLength(3)
    expect(cart.items[1]?.brand).toBeNull()
    expect(cart.items[1]?.price).toBeNull()
    expect(cart.items[2]?.sellingCompany).toBe('Target')
  })

  it('throws a SyntaxError when model returns invalid JSON', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue('not valid json {{{')

    await expect(extractCart('content', provider)).rejects.toThrow(SyntaxError)
  })

  it('returns an empty cart gracefully when the model finds no items', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(JSON.stringify({ items: [], sourceUrl: 'https://example.com' }))

    const cart = await extractCart('content', provider)
    expect(cart.items).toHaveLength(0)
  })

  it('throws when model call fails', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(new Error('model timeout'))

    await expect(extractCart('content', provider)).rejects.toThrow('model timeout')
  })
})
