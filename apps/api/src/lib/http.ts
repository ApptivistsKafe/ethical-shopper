import type { VercelRequest, VercelResponse } from '@vercel/node'

// ─── CORS ─────────────────────────────────────────────────────────────────────

/**
 * Applies CORS headers and handles preflight/method gating.
 * Returns true if the request was fully handled (caller should stop).
 */
export function handleCorsAndMethod(
  req: VercelRequest,
  res: VercelResponse,
  allowedMethod: 'POST',
): boolean {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', `${allowedMethod}, OPTIONS`)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-ES-Token')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return true
  }
  if (req.method !== allowedMethod) {
    res.status(405).json({ error: 'Method not allowed' })
    return true
  }
  return false
}

// ─── Shared-token auth ────────────────────────────────────────────────────────

/**
 * Checks the shared extension token when EXTENSION_API_TOKEN is configured.
 * Returns true if the request was rejected (caller should stop).
 *
 * This is abuse mitigation, not real auth — the token ships inside the
 * extension bundle and is extractable by a determined attacker. It stops
 * drive-by use of the endpoint by anyone who finds the URL. Layer Vercel
 * WAF rate rules and OpenRouter spend caps on top.
 */
export function rejectUnauthorized(req: VercelRequest, res: VercelResponse): boolean {
  const expected = process.env['EXTENSION_API_TOKEN']
  if (!expected) return false // auth disabled (dev / not yet configured)

  const provided = req.headers['x-es-token']
  if (provided !== expected) {
    res.status(401).json({ error: 'Unauthorized' })
    return true
  }
  return false
}

// ─── Rate limiting ────────────────────────────────────────────────────────────

interface RateLimiterOptions {
  /** Max requests per IP per window. */
  max: number
  /** Window length in ms. */
  windowMs: number
  /** Injectable clock for tests. */
  now?: () => number
}

/**
 * Sliding-window rate limiter, in-memory per warm serverless instance.
 *
 * Best-effort by design: each instance tracks its own counters, so the true
 * global limit is max × instance-count. That still stops the practical abuse
 * case (a single client hammering the endpoint lands on a warm instance).
 * For a hard global limit, add a Vercel WAF rate rule in front.
 */
export function createRateLimiter(opts: RateLimiterOptions) {
  const { max, windowMs, now = Date.now } = opts
  const hits = new Map<string, number[]>()

  return {
    /** Returns true if this key is over the limit (and records the attempt otherwise). */
    isLimited(key: string): boolean {
      const cutoff = now() - windowMs
      const timestamps = (hits.get(key) ?? []).filter((t) => t > cutoff)

      if (timestamps.length >= max) {
        hits.set(key, timestamps)
        return true
      }

      timestamps.push(now())
      hits.set(key, timestamps)

      // Opportunistic cleanup so the map doesn't grow unboundedly
      if (hits.size > 10_000) {
        for (const [k, v] of hits) {
          if (v.every((t) => t <= cutoff)) hits.delete(k)
        }
      }
      return false
    },
  }
}

/** Client IP from Vercel's forwarding headers. */
export function clientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for']
  const first = Array.isArray(forwarded) ? forwarded[0] : forwarded
  return first?.split(',')[0]?.trim() ?? 'unknown'
}
