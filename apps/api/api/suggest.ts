import type { VercelRequest, VercelResponse } from '@vercel/node'
import {
  SuggestRequestSchema,
  buildSuggestion,
  InMemoryStore,
  type Store,
} from '@ethical-shopper/core'
import { PostgresStore } from '../src/providers/PostgresStore.js'
import {
  handleCorsAndMethod,
  rejectUnauthorized,
  createRateLimiter,
  clientIp,
} from '../src/lib/http.js'

let storeSingleton: Store | null = null
function getStore(): Store {
  if (!storeSingleton) {
    storeSingleton = process.env['POSTGRES_URL'] ? new PostgresStore() : new InMemoryStore()
  }
  return storeSingleton
}

// Suggestions are cheap to handle but easy to spam — keep the limit tight.
const rateLimiter = createRateLimiter({ max: 5, windowMs: 60_000 })

/**
 * POST /api/suggest — log a user-suggested ethical concern category.
 *
 * User suggestions are intentionally NOT deduplicated: submission frequency is
 * the prioritization signal for taxonomy review.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (handleCorsAndMethod(req, res, 'POST')) return
  if (rejectUnauthorized(req, res)) return

  if (rateLimiter.isLimited(clientIp(req))) {
    res.status(429).json({ error: 'Too many requests' })
    return
  }

  const parsed = SuggestRequestSchema.safeParse(req.body)
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request', details: parsed.error.flatten().fieldErrors })
    return
  }

  try {
    await getStore().logSuggestion(
      buildSuggestion(parsed.data.label, parsed.data.rationale ?? '', 'user'),
    )
    res.status(200).json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.status(500).json({ error: message })
  }
}
