import type { CategorySuggestion, SuggestionSource } from './types.js'

/**
 * Normalizes a raw suggestion label for model-suggestion deduplication.
 * User suggestions are NOT run through this for dedup — their raw labels are preserved
 * and ALL instances retained (frequency = prioritization signal).
 */
export function normalizeSuggestionLabel(rawLabel: string): string {
  return rawLabel
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
}

/** Build a CategorySuggestion record ready to log. */
export function buildSuggestion(
  rawLabel: string,
  rationale: string,
  source: SuggestionSource,
  company?: string,
): CategorySuggestion {
  return {
    rawLabel,
    normalizedLabel: normalizeSuggestionLabel(rawLabel),
    rationale,
    source,
    company,
    timestamp: new Date().toISOString(),
  }
}
