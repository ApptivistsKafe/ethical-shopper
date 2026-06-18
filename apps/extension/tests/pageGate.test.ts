import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import { extractDomSignals, classifyDom, textLooksLikeCart } from '../src/services/pageGate'

function domFrom(html: string, url: string): Document {
  return new JSDOM(html, { url }).window.document
}

// ─── Generalizable cart detection (URL-independent) ──────────────────────────────

describe('textLooksLikeCart', () => {
  it('detects a cart from subtotal + price (no URL needed — drawer case)', () => {
    expect(
      textLooksLikeCart('Your Cart (2)\nWomens Lounger\nSubtotal $128.00\nProceed to checkout'),
    ).toBe(true)
  })

  it('detects an Amazon-style cart', () => {
    expect(
      textLooksLikeCart('Shopping Cart\nSubtotal (3 items): $102.74\nProceed to checkout'),
    ).toBe(true)
  })

  it('does NOT fire on a product-listing page (prices + add-to-cart, no checkout affordance)', () => {
    expect(textLooksLikeCart('Running Shoes $98.00  Add to cart  Quantity  Free shipping')).toBe(
      false,
    )
  })

  it('does NOT fire on a content page with no commerce', () => {
    expect(textLooksLikeCart('Coffee is a brewed drink prepared from roasted coffee beans.')).toBe(
      false,
    )
  })

  it('does NOT fire on a shopping homepage with a "your cart" nav label + prices', () => {
    // Regression: the Amazon homepage has "Your Cart" (cart-icon label) + many
    // prices but is not a cart — weak labels must not trigger detection.
    expect(
      textLooksLikeCart(
        'Deals of the day $19.99 $5.00 $129.00  Hello, sign in  Your Cart  Buy again',
      ),
    ).toBe(false)
  })

  it('requires a price even when an affordance is present', () => {
    expect(textLooksLikeCart('Your cart is empty. Continue shopping.')).toBe(false)
  })

  it('returns false for empty text', () => {
    expect(textLooksLikeCart('')).toBe(false)
  })
})

// ─── DOM signal extraction ──────────────────────────────────────────────────────

describe('extractDomSignals', () => {
  it('reads og:type=product as a product-schema signal', () => {
    const doc = domFrom(
      `<head><meta property="og:type" content="product"></head><body>Shoes</body>`,
      'https://shop.example.com/p/shoes',
    )
    expect(extractDomSignals(doc).hasProductSchema).toBe(true)
  })

  it('reads JSON-LD Product markup as a product-schema signal', () => {
    const doc = domFrom(
      `<head><script type="application/ld+json">{"@type":"Product","name":"Shoe"}</script></head><body>x</body>`,
      'https://shop.example.com/p/shoe',
    )
    expect(extractDomSignals(doc).hasProductSchema).toBe(true)
  })

  it('reads the adult rating meta tag', () => {
    const doc = domFrom(
      `<head><meta name="rating" content="adult"></head><body>x</body>`,
      'https://example.com',
    )
    expect(extractDomSignals(doc).hasAdultRating).toBe(true)
  })

  it('detects the RTA label in the document head', () => {
    const doc = domFrom(
      `<head><meta name="RATING" content="RTA-5042-1996-1400-1577-RTA"></head><body>x</body>`,
      'https://example.com',
    )
    expect(extractDomSignals(doc).hasAdultRating).toBe(true)
  })

  it('counts commerce keywords and prices from body text', () => {
    const doc = domFrom(
      `<body><h1>Shopping Cart</h1><p>Subtotal $42.00</p><button>Proceed to checkout</button><p>Quantity: 2</p></body>`,
      'https://shop.example.com/cart',
    )
    const s = extractDomSignals(doc)
    expect(s.commerceKeywordCount).toBeGreaterThanOrEqual(3)
    expect(s.priceMatchCount).toBeGreaterThanOrEqual(1)
  })

  it('flags adult domain from the document URL', () => {
    const doc = domFrom(`<body>x</body>`, 'https://onlyfans.com/creator')
    expect(extractDomSignals(doc).isKnownAdultDomain).toBe(true)
  })
})

// ─── End-to-end client gate decisions ───────────────────────────────────────────

describe('classifyDom — gate decisions', () => {
  it('ALLOWS a realistic checkout page', () => {
    const doc = domFrom(
      `<head><meta property="og:type" content="product"></head>
       <body><h1>Shopping Cart</h1><p>Subtotal $128.00</p><p>Estimated total $139.20</p>
       <button>Proceed to checkout</button><p>Quantity: 1</p><p>Shipping FREE</p></body>`,
      'https://www.allbirds.com/cart',
    )
    expect(classifyDom(doc).decision).toBe('allow')
  })

  it('REJECTS an adult page even if it superficially looks shoppable', () => {
    const doc = domFrom(
      `<head><meta name="rating" content="RTA-5042-1996-1400-1577-RTA"></head>
       <body><p>Subscribe $9.99</p><button>Subscribe</button><p>checkout</p></body>`,
      'https://onlyfans.com/creator',
    )
    const r = classifyDom(doc)
    expect(r.decision).toBe('reject')
    expect(r.isAdult).toBe(true)
  })

  it('REJECTS a plain content page (no commerce)', () => {
    const doc = domFrom(
      `<body><article><h1>Breaking news</h1><p>A long story with no products.</p></article></body>`,
      'https://news.example.com/story',
    )
    expect(classifyDom(doc).decision).toBe('reject')
  })
})
