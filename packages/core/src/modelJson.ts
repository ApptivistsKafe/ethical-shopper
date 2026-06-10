/**
 * Robust JSON extraction from LLM output.
 *
 * Models don't reliably honor "return ONLY JSON" — Claude in particular often
 * wraps output in ```json fences or adds a leading sentence, and OpenRouter's
 * response_format passthrough is inconsistent across providers. Parsing raw
 * model output with bare JSON.parse is therefore fragile.
 *
 * Strategy (first success wins):
 *   1. JSON.parse the trimmed string as-is.
 *   2. If a ```json (or ```) fenced block exists, parse its contents.
 *   3. Scan for the first balanced top-level {...} object (string/escape aware)
 *      and parse that.
 */

const FENCED_BLOCK = /```(?:json)?\s*\n?([\s\S]*?)```/

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim()

  // 1. Plain parse
  try {
    return JSON.parse(trimmed)
  } catch {
    // fall through
  }

  // 2. Fenced code block
  const fenced = FENCED_BLOCK.exec(trimmed)
  if (fenced?.[1]) {
    try {
      return JSON.parse(fenced[1].trim())
    } catch {
      // fall through
    }
  }

  // 3. First balanced top-level object
  const balanced = firstBalancedObject(trimmed)
  if (balanced !== null) {
    return JSON.parse(balanced) // let a SyntaxError here propagate — nothing left to try
  }

  throw new SyntaxError(
    `No JSON object found in model output (first 120 chars): ${trimmed.slice(0, 120)}`,
  )
}

/** Returns the first balanced `{...}` substring, respecting JSON strings and escapes. */
function firstBalancedObject(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escaped) {
      escaped = false
      continue
    }
    if (ch === '\\') {
      escaped = true
      continue
    }
    if (ch === '"') {
      inString = !inString
      continue
    }
    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
}
