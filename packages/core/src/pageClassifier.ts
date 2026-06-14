/**
 * Page classification — the content-safety gate.
 *
 * Two questions, both answered by cheap, deterministic heuristics that are
 * SHARED between the extension (client) and the API (server):
 *   1. POSITIVE: does this look like a branded-product checkout / cart page?
 *   2. NEGATIVE: does this look like adult / explicit content?
 *
 * A page is ALLOWED only if it PASSES the positive gate AND does NOT trip the
 * negative gate. Anything else is rejected before its content is ever forwarded
 * to an LLM. The positive gate is the primary filter — explicit pages (OnlyFans,
 * tube sites) aren't product checkouts, so they fail it regardless; the negative
 * gate is a high-precision backstop.
 *
 * Tuned to minimize BOTH error modes:
 *   - false positives → wasted LLM spend + sending junk/explicit content upstream
 *   - false negatives → real shoppers blocked
 *
 * This module is environment-agnostic (no DOM types). The client extracts richer
 * signals from the live DOM (`extractDomSignals` lives in the extension); the
 * server extracts what it can independently TRUST from the submitted text
 * (`extractTextSignals`, below) — it never trusts client-asserted metadata,
 * since an API-direct attacker controls the whole payload.
 */

export interface PageSignals {
  url: string
  // ── commerce-positive ──
  /** JSON-LD Product/Offer or og:type=product present. DOM-only; false from text. */
  hasProductSchema: boolean
  /** Count of price-like patterns (currency + number). */
  priceMatchCount: number
  /** Number of DISTINCT commerce keywords seen (cart, checkout, subtotal, …). */
  commerceKeywordCount: number
  // ── adult-negative ──
  /** RTA self-label or <meta name="rating" content="adult|mature">. DOM-only; false from text. */
  hasAdultRating: boolean
  /** URL host matches a known adult domain. */
  isKnownAdultDomain: boolean
  /** Number of DISTINCT unambiguous adult-industry terms seen. */
  adultKeywordCount: number
}

export type PageDecision = 'allow' | 'reject'

export interface PageClassification {
  decision: PageDecision
  isCommerce: boolean
  isAdult: boolean
  /** Human-readable signals behind the decision (for logs + tests). */
  reasons: string[]
}

// ─── Tunables ──────────────────────────────────────────────────────────────────

/** Min distinct commerce keywords (with a price present) to count as commerce. */
export const MIN_COMMERCE_KEYWORDS = 2
/** Min distinct adult keywords to count as adult on text signal alone. */
export const MIN_ADULT_KEYWORDS = 2

// Commerce vocabulary — checkout/cart pages reliably contain several of these.
const COMMERCE_KEYWORDS = [
  'add to cart',
  'add to bag',
  'add to basket',
  'proceed to checkout',
  'checkout',
  'check out',
  'subtotal',
  'order total',
  'order summary',
  'shopping cart',
  'shopping bag',
  'your cart',
  'your bag',
  'your basket',
  'quantity',
  'shipping',
  'estimated total',
  'save for later',
  'place order',
  'in your cart',
  'cart subtotal',
  'continue to checkout',
]

// Price-like patterns: leading currency symbol, or trailing currency code.
const PRICE_RE =
  /(?:[$£€¥₹]\s?\d[\d,]*(?:\.\d{2})?)|(?:\b\d[\d,]*\.\d{2}\s?(?:usd|eur|gbp|cad|aud)\b)/gi

// The RTA ("Restricted To Adults") self-label that adult sites voluntarily embed.
export const RTA_LABEL = 'RTA-5042-1996-1400-1577-RTA'

// Known adult domains. Not exhaustive by design — the positive gate is the real
// filter; this catches the obvious cases fast and is cheap to extend.
const KNOWN_ADULT_DOMAINS = [
  'onlyfans.com',
  'fansly.com',
  'pornhub.com',
  'xvideos.com',
  'xnxx.com',
  'redtube.com',
  'youporn.com',
  'xhamster.com',
  'chaturbate.com',
  'stripchat.com',
  'manyvids.com',
  'adultfriendfinder.com',
  'livejasmin.com',
  'cam4.com',
  'myfreecams.com',
]

