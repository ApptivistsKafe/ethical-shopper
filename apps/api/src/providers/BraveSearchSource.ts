import type { ContextSource, SearchResult } from '@ethical-shopper/core'

interface BraveWebResult {
  title: string
  url: string
  description: string
}

interface BraveSearchResponse {
  web?: {
    results: BraveWebResult[]
  }
}

/**
 * ContextSource implementation backed by the Brave Search API.
 *
 * Used to enrich company scoring prompts with up-to-date web search results
 * before sending to the LLM. Best-effort: a Brave API failure degrades
 * gracefully — the scoring call proceeds without enrichment.
 */
export class BraveSearchSource implements ContextSource {
  private readonly apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env['BRAVE_API_KEY'] ?? ''

    if (!this.apiKey) {
      throw new Error('BraveSearchSource: no API key. Set BRAVE_API_KEY env var.')
    }
  }

  async search(query: string, maxResults = 5): Promise<SearchResult[]> {
    const params = new URLSearchParams({
      q: query,
      count: String(Math.min(maxResults, 20)), // Brave max = 20
    })

    const response = await fetch(
      `https://api.search.brave.com/res/v1/web/search?${params.toString()}`,
      {
        headers: {
          Accept: 'application/json',
          'Accept-Encoding': 'gzip',
          'X-Subscription-Token': this.apiKey,
        },
      },
    )

    if (!response.ok) {
      throw new Error(`Brave Search ${response.status}: ${await response.text()}`)
    }

    const data = (await response.json()) as BraveSearchResponse

    return (data.web?.results ?? []).map((r) => ({
      title: r.title,
      url: r.url,
      snippet: r.description,
    }))
  }
}
