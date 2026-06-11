import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { FakeModelProvider } from '@ethical-shopper/core/fakes'
import { sanitizeUntrustedText } from '@ethical-shopper/core'
import { extractCart } from '../src/pipeline/extractCart.js'
import { companiesToScore } from '../src/pipeline/companiesToScore.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const load = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')

const AMAZON = load('amazon-cart.md')
const ETSY = load('etsy-cart.md')

// ─── Sanitizer behavior on realistic cart pages ───────────────────────────────

describe('sanitizer on realistic cart-page markdown', () => {
  it('keeps the product signal from the Amazon fixture', () => {
    const out = sanitizeUntrustedText(AMAZON)
    expect(out).toContain('Sony WH-1000XM5')
    expect(out).toContain('$348.00')
    expect(out).toContain('Atlas Coffee Club')
    expect(out).toContain("Nike Men's Revolution 7")
    expect(out).toContain('Size: 10.5')
  })

  it('drops repeated nav/footer chrome beyond the repeat cap', () => {
    const out = sanitizeUntrustedText(AMAZON)
    const navLine = 'Hello, sign in Account & Lists Returns & Orders'
    const occurrences = out.split('\n').filter((l) => l.trim() === navLine).length
    expect(occurrences).toBeLessThanOrEqual(3)
    // Net effect: sanitized output is smaller than the input
    expect(out.length).toBeLessThan(AMAZON.length)
  })

  it('keeps the product signal from the Etsy fixture', () => {
    const out = sanitizeUntrustedText(ETSY)
    expect(out).toContain('Personalized Walnut Cutting Board')
    expect(out).toContain('WoodGrain Studio Co')
    expect(out).toContain('Organic Cotton Canvas Tote Bag')
    expect(out).toContain('$89.00')
  })
})

// ─── End-to-end extraction flow against fixtures ──────────────────────────────

describe('extractCart with fixture pages', () => {
  it('Amazon fixture: prompt carries the products; extraction resolves a multi-brand cart', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(
      JSON.stringify({
        items: [
          {
            name: 'Sony WH-1000XM5 Wireless Noise Canceling Headphones',
            brand: 'Sony',
            sellingCompany: 'Amazon',
            price: 348.0,
            url: null,
          },
          {
            name: 'Atlas Coffee Club Single Origin Subscription',
            brand: 'Atlas Coffee Club',
            sellingCompany: 'Amazon',
            price: 28.5,
            url: null,
          },
          {
            name: "Nike Men's Revolution 7 Running Shoe",
            brand: 'Nike',
            sellingCompany: 'Amazon',
            price: 64.99,
            url: null,
            requiredAttributes: { type: 'running shoe', size: '10.5' },
          },
        ],
        sourceUrl: 'https://www.amazon.com/gp/cart/view.html',
      }),
    )

    const cart = await extractCart(AMAZON, provider)

    // The prompt the model received must contain the real product signal
    const userMsg = provider.calls[0]?.messages.find((m) => m.role === 'user')
    expect(userMsg?.content).toContain('Sony WH-1000XM5')
    expect(userMsg?.content).toContain('Revolution 7')

    // Downstream: seller + all three brands are queued for scoring
    const companies = companiesToScore(cart, 'https://www.amazon.com/gp/cart/view.html')
    const names = companies.map((c) => c.name)
    expect(names).toEqual(expect.arrayContaining(['Amazon', 'Sony', 'Atlas Coffee Club', 'Nike']))
    expect(companies.find((c) => c.name === 'Amazon')?.role).toBe('seller')
    expect(companies.find((c) => c.name === 'Sony')?.role).toBe('brand')
  })

  it('Etsy fixture: marketplace seller plus shop brands', async () => {
    const provider = new FakeModelProvider()
    provider.enqueue(
      JSON.stringify({
        items: [
          {
            name: 'Personalized Walnut Cutting Board 12x18',
            brand: 'WoodGrain Studio Co',
            sellingCompany: 'Etsy',
            price: 89.0,
            url: null,
          },
          {
            name: 'Organic Cotton Canvas Tote Bag',
            brand: 'TerraThread Goods',
            sellingCompany: 'Etsy',
            price: 34.0,
            url: null,
          },
        ],
        sourceUrl: 'https://www.etsy.com/cart',
      }),
    )

    const cart = await extractCart(ETSY, provider)
    const companies = companiesToScore(cart, 'https://www.etsy.com/cart')
    expect(companies.map((c) => c.name)).toEqual(
      expect.arrayContaining(['Etsy', 'WoodGrain Studio Co', 'TerraThread Goods']),
    )
  })
})
