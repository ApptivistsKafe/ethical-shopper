import type { Store } from '../interfaces.js'
import type { EthicsReport, CategorySuggestion } from '../types.js'

const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * In-memory Store for tests. Zero infrastructure required.
 * Supports staleness simulation via the optional reportAge override.
 */
export class InMemoryStore implements Store {
  private reports = new Map<string, EthicsReport>()
  private reportTimestamps = new Map<string, number>()
  private suggestions: CategorySuggestion[] = []

  /** Override the timestamp for a specific key to simulate staleness. */
  setReportAge(cacheKey: string, timestamp: number): void {
    this.reportTimestamps.set(cacheKey, timestamp)
  }

  async getReport(cacheKey: string): Promise<EthicsReport | null> {
    return this.reports.get(cacheKey) ?? null
  }

  async setReport(report: EthicsReport): Promise<void> {
    this.reports.set(report.meta.cacheKey, report)
    this.reportTimestamps.set(report.meta.cacheKey, Date.now())
  }

  async isStale(cacheKey: string, maxAgeMs = DEFAULT_MAX_AGE_MS): Promise<boolean> {
    const ts = this.reportTimestamps.get(cacheKey)
    if (ts === undefined) return true // not in cache = treat as stale
    return Date.now() - ts > maxAgeMs
  }

  async logSuggestion(suggestion: CategorySuggestion): Promise<void> {
    this.suggestions.push(suggestion)
  }

  async getSuggestions() {
    const modelRaw = this.suggestions.filter((s) => s.source === 'model')
    const userSuggestions = this.suggestions.filter((s) => s.source === 'user')

    // Deduplicate model suggestions by normalizedLabel
    const modelGrouped = new Map<string, CategorySuggestion[]>()
    for (const s of modelRaw) {
      const group = modelGrouped.get(s.normalizedLabel) ?? []
      group.push(s)
      modelGrouped.set(s.normalizedLabel, group)
    }

    const modelSuggestions = Array.from(modelGrouped.entries()).map(([normalizedLabel, examples]) => ({
      normalizedLabel,
      count: examples.length,
      examples,
    }))

    // User suggestions: all retained, NOT deduped
    return { modelSuggestions, userSuggestions }
  }

  /** Test helper: how many reports are cached. */
  get reportCount(): number {
    return this.reports.size
  }

  clear(): void {
    this.reports.clear()
    this.reportTimestamps.clear()
    this.suggestions = []
  }
}
