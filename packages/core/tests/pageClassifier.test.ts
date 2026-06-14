import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  classifyPage,
  classifyText,
  extractTextSignals,
  isAdultHost,
  type PageSignals,
} from '../src/pageClassifier.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const load = (name: string) => readFileSync(resolve(__dirname, 'fixtures', name), 'utf8')

// ─── Real-world fixtures: positive (commerce) and negative (everything else) ───

describe('classifyText — real-world fixtures', () => {
  const cases: Array<{ file: string; url: string; expect: 'allow' | 'reject'; note: string }> = [
    // TRUE POSITIVES — genuine product checkout/cart pages
    {
      file: 'amazon-cart.md',
      url: 'https://www.amazon.com/gp/cart/view.html',
      expect: 'allow',
      note: 'Amazon cart',
    },
    { file: 'etsy-cart.md', url: 'https://www.etsy.com/cart', expect: 'allow', note: 'Etsy cart' },
    {
      file: 'shopify-checkout.md',
      url: 'https://www.allbirds.com/checkout',
      expect: 'allow',
      note: 'Shopify checkout',
    },

    // TRUE NEGATIVES — not product checkouts
    {
      file: 'news-article.md',
      url: 'https://news.example.com/bike-lanes',
      expect: 'reject',
      note: 'news article',
    },
    {
      file: 'saas-pricing.md',
      url: 'https://acme.io/pricing',
      expect: 'reject',
      note: 'SaaS pricing (prices but no cart)',
    },

    // ADULT — double-caught: fails positive AND trips negative
    {
      file: 'adult-subscription.md',
      url: 'https://onlyfans.com/somecreator',
      expect: 'reject',
      note: 'adult subscription',
    },
  ]

  for (const c of cases) {
    it(`${c.expect.toUpperCase()}s ${c.note}`, () => {
      const result = classifyText(load(c.file), c.url)
      expect(result.decision, `reasons: ${result.reasons.join(', ')}`).toBe(c.expect)
    })
  }

  it('the adult fixture is caught by BOTH gates (defense in depth)', () => {
    const result = classifyText(load('adult-subscription.md'), 'https://onlyfans.com/x')
    expect(result.isAdult).toBe(true)
    expect(result.isCommerce).toBe(false)
  })

  it('real cart pages are recognized as commerce', () => {
    expect(classifyText(load('amazon-cart.md'), 'https://amazon.com/cart').isCommerce).toBe(true)
    expect(
      classifyText(load('shopify-checkout.md'), 'https://allbirds.com/checkout').isCommerce,
    ).toBe(true)
  })
})

// ─── isAdultHost ────────────────────────────────────────────────────────────────

describe('isAdultHost', () => {
  it('matches known adult domains (with and without www / subdomains)', () => {
    expect(isAdultHost('https://onlyfans.com/x')).toBe(true)
    expect(isAdultHost('https://www.onlyfans.com/x')).toBe(true)
    expect(isAdultHost('https://cdn.onlyfans.com/asset')).toBe(true)
    expect(isAdultHost('https://pornhub.com/')).toBe(true)
  })

  it('does not match legitimate retailers', () => {
    expect(isAdultHost('https://amazon.com/cart')).toBe(false)
    expect(isAdultHost('https://nike.com/checkout')).toBe(false)
  })

  it('does not match a retailer whose name merely contains an adult-ish substring', () => {
    // guards against naive substring matching: "fans" in "fansedge.com"
    expect(isAdultHost('https://fansedge.com/cart')).toBe(false)
  })

  it('handles malformed URLs without throwing', () => {
    expect(isAdultHost('not-a-url')).toBe(false)
    expect(isAdultHost('')).toBe(false)
  })
})

// ─── classifyPage — decision logic over synthetic signals ──────────────────────

function signals(overrides: Partial<PageSignals> = {}): PageSignals {
  return {
    url: 'https://shop.example.com/cart',
    hasProductSchema: false,
    priceMatchCount: 0,
    commerceKeywordCount: 0,
    hasAdultRating: false,
    isKnownAdultDomain: false,
    adultKeywordCount: 0,
    ...overrides,
  }
}

describe('classifyPage — positive gate', () => {
  it('allows on product schema alone', () => {
    const r = classifyPage(signals({ hasProductSchema: true }))
    expect(r.decision).toBe('allow')
    expect(r.reasons).toContain('product-schema')
  })

  it('allows on price + enough commerce keywords', () => {
    expect(classifyPage(signals({ priceMatchCount: 3, commerceKeywordCount: 4 })).decision).toBe(
      'allow',
    )
  })

  it('rejects price with too few commerce keywords (e.g. a pricing page)', () => {
    expect(classifyPage(signals({ priceMatchCount: 3, commerceKeywordCount: 1 })).decision).toBe(
      'reject',
    )
  })

  it('rejects commerce keywords with no price', () => {
    expect(classifyPage(signals({ priceMatchCount: 0, commerceKeywordCount: 5 })).decision).toBe(
      'reject',
    )
  })

  it('rejects a page with neither', () => {
    expect(classifyPage(signals()).decision).toBe('reject')
  })
})

describe('classifyPage — negative gate overrides positive', () => {
  it('rejects an otherwise-commerce page on known adult domain', () => {
    const r = classifyPage(signals({ hasProductSchema: true, isKnownAdultDomain: true }))
    expect(r.decision).toBe('reject')
    expect(r.isAdult).toBe(true)
  })

  it('rejects on adult rating label even with commerce signals', () => {
    const r = classifyPage(
      signals({ priceMatchCount: 5, commerceKeywordCount: 5, hasAdultRating: true }),
    )
    expect(r.decision).toBe('reject')
  })

  it('rejects when adult keyword count meets threshold', () => {
    expect(classifyPage(signals({ hasProductSchema: true, adultKeywordCount: 2 })).decision).toBe(
      'reject',
    )
  })

  it('a single incidental adult keyword does NOT trip the gate', () => {
    const r = classifyPage(signals({ hasProductSchema: true, adultKeywordCount: 1 }))
    expect(r.isAdult).toBe(false)
    expect(r.decision).toBe('allow')
  })
})

// ─── extractTextSignals ────────────────────────────────────────────────────────

describe('extractTextSignals', () => {
  it('counts prices across currencies', () => {
    const s = extractTextSignals('Total $19.99 and £5.00 and 12.50 USD', 'https://x.com/cart')
    expect(s.priceMatchCount).toBeGreaterThanOrEqual(3)
  })

  it('counts distinct commerce keywords (not repeats)', () => {
    const s = extractTextSignals('Subtotal subtotal SUBTOTAL checkout', 'https://x.com')
    // "subtotal" distinct = 1, "checkout" distinct = 1
    expect(s.commerceKeywordCount).toBe(2)
  })

  it('detects residual Product JSON-LD if present in text', () => {
    const s = extractTextSignals('{"@type":"Product","name":"x"}', 'https://x.com')
    expect(s.hasProductSchema).toBe(true)
  })

  it('flags the RTA label embedded in text', () => {
    const s = extractTextSignals('RTA-5042-1996-1400-1577-RTA', 'https://x.com')
    expect(s.hasAdultRating).toBe(true)
  })

  it('derives adult-domain flag from the URL', () => {
    expect(extractTextSignals('hello', 'https://onlyfans.com/x').isKnownAdultDomain).toBe(true)
    expect(extractTextSignals('hello', 'https://amazon.com/cart').isKnownAdultDomain).toBe(false)
  })
})
