import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type AnalyzeRequest,
  type AnalyzeStreamEvent,
  type Cart,
  type CartItem,
  type Store,
  buildCompanyView,
  InMemoryStore,
} from '@ethical-shopper/core'
import { OpenRouterProvider } from '../src/providers/OpenRouterProvider.js'
import { BraveSearchSource } from '../src/providers/BraveSearchSource.js'
import { PostgresStore } from '../src/providers/PostgresStore.js'
import { extractCart } from '../src/pipeline/extractCart.js'
import { makeScoreCompanyFn } from '../src/pipeline/scoreCompany.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const EXTRACTION_MODEL =
  process.env['EXTRACTION_MODEL'] ?? 'google/gemini-2.5-flash-lite'
const SCORING_MODEL =
  process.env['SCORING_MODEL'] ?? 'anthropic/claude-sonnet-4-5'

/** Vercel: allow up to 60 seconds for streaming responses */
export const config = { maxDuration: 60 }

// ─── Helpers ─────────────────────────────────────────────────────────────────

function writeEvent(res: VercelResponse, event: AnalyzeStreamEvent): void {
  res.write(JSON.stringify(event) + '\n')
}

/**
 * Extract the effective domain for a cart item.
 * Tries the item URL, then falls back to the page URL.
 */
function extractDomain(item: CartItem, pageUrl: string): string | null {
  const candidate = item.url ?? pageUrl
  try {
    return new URL(candidate).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

/**
 * Deduplicate cart items by sellingCompany (case-insensitive).
 * Returns one representative item per unique company.
 */
function uniqueCompanies(cart: Cart, pageUrl: string): Array<{ name: string; domain: string | null }> {
  const seen = new Map<string, { name: string; domain: string | null }>()
  for (const item of cart.items) {
    const key = item.sellingCompany.toLowerCase()
    if (!seen.has(key)) {
      seen.set(key, {
        name: item.sellingCompany,
        domain: extractDomain(item, pageUrl),
      })
    }
  }
  return [...seen.values()]
}

/** Build the store — Postgres in production, InMemory in dev (POSTGRES_URL unset). */
function buildStore(): Store {
  if (process.env['POSTGRES_URL']) {
    return new PostgresStore()
  }
  console.warn('[analyze] POSTGRES_URL not set — using in-memory store (no persistence).')
  return new InMemoryStore()
}

/** Build BraveSearchSource if key is available; otherwise disable context enrichment. */
function buildContextSource(): BraveSearchSource | undefined {
  if (process.env['BRAVE_API_KEY']) {
    return new BraveSearchSource()
  }
  console.warn('[analyze] BRAVE_API_KEY not set — scoring without web context enrichment.')
  return undefined
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  // ── CORS preflight ──────────────────────────────────────────────────────────
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  // ── Streaming headers ───────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering if behind a proxy
  res.status(200)

  const body = req.body as Partial<AnalyzeRequest>

  if (!body?.markdown || !body?.url) {
    writeEvent(res, { type: 'error', message: 'Request body must include "markdown" and "url".' })
    res.end()
    return
  }

  const { markdown, url: pageUrl, userWeights = {} } = body as AnalyzeRequest

  // ── Build providers ─────────────────────────────────────────────────────────
  let extractionProvider: OpenRouterProvider
  let scoringProvider: OpenRouterProvider

  try {
    extractionProvider = new OpenRouterProvider({ model: EXTRACTION_MODEL })
    scoringProvider = new OpenRouterProvider({ model: SCORING_MODEL })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeEvent(res, { type: 'error', message: `Provider init failed: ${message}` })
    res.end()
    return
  }

  const store = buildStore()
  const contextSource = buildContextSource()
  const scoreCompany = makeScoreCompanyFn(contextSource)

  try {
    // ── Step 1: Extract cart (fast, cheap model) ──────────────────────────────
    const cart = await extractCart(markdown, extractionProvider)
    writeEvent(res, { type: 'cart', cart })

    // ── Step 2: Score all unique companies in parallel ─────────────────────────
    // Each company streams its companyView event as soon as it resolves.
    // Promise.allSettled ensures one failure doesn't cancel the others.
    const companies = uniqueCompanies(cart, pageUrl)

    await Promise.allSettled(
      companies.map(async ({ name, domain }) => {
        try {
          const report = await scoreCompany(name, domain, scoringProvider, store)
          const view = buildCompanyView(report, userWeights)
          writeEvent(res, { type: 'companyView', view })
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err)
          writeEvent(res, {
            type: 'error',
            message: `Failed to score "${name}": ${message}`,
          })
        }
      }),
    )

    writeEvent(res, { type: 'done' })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    writeEvent(res, { type: 'error', message })
  }

  res.end()
}
