import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  type AnalyzeStreamEvent,
  type Store,
  AnalyzeRequestSchema,
  buildCompanyView,
  classifyText,
  InMemoryStore,
} from '@ethical-shopper/core'
import { OpenRouterProvider } from '../src/providers/OpenRouterProvider.js'
import { BraveSearchSource } from '../src/providers/BraveSearchSource.js'
import { PostgresStore } from '../src/providers/PostgresStore.js'
import { extractCart } from '../src/pipeline/extractCart.js'
import { makeScoreCompanyFn } from '../src/pipeline/scoreCompany.js'
import { companiesToScore } from '../src/pipeline/companiesToScore.js'
import {
  handleCorsAndMethod,
  rejectUnauthorized,
  createRateLimiter,
  clientIp,
} from '../src/lib/http.js'

// ─── Config ───────────────────────────────────────────────────────────────────

const EXTRACTION_MODEL = process.env['EXTRACTION_MODEL'] ?? 'google/gemini-2.5-flash-lite'
const SCORING_MODEL = process.env['SCORING_MODEL'] ?? 'anthropic/claude-sonnet-4-5'

/**
 * Vercel function config:
 *  - maxDuration: scoring several companies takes real time
 *  - supportsResponseStreaming: REQUIRED for res.write chunks to reach the
 *    client incrementally — without it the Node runtime buffers the whole
 *    response and "streaming" arrives as one blob at the end.
 */
export const config = { maxDuration: 60, supportsResponseStreaming: true }

// ─── Module-scoped singletons (reused across warm invocations) ────────────────

let storeSingleton: Store | null = null
function getStore(): Store {
  if (!storeSingleton) {
    if (process.env['POSTGRES_URL']) {
      storeSingleton = new PostgresStore()
    } else {
      console.warn('[analyze] POSTGRES_URL not set — using in-memory store (no persistence).')
      storeSingleton = new InMemoryStore()
    }
  }
  return storeSingleton
}

let contextSourceSingleton: BraveSearchSource | undefined | null = null
function getContextSource(): BraveSearchSource | undefined {
  if (contextSourceSingleton === null) {
    if (process.env['BRAVE_API_KEY']) {
      contextSourceSingleton = new BraveSearchSource()
    } else {
      console.warn('[analyze] BRAVE_API_KEY not set — scoring without web context enrichment.')
      contextSourceSingleton = undefined
    }
  }
  return contextSourceSingleton
}

// Single-flight map lives inside the factory — keep ONE factory per instance
// so concurrent requests for the same company share a scoring run.
const scoreCompanyPromise: { fn: ReturnType<typeof makeScoreCompanyFn> | null } = { fn: null }
function getScoreCompany(): ReturnType<typeof makeScoreCompanyFn> {
  scoreCompanyPromise.fn ??= makeScoreCompanyFn(getContextSource())
  return scoreCompanyPromise.fn
}

// Per-IP rate limit (best-effort, per warm instance — see createRateLimiter docs).
const rateLimiter = createRateLimiter({ max: 10, windowMs: 60_000 })

// ─── Helpers ─────────────────────────────────────────────────────────────────

function writeEvent(res: VercelResponse, event: AnalyzeStreamEvent): void {
  res.write(JSON.stringify(event) + '\n')
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCorsAndMethod(req, res, 'POST')) return
  if (rejectUnauthorized(req, res)) return

  if (rateLimiter.isLimited(clientIp(req))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  // ── Validate request body BEFORE committing to a streaming response ────────
  const parsed = AnalyzeRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors })
    return
  }
  const { markdown, url: pageUrl, userWeights = {} } = parsed.data

  // ── Content-safety gate (server backstop) ─────────────────────────────────
  // The extension runs this gate client-side from the live DOM before sending,
  // but an attacker hitting this endpoint directly controls the payload — so we
  // re-check here on the exact content we're about to forward to the LLM, using
  // only signals we can independently trust from the text + URL. Reject non-
  // commerce or adult content BEFORE any model call (no spend, no exposure).
  const classification = classifyText(markdown, pageUrl)
  if (classification.decision === 'reject') {
    res.status(422).json({
      error: 'Unsupported page — this does not look like a product checkout page.',
      reasons: classification.reasons,
    })
    return
  }

  // ── Build providers ─────────────────────────────────────────────────────────
  let extractionProvider: OpenRouterProvider
  let scoringProvider: OpenRouterProvider

  try {
    // Extraction is fast — short timeout. Scoring generates ~2k tokens through
    // a large model — it legitimately needs longer.
    extractionProvider = new OpenRouterProvider({ model: EXTRACTION_MODEL, timeoutMs: 12_000 })
    scoringProvider = new OpenRouterProvider({ model: SCORING_MODEL, timeoutMs: 30_000 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Provider init failed: ${message}` })
    return
  }

  // ── Streaming response ──────────────────────────────────────────────────────
  res.setHeader('Content-Type', 'application/x-ndjson')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('X-Accel-Buffering', 'no')
  res.status(200)

  const store = getStore()
  const scoreCompany = getScoreCompany()

  try {
    // ── Step 1: Extract cart (fast, cheap model) ──────────────────────────────
    const cart = await extractCart(markdown, extractionProvider)
    writeEvent(res, { type: 'cart', cart })

    // Empty cart is a graceful outcome — nothing to score.
    if (cart.items.length === 0) {
      writeEvent(res, { type: 'done' })
      res.end()
      return
    }

    // ── Step 2: Score unique sellers AND brands in parallel ───────────────────
    // Each company streams its companyView event as soon as it resolves.
    // Promise.allSettled ensures one failure doesn't cancel the others.
    const companies = companiesToScore(cart, pageUrl)

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
