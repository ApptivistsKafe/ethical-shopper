/**
 * Checkout page detector — pure synchronous function.
 * Removed the chrome.storage caching layer from the original: in the WXT
 * content script the function is called once per page load, so caching adds
 * complexity with no real benefit.
 */

interface SiteRule {
  domain: string
  patterns: RegExp[]
}

const SITE_RULES: SiteRule[] = [
  {
    domain: 'amazon.com',
    patterns: [
      /amazon\.com\/gp\/buy\/spc\/handlers\/display\.html/,
      /amazon\.com\/gp\/cart\/view\.html/,
    ],
  },
  { domain: 'ebay.com', patterns: [/ebay\.com\/myb\/PurchaseHistory/, /ebay\.com\/csc\/home/] },
  { domain: 'etsy.com', patterns: [/etsy\.com\/cart/, /etsy\.com\/your\/purchases/] },
  { domain: 'walmart.com', patterns: [/walmart\.com\/checkout/] },
  { domain: 'target.com', patterns: [/target\.com\/co-cart/, /target\.com\/co-review/] },
  { domain: 'bestbuy.com', patterns: [/bestbuy\.com\/checkout/, /bestbuy\.com\/cart/] },
  { domain: 'wayfair.com', patterns: [/wayfair\.com\/checkout/, /wayfair\.com\/cart/] },
  { domain: 'homedepot.com', patterns: [/homedepot\.com\/checkout/, /homedepot\.com\/mycart/] },
  { domain: 'nike.com', patterns: [/nike\.com\/checkout/, /nike\.com\/cart/] },
  { domain: 'apple.com', patterns: [/apple\.com\/shop\/checkout/, /apple\.com\/shop\/bag/] },
  { domain: 'gap.com', patterns: [/gap\.com\/checkout/, /gap\.com\/shopping-bag/] },
  {
    domain: 'nordstrom.com',
    patterns: [/nordstrom\.com\/checkout/, /nordstrom\.com\/shopping-bag/],
  },
  { domain: 'costco.com', patterns: [/costco\.com\/CheckoutCartDisplayView/, /costco\.com\/cart/] },
]

// URL path/query keywords that reliably indicate a cart or checkout page.
const URL_KEYWORDS = /\b(checkout|cart|shopping[-_]bag|order[-_]review)\b/i

/**
 * Returns true if the given URL + document appear to be a checkout or cart page.
 *
 * Detection order (stops as soon as one matches):
 *  1. Domain-specific URL pattern (highest confidence)
 *  2. URL keyword heuristic (high confidence)
 *
 * Returns false on any error (defensive — never crashes the content script).
 */
export function isCheckoutPage(url: string, _doc: Document): boolean {
  try {
    const urlLower = url.toLowerCase()

    // 1. Site-specific pattern matching
    for (const rule of SITE_RULES) {
      if (urlLower.includes(rule.domain)) {
        for (const pattern of rule.patterns) {
          if (pattern.test(url)) return true
        }
      }
    }

    // 2. Generic URL keyword heuristic
    if (URL_KEYWORDS.test(url)) return true

    return false
  } catch {
    return false
  }
}
