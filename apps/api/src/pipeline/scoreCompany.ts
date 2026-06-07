import type { ModelProvider, Store, ScoreCompanyFn, ContextSource, EthicsReport } from '@ethical-shopper/core'
import {
  parseScoringResponse,
  computeOverallScore,
  buildCompanyCacheKey,
  buildSuggestion,
  TAXONOMY,
} from '@ethical-shopper/core'

// Number of web search results to fetch for context enrichment.
const SEARCH_RESULTS_COUNT = 8

// ─── Prompt ──────────────────────────────────────────────────────────────────

function buildSystemPrompt(): string {
  const rubrics = TAXONOMY.map(
    (entry) => `## ${entry.label}  (id: "${entry.id}")\n${entry.rubric}`,
  ).join('\n\n')

  return `You are an expert ethical analyst evaluating companies for a consumer ethics app.
Score the given company against each category below using your knowledge and any search results provided.
Return ONLY valid JSON — no markdown fences, no explanation.

${rubrics}

─── OUTPUT FORMAT ───────────────────────────────────────────────────────────
{
  "categories": [
    {
      "id": "labor",
      "score": "Poor" | "Concerning" | "Mixed" | "Good" | "Excellent" | null,
      "blurb": "1–2 sentences, factual, with specific examples or sources.",
      "confidence": 0.0–1.0
    }
    // ... one object per category, all ${TAXONOMY.length.toString()} required
  ],
  "suggestedNewCategory": {      // OPTIONAL — omit if nothing notable
    "label": "Short label (≤4 words)",
    "rationale": "Why this ethical dimension matters specifically for this company.",
    "source": "model"
  }
}

─── SCORING RULES ───────────────────────────────────────────────────────────
• null = NEUTRAL — no notable record, positive or negative. Use this freely.
• Blurbs must be factual and specific. Avoid generic language like "has faced criticism."
• Confidence guide: 0.9+ well-documented (SEC filings, established news), 0.7 likely,
  0.5 limited evidence, 0.3 inference only.
• Only suggest a new category if it represents a significant, systemic ethical dimension
  NOT covered by the existing categories above.`
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Returns a ScoreCompanyFn that:
 *  1. Checks the Store cache — returns a fresh cached result immediately.
 *  2. If stale or missing: optionally fetches web search context, calls the LLM,
 *     validates + computes the overall score, logs any suggested category, and writes to cache.
 *
 * The optional contextSource (e.g. BraveSearchSource) enriches the prompt with
 * up-to-date web results. If it fails, scoring proceeds without enrichment.
 *
 * @example
 *   const scoreCompany = makeScoreCompanyFn(new BraveSearchSource())
 *   const report = await scoreCompany('Amazon', 'amazon.com', scoringProvider, store)
 */
export function makeScoreCompanyFn(contextSource?: ContextSource): ScoreCompanyFn {
  const systemPrompt = buildSystemPrompt()

  return async (
    companyName: string,
    domain: string | null,
    provider: ModelProvider,
    store: Store,
  ): Promise<EthicsReport> => {
    const cacheKey = buildCompanyCacheKey(companyName, domain)

    // ── 1. Serve from cache if fresh ──────────────────────────────────────────
    const isStale = await store.isStale(cacheKey)
    if (!isStale) {
      const cached = await store.getReport(cacheKey)
      if (cached) return cached
    }

    // ── 2. Gather context (best-effort; never blocks scoring) ─────────────────
    let contextBlock = ''
    if (contextSource) {
      try {
        const results = await contextSource.search(
          `${companyName} ethics labor environment political donations controversies`,
          SEARCH_RESULTS_COUNT,
        )
        if (results.length > 0) {
          contextBlock =
            '\n\n---\nRecent web search results for context:\n\n' +
            results
              .map((r, i) => `[${i + 1}] ${r.title}\n${r.url}\n${r.snippet}`)
              .join('\n\n')
        }
      } catch {
        // Context enrichment is best-effort — log but don't fail
        console.warn(`[scoreCompany] context search failed for ${companyName}; proceeding without.`)
      }
    }

    // ── 3. Call the scoring model ─────────────────────────────────────────────
    const userContent =
      `Company: ${companyName}${domain ? ` (website: ${domain})` : ''}` + contextBlock

    const response = await provider.complete(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { jsonMode: true, maxTokens: 2048, temperature: 0.1 },
    )

    // ── 4. Parse + validate ───────────────────────────────────────────────────
    const parsed = parseScoringResponse(JSON.parse(response.content) as unknown)

    // ── 5. Compute overall score deterministically ────────────────────────────
    const overallScore = computeOverallScore(parsed.categories)

    const report: EthicsReport = {
      company: { name: companyName, domain, aliases: [] },
      categories: parsed.categories,
      overallScore,
      ratingBand: overallScore,
      suggestedNewCategory: parsed.suggestedNewCategory,
      meta: {
        modelUsed: response.modelUsed,
        scoredAt: new Date().toISOString(),
        cacheKey,
      },
    }

    // ── 6. Log suggested new category (if any) ────────────────────────────────
    if (parsed.suggestedNewCategory) {
      await store
        .logSuggestion(
          buildSuggestion(
            parsed.suggestedNewCategory.label,
            parsed.suggestedNewCategory.rationale,
            'model',
            companyName,
          ),
        )
        .catch((err: unknown) => {
          console.warn('[scoreCompany] logSuggestion failed:', err)
        })
    }

    // ── 7. Cache the result ───────────────────────────────────────────────────
    await store.setReport(report)

    return report
  }
}
