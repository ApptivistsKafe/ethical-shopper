import type { EthicsReport, Cart, CategorySuggestion } from './types.js'

// ─── ModelProvider ────────────────────────────────────────────────────────────

export interface ModelMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ModelOptions {
  temperature?: number
  maxTokens?: number
  /** If true, the response is expected to be valid JSON. */
  jsonMode?: boolean
}

export interface ModelResponse {
  content: string
  modelUsed: string
  promptTokens: number
  completionTokens: number
}

/**
 * Abstraction over any LLM provider (OpenRouter, Gemini, OpenAI, etc.).
 * Inject a FakeModelProvider in tests to get deterministic, zero-cost behavior.
 */
export interface ModelProvider {
  complete(messages: ModelMessage[], options?: ModelOptions): Promise<ModelResponse>
}

// ─── Store ────────────────────────────────────────────────────────────────────

/**
 * Persistence abstraction for cached ethics reports, suggestions, and (later) analytics.
 * Inject an InMemoryStore in tests for zero-infra, fully deterministic behavior.
 */
export interface Store {
  /** Retrieve a cached EthicsReport by cache key. null = cache miss. */
  getReport(cacheKey: string): Promise<EthicsReport | null>

  /** Persist an EthicsReport. Overwrites any existing entry for the same key. */
  setReport(report: EthicsReport): Promise<void>

  /**
   * Check whether a cached report is stale.
   * Default policy: stale if older than maxAgeMs (default 7 days).
   */
  isStale(cacheKey: string, maxAgeMs?: number): Promise<boolean>

  /** Log a suggested new ethical concern category (model or user source). */
  logSuggestion(suggestion: CategorySuggestion): Promise<void>

  /**
   * Retrieve deduplicated model suggestions (by normalizedLabel) with frequency counts,
   * plus all raw user suggestions (NOT deduped — frequency is the signal).
   */
  getSuggestions(): Promise<{
    modelSuggestions: Array<{ normalizedLabel: string; count: number; examples: CategorySuggestion[] }>
    userSuggestions: CategorySuggestion[]
  }>
}

// ─── ContextSource ────────────────────────────────────────────────────────────

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

/**
 * Pluggable context source for enriching recommendations with up-to-date information.
 * WebSearchSource (on by default), RedditSource (deferred, off by default).
 */
export interface ContextSource {
  search(query: string, maxResults?: number): Promise<SearchResult[]>
}

// ─── Pipeline function signatures ─────────────────────────────────────────────
// These are the shapes the api/ layer calls. Implementations live in api/.

export interface ExtractCartFn {
  (markdown: string, provider: ModelProvider): Promise<Cart>
}

export interface ScoreCompanyFn {
  (
    companyName: string,
    domain: string | null,
    provider: ModelProvider,
    store: Store,
  ): Promise<EthicsReport>
}
