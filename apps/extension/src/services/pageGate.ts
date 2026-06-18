// Import from the dedicated subpath (not the barrel) so the content script,
// which runs on every page, never pulls in Zod or the rest of core.
import {
  classifyPage,
  isAdultHost,
  countDistinctKeywords,
  countMatches,
  PAGE_CLASSIFIER_VOCAB,
  type PageSignals,
  type PageClassification,
} from '@ethical-shopper/core/pageClassifier'

/**
 * Client-side content-safety gate.
 *
 * Runs in the content script BEFORE any page content leaves the user's machine.
 * For the innocent-user-on-an-adult-site case this means the content is never
 * sent anywhere — zero exposure. The decision logic (`classifyPage`) and the
 * vocabularies are shared with the server via @ethical-shopper/core; only this
 * DOM signal extraction is extension-local, because core stays DOM-free.
 *
 * The client has the FULL DOM, so it reads richer signals than the server's
 * text-only path: JSON-LD Product/Offer markup, og:type, and the rating meta tag.
 */
export function extractDomSignals(doc: Document): PageSignals {
  const url = doc.location?.href ?? window.location.href
  const text = (doc.body?.innerText ?? doc.body?.textContent ?? '').toLowerCase()

  return {
    url,
    hasProductSchema: hasProductSchema(doc),
    priceMatchCount: countMatches(text, new RegExp(PAGE_CLASSIFIER_VOCAB.PRICE_RE)),
    commerceKeywordCount: countDistinctKeywords(text, PAGE_CLASSIFIER_VOCAB.COMMERCE_KEYWORDS),
    hasAdultRating: hasAdultRating(doc),
    isKnownAdultDomain: isAdultHost(url),
    adultKeywordCount: countDistinctKeywords(text, PAGE_CLASSIFIER_VOCAB.ADULT_KEYWORDS),
  }
}

/** Convenience: extract DOM signals then classify. */
export function classifyDom(doc: Document): PageClassification {
  return classifyPage(extractDomSignals(doc))
}

// ─── Generalizable cart detection ───────────────────────────────────────────────

/**
 * STRONG cart/checkout affordances — phrases that appear only when an actual
 * cart/checkout total is being VIEWED, not in nav/header chrome. Deliberately
 * excludes weak labels like "your cart"/"your bag", which appear on shopping
 * homepages as cart-icon labels or mini-cart previews and caused false positives
 * (e.g. the Amazon homepage). A real cart always shows a subtotal/total and a
 * checkout button, so this stays high-recall while being high-precision and
 * fully site-agnostic.
 */
const CART_AFFORDANCE_KEYWORDS = [
  'proceed to checkout',
  'continue to checkout',
  'go to checkout',
  'secure checkout',
  'subtotal',
  'cart subtotal',
  'order summary',
  'order total',
  'estimated total',
  'review your order',
] as const

/**
 * Detects whether a cart/checkout is currently VISIBLE on the page — works
 * regardless of URL, so it catches cart drawers / SPA carts (Allbirds, most
 * Shopify themes, Amazon's slide-out) that never navigate to a /cart URL.
 *
 * Uses `innerText` (visible text only) so a hidden/closed drawer doesn't count
 * until the user opens it. Requires a checkout/subtotal affordance AND a price —
 * tight enough to ignore product-listing pages, which have prices + "add to
 * cart" but not "subtotal"/"proceed to checkout".
 */
export function isLikelyCart(doc: Document): boolean {
  // innerText = VISIBLE text only (a closed drawer contributes nothing); fall
  // back to textContent for environments (jsdom) that don't implement innerText.
  return textLooksLikeCart(doc.body?.innerText ?? doc.body?.textContent ?? '')
}

/** Pure cart heuristic over a block of visible text. Exposed for testing. */
export function textLooksLikeCart(visibleText: string): boolean {
  const t = visibleText.toLowerCase()
  if (!t) return false
  if (countDistinctKeywords(t, CART_AFFORDANCE_KEYWORDS) < 1) return false
  return countMatches(visibleText, new RegExp(PAGE_CLASSIFIER_VOCAB.PRICE_RE)) >= 1
}

// ─── DOM-only signal helpers ────────────────────────────────────────────────────

/** schema.org Product/Offer JSON-LD, or og:type=product. */
function hasProductSchema(doc: Document): boolean {
  // og:type meta
  const ogType = doc
    .querySelector('meta[property="og:type"]')
    ?.getAttribute('content')
    ?.toLowerCase()
  if (ogType === 'product' || ogType === 'product.item') return true

  // JSON-LD blocks
  const blocks = doc.querySelectorAll('script[type="application/ld+json"]')
  for (const block of Array.from(blocks)) {
    const raw = block.textContent
    if (!raw) continue
    // Cheap substring check first (avoids parsing huge/malformed blobs)
    const lower = raw.toLowerCase()
    if (
      lower.includes('"product"') ||
      lower.includes('"offer"') ||
      lower.includes('"aggregateoffer"')
    ) {
      return true
    }
  }
  return false
}

/** RTA self-label or <meta name="rating" content="adult|mature">. */
function hasAdultRating(doc: Document): boolean {
  const rating = doc.querySelector('meta[name="rating"]')?.getAttribute('content')?.toLowerCase()
  if (rating && (rating.includes('adult') || rating.includes('mature') || rating.includes('rta'))) {
    return true
  }
  // Some sites embed the RTA label elsewhere in the head
  return doc.documentElement.innerHTML.includes(PAGE_CLASSIFIER_VOCAB.RTA_LABEL)
}
