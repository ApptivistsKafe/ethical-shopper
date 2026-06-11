import type { VercelRequest, VercelResponse } from '@vercel/node'
import { RecommendRequestSchema, InMemoryStore, type Store } from '@ethical-shopper/core'
import { OpenRouterProvider } from '../src/providers/OpenRouterProvider.js'
import { BraveSearchSource } from '../src/providers/BraveSearchSource.js'
import { PostgresStore } from '../src/providers/PostgresStore.js'
import { makeScoreCompanyFn } from '../src/pipeline/scoreCompany.js'
import { makeRecommendFn } from '../src/pipeline/recommendAlternatives.js'
import {
  handleCorsAndMethod,
  rejectUnauthorized,
  createRateLimiter,
  clientIp,
} from '../src/lib/http.js'

const SCORING_MODEL = process.env['SCORING_MODEL'] ?? 'anthropic/claude-sonnet-4-5'

export const config = { maxDuration: 60 }

// ─── Module-scoped singletons (reused across warm invocations) ────────────────

let storeSingleton: Store | null = null
function getStore(): Store {
  if (!storeSingleton) {
    storeSingleton = process.env['POSTGRES_URL'] ? new PostgresStore() : new InMemoryStore()
  }
  return storeSingleton
}

let contextSourceSingleton: BraveSearchSource | undefined | null = null
function getContextSource(): BraveSearchSource | undefined {
  if (contextSourceSingleton === null) {
    contextSourceSingleton = process.env['BRAVE_API_KEY'] ? new BraveSearchSource() : undefined
  }
  return contextSourceSingleton
}

let recommendSingleton: ReturnType<typeof makeRecommendFn> | null = null
function getRecommend(): ReturnType<typeof makeRecommendFn> {
  recommendSingleton ??= makeRecommendFn({
    contextSource: getContextSource(),
    scoreCompany: makeScoreCompanyFn(getContextSource()),
  })
  return recommendSingleton
}

// Recommendations are the most expensive call (model + up to 3 scoring calls) —
// keep the per-IP limit tight.
const rateLimiter = createRateLimiter({ max: 6, windowMs: 60_000 })

/**
 * POST /api/recommend — ethical alternatives for one cart item (Spec 2).
 *
 * Body: { item: CartItem, userWeights? }
 * Response: { alternatives: AlternativeWithView[] } — plain JSON (≤3 results,
 * usually cache-hit scoring; no need for the streaming treatment /analyze gets).
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCorsAndMethod(req, res, 'POST')) return
  if (rejectUnauthorized(req, res)) return

  if (rateLimiter.isLimited(clientIp(req))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const parsed = RecommendRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors })
    return
  }

  let provider: OpenRouterProvider
  try {
    provider = new OpenRouterProvider({ model: SCORING_MODEL, timeoutMs: 30_000 })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: `Provider init failed: ${message}` })
    return
  }

  try {
    const recommend = getRecommend()
    const result = await recommend(
      parsed.data.item,
      provider,
      getStore(),
      parsed.data.userWeights ?? {},
    )
    res.status(200).json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
