import type { ContextSource, SearchResult } from '../interfaces.js'

/**
 * Deterministic ContextSource for tests.
 * Returns pre-configured results; never makes a network call.
 */
export class FakeContextSource implements ContextSource {
  private results: SearchResult[] = []
  public queries: string[] = []

  setResults(results: SearchResult[]): this {
    this.results = results
    return this
  }

  async search(query: string, _maxResults?: number): Promise<SearchResult[]> {
    this.queries.push(query)
    return this.results
  }

  reset(): void {
    this.results = []
    this.queries = []
  }
}
