import type { Cart, CartItem } from '@ethical-shopper/core'

export interface CompanyToScore {
  name: string
  domain: string | null
  /** Whether this company appears as a marketplace/retailer or as a product brand. */
  role: 'seller' | 'brand'
}

/**
 * Upper bound on companies scored per request — caps worst-case LLM spend for
 * a single pathological cart (e.g. 50 items from 50 different brands).
 */
export const MAX_COMPANIES_PER_REQUEST = 8

/**
 * Determines which companies to score for a cart: unique SELLERS and unique
 * BRANDS.
 *
 * Brands matter as much as sellers — on a marketplace like Amazon every item's
 * sellingCompany is "Amazon", and the user learns nothing unless the brands
 * they're actually buying (Sony, Nike, …) are scored too.
 *
 * Rules:
 *  - Dedup case-insensitively by company name.
 *  - A brand identical to a seller is not scored twice.
 *  - Sellers come first (they're scored with a domain → better cache keys),
 *    then brands, until MAX_COMPANIES_PER_REQUEST is reached.
 */
export function companiesToScore(cart: Cart, pageUrl: string): CompanyToScore[] {
  const seen = new Set<string>()
  const result: CompanyToScore[] = []

  const add = (name: string, domain: string | null, role: CompanyToScore['role']) => {
    const key = name.trim().toLowerCase()
    if (!key || seen.has(key)) return
    if (result.length >= MAX_COMPANIES_PER_REQUEST) return
    seen.add(key)
    result.push({ name: name.trim(), domain, role })
  }

  for (const item of cart.items) {
    add(item.sellingCompany, extractDomain(item, pageUrl), 'seller')
  }
  for (const item of cart.items) {
    if (item.brand) add(item.brand, null, 'brand')
  }

  return result
}

/**
 * Extracts the effective domain for a seller from the item URL, falling back
 * to the page URL. Brands get no domain (scored by name; cache key is the slug).
 */
function extractDomain(item: CartItem, pageUrl: string): string | null {
  const candidate = item.url ?? pageUrl
  try {
    return new URL(candidate).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}
