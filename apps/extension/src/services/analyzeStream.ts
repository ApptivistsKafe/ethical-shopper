import type {
  AnalyzeStreamEvent,
  AnalyzeRequest,
  CartItem,
  UserWeights,
  RecommendResponse,
} from '@ethical-shopper/core'

// Injected at build time by wxt.config.ts (and by vitest.config.ts in tests).
declare const __API_BASE_URL__: string
// Shared abuse-mitigation token; empty string disables the header.
declare const __API_TOKEN__: string

function authHeaders(): Record<string, string> {
  return __API_TOKEN__ ? { 'X-ES-Token': __API_TOKEN__ } : {}
}

/**
 * Calls POST /api/analyze and yields each NDJSON event as it arrives.
 *
 * The server streams newline-delimited JSON objects in the shape of
 * `AnalyzeStreamEvent`.  This generator handles chunked delivery correctly —
 * a single `TextDecoder` chunk may contain partial lines, multiple lines, or
 * complete events; we accumulate a buffer and only yield complete lines.
 *
 * Error handling:
 *  - Network failure → yields `{ type: 'error', message }` and returns
 *  - Non-200 response → yields `{ type: 'error', message }` and returns
 *  - Malformed JSON line → silently skipped (best-effort; server may emit errors)
 */
export async function* streamAnalysis(
  request: AnalyzeRequest,
): AsyncGenerator<AnalyzeStreamEvent, void, unknown> {
  let response: Response

  try {
    response = await fetch(`${__API_BASE_URL__}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify(request),
    })
  } catch (err) {
    yield {
      type: 'error',
      message: `Network error: ${err instanceof Error ? err.message : String(err)}`,
    }
    return
  }

  if (!response.ok || !response.body) {
    yield { type: 'error', message: `HTTP ${response.status}` }
    return
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      // Append decoded chunk to buffer; `stream: true` preserves multi-byte chars
      // that straddle chunk boundaries.
      buffer += decoder.decode(value, { stream: true })

      // Split on newlines; keep the last (potentially partial) segment in buffer.
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          yield JSON.parse(trimmed) as AnalyzeStreamEvent
        } catch {
          // Skip malformed lines — server may emit partial/diagnostic lines
        }
      }
    }

    // Flush any remaining bytes in the decoder
    buffer += decoder.decode()

    // Process any final complete line in the buffer
    const remaining = buffer.trim()
    if (remaining) {
      try {
        yield JSON.parse(remaining) as AnalyzeStreamEvent
      } catch {
        // ignore
      }
    }
  } finally {
    reader.releaseLock()
  }
}

/**
 * Fetches ethical alternatives for one cart item from POST /api/recommend.
 * Throws on network or HTTP errors — the caller renders the failure state.
 */
export async function fetchAlternatives(
  item: CartItem,
  userWeights?: UserWeights,
): Promise<RecommendResponse> {
  const response = await fetch(`${__API_BASE_URL__}/api/recommend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ item, userWeights }),
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status.toString()}`)
  }
  return (await response.json()) as RecommendResponse
}

/**
 * Submits a user-suggested ethical concern category to POST /api/suggest.
 * Returns true on success; false on any failure (best-effort, never throws).
 */
export async function submitSuggestion(label: string, rationale?: string): Promise<boolean> {
  try {
    const response = await fetch(`${__API_BASE_URL__}/api/suggest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders() },
      body: JSON.stringify({ label, rationale }),
    })
    return response.ok
  } catch {
    return false
  }
}