// A short, deliberately conservative set of unambiguous adult-industry terms.
// Kept small and threshold-gated (MIN_ADULT_KEYWORDS) so a single incidental
// mention on a legitimate page does not trip the gate. The domain list + RTA
// label are the higher-precision signals; this is a secondary net.
const ADULT_KEYWORDS = [
  'pornography',
  'xxx video',
  'webcam model',
  'camgirl',
  'escort service',
  'adult video',
  'explicit content',
  'nsfw content',
]

// ─── Decision ───────────────────────────────────────────────────────────────────

/**
 * Pure decision over normalized signals. Same logic on client and server.
 */
export function classifyPage(signals: PageSignals): PageClassification {
  const reasons: string[] = []

  // Negative gate
  let isAdult = false
  if (signals.isKnownAdultDomain) {
    isAdult = true
    reasons.push('known-adult-domain')
  }
  if (signals.hasAdultRating) {
    isAdult = true
    reasons.push('adult-rating-label')
  }
  if (signals.adultKeywordCount >= MIN_ADULT_KEYWORDS) {
    isAdult = true
    reasons.push(`adult-keywords:${signals.adultKeywordCount.toString()}`)
  }

  // Positive gate
  let isCommerce = false
  if (signals.hasProductSchema) {
    isCommerce = true
    reasons.push('product-schema')
  } else if (
    signals.priceMatchCount >= 1 &&
    signals.commerceKeywordCount >= MIN_COMMERCE_KEYWORDS
  ) {
    isCommerce = true
    reasons.push(
      `commerce-signals(price:${signals.priceMatchCount.toString()},kw:${signals.commerceKeywordCount.toString()})`,
    )
  } else {
    reasons.push(
      `insufficient-commerce(price:${signals.priceMatchCount.toString()},kw:${signals.commerceKeywordCount.toString()})`,
    )
  }

  // Allowed only if commerce AND not adult.
  const decision: PageDecision = isCommerce && !isAdult ? 'allow' : 'reject'
  return { decision, isCommerce, isAdult, reasons }
}

// ─── Server-trustable signal extraction (text + url only) ───────────────────────

/**
 * Extracts signals from submitted markdown + URL — the only inputs the server
 * can independently trust. Cannot see live DOM metadata (JSON-LD, meta tags),
 * so hasProductSchema/hasAdultRating are derived only from any residual text.
 */
export function extractTextSignals(markdown: string, url: string): PageSignals {
  const lower = markdown.toLowerCase()

  return {
    url,
    hasProductSchema:
      lower.includes('"@type":"product"') ||
      lower.includes('"@type": "product"') ||
      lower.includes('"@type":"offer"'),
    priceMatchCount: countMatches(markdown, PRICE_RE),
    commerceKeywordCount: countDistinctKeywords(lower, COMMERCE_KEYWORDS),
    hasAdultRating: markdown.includes(RTA_LABEL),
    isKnownAdultDomain: isAdultHost(url),
    adultKeywordCount: countDistinctKeywords(lower, ADULT_KEYWORDS),
  }
}

/** Convenience: extract text signals then classify. Used by the API backstop. */
export function classifyText(markdown: string, url: string): PageClassification {
  return classifyPage(extractTextSignals(markdown, url))
}

// ─── Shared helpers (also used by the extension's DOM extractor) ────────────────

export function isAdultHost(url: string): boolean {
  let host: string
  try {
    host = new URL(url).hostname.toLowerCase().replace(/^www\./, '')
  } catch {
    return false
  }
  return KNOWN_ADULT_DOMAINS.some((d) => host === d || host.endsWith('.' + d))
}

export function countDistinctKeywords(haystackLower: string, keywords: readonly string[]): number {
  let n = 0
  for (const kw of keywords) {
    if (haystackLower.includes(kw)) n++
  }
  return n
}

export function countMatches(text: string, re: RegExp): number {
  const matches = text.match(re)
  return matches ? matches.length : 0
}

/** Exposed so the extension's DOM extractor reuses the exact same vocabularies. */
export const PAGE_CLASSIFIER_VOCAB = {
  COMMERCE_KEYWORDS,
  ADULT_KEYWORDS,
  PRICE_RE,
  RTA_LABEL,
} as const
