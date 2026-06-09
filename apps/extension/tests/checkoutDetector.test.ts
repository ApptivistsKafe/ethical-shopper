import { describe, it, expect } from 'vitest'
import { isCheckoutPage } from '../src/services/checkoutDetector'

// Minimal mock document — isCheckoutPage only inspects the URL in this version.
const doc = {} as Document

// ─── Domain-specific URL pattern matching ─────────────────────────────────────

describe('isCheckoutPage — domain-specific patterns', () => {
  it('detects Amazon cart page', () => {
    expect(isCheckoutPage('https://www.amazon.com/gp/cart/view.html', doc)).toBe(true)
  })

  it('detects Amazon single-page checkout', () => {
    expect(isCheckoutPage('https://www.amazon.com/gp/buy/spc/handlers/display.html', doc)).toBe(true)
  })

  it('detects eBay purchase history (post-checkout)', () => {
    expect(isCheckoutPage('https://www.ebay.com/myb/PurchaseHistory', doc)).toBe(true)
  })

  it('detects Etsy cart', () => {
    expect(isCheckoutPage('https://www.etsy.com/cart', doc)).toBe(true)
  })

  it('detects Walmart checkout', () => {
    expect(isCheckoutPage('https://www.walmart.com/checkout/', doc)).toBe(true)
  })

  it('detects Target cart review', () => {
    expect(isCheckoutPage('https://www.target.com/co-cart', doc)).toBe(true)
  })

  it('detects Best Buy checkout', () => {
    expect(isCheckoutPage('https://www.bestbuy.com/checkout/', doc)).toBe(true)
  })

  it('detects Nike cart', () => {
    expect(isCheckoutPage('https://www.nike.com/cart', doc)).toBe(true)
  })

  it('detects Apple Bag page', () => {
    expect(isCheckoutPage('https://www.apple.com/shop/bag', doc)).toBe(true)
  })
})

// ─── Generic URL keyword heuristic ────────────────────────────────────────────

describe('isCheckoutPage — URL keyword heuristic', () => {
  it('detects /checkout on an arbitrary site', () => {
    expect(isCheckoutPage('https://shop.example.com/checkout', doc)).toBe(true)
  })

  it('detects /cart on an arbitrary site', () => {
    expect(isCheckoutPage('https://store.example.com/cart', doc)).toBe(true)
  })

  it('detects shopping-bag path', () => {
    expect(isCheckoutPage('https://brand.com/shopping-bag', doc)).toBe(true)
  })

  it('detects order-review path', () => {
    expect(isCheckoutPage('https://shop.example.com/order-review', doc)).toBe(true)
  })

  it('does NOT match "cart" within an unrelated word', () => {
    // "cartography" should not match — the regex uses word boundaries
    expect(isCheckoutPage('https://example.com/cartography', doc)).toBe(false)
  })
})

// ─── Non-checkout pages ───────────────────────────────────────────────────────

describe('isCheckoutPage — non-checkout pages', () => {
  it('returns false for a product listing page', () => {
    expect(isCheckoutPage('https://example.com/products', doc)).toBe(false)
  })

  it('returns false for a product detail page', () => {
    expect(isCheckoutPage('https://nike.com/shop/running-shoes/abc123', doc)).toBe(false)
  })

  it('returns false for an Amazon product page', () => {
    expect(isCheckoutPage('https://www.amazon.com/dp/B08N5WRWNW', doc)).toBe(false)
  })

  it('returns false for a homepage', () => {
    expect(isCheckoutPage('https://amazon.com/', doc)).toBe(false)
  })

  it('returns false for a search results page', () => {
    expect(isCheckoutPage('https://www.amazon.com/s?k=headphones', doc)).toBe(false)
  })
})

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe('isCheckoutPage — edge cases', () => {
  it('handles an empty string URL without throwing', () => {
    expect(() => isCheckoutPage('', doc)).not.toThrow()
  })

  it('handles a malformed URL without throwing', () => {
    expect(() => isCheckoutPage('not-a-url', doc)).not.toThrow()
  })
})
