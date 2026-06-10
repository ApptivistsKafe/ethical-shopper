import postgres from 'postgres'
import { EthicsReportSchema } from '@ethical-shopper/core'
import type { Store, EthicsReport, CategorySuggestion } from '@ethical-shopper/core'

const DEFAULT_STALE_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

/**
 * Store implementation backed by PostgreSQL (Neon or any standard Postgres >=14).
 *
 * Designed for serverless environments:
 *  - max: 1 connection per process (lambda invocations are ephemeral)
 *  - ssl: 'require' for Neon/managed providers
 *
 * Schema: see apps/api/schema.sql
 */
export class PostgresStore implements Store {
  private readonly sql: ReturnType<typeof postgres>

  constructor(connectionString?: string) {
    const url = connectionString ?? process.env['POSTGRES_URL']
    if (!url) {
      throw new Error(
        'PostgresStore: no connection string. Set POSTGRES_URL env var or pass a connection string.',
      )
    }
    this.sql = postgres(url, {
      ssl: 'require',
      max: 1, // one connection per serverless invocation
      idle_timeout: 20,
      connect_timeout: 10,
    })
  }

  async getReport(cacheKey: string): Promise<EthicsReport | null> {
    const rows = await this.sql<Array<{ data: unknown }>>`
      SELECT data FROM ethics_reports WHERE cache_key = ${cacheKey} LIMIT 1
    `
    if (rows.length === 0) return null

    // Validate stored data against current schema; if it fails, treat as a cache miss.
    const result = EthicsReportSchema.safeParse(rows[0]!.data)
    if (!result.success) return null
    return result.data
  }

  async setReport(report: EthicsReport): Promise<void> {
    // Pass JSON as a string parameter; ::jsonb cast happens in SQL so no type gymnastics needed.
    const jsonData = JSON.stringify(report)
    await this.sql`
      INSERT INTO ethics_reports (cache_key, data, scored_at)
      VALUES (${report.meta.cacheKey}, ${jsonData}::jsonb, NOW())
      ON CONFLICT (cache_key)
      DO UPDATE SET data = EXCLUDED.data, scored_at = NOW()
    `
  }

  async isStale(cacheKey: string, maxAgeMs = DEFAULT_STALE_MS): Promise<boolean> {
    const rows = await this.sql<Array<{ scored_at: Date }>>`
      SELECT scored_at FROM ethics_reports WHERE cache_key = ${cacheKey} LIMIT 1
    `
    if (rows.length === 0) return true
    const age = Date.now() - rows[0]!.scored_at.getTime()
    return age > maxAgeMs
  }

  async logSuggestion(suggestion: CategorySuggestion): Promise<void> {
    await this.sql`
      INSERT INTO category_suggestions
        (normalized_label, raw_label, rationale, source, company, created_at)
      VALUES (
        ${suggestion.normalizedLabel},
        ${suggestion.rawLabel},
        ${suggestion.rationale},
        ${suggestion.source},
        ${suggestion.company ?? null},
        ${suggestion.timestamp}
      )
    `
  }

  async getSuggestions(): Promise<{
    modelSuggestions: Array<{
      normalizedLabel: string
      count: number
      examples: CategorySuggestion[]
    }>
    userSuggestions: CategorySuggestion[]
  }> {
    const [modelRows, userRows] = await Promise.all([
      // Model suggestions: group by normalizedLabel, include the first 5 as examples
      this.sql<Array<{ normalized_label: string; count: string; examples: CategorySuggestion[] }>>`
        SELECT
          normalized_label,
          COUNT(*)::text AS count,
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'rawLabel', raw_label,
              'normalizedLabel', normalized_label,
              'rationale', rationale,
              'source', source,
              'company', company,
              'timestamp', TO_CHAR(created_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
            )
            ORDER BY created_at DESC
          ) AS examples
        FROM category_suggestions
        WHERE source = 'model'
        GROUP BY normalized_label
        ORDER BY count DESC
      `,

      // User suggestions: all of them, chronological
      this.sql<
        Array<{
          raw_label: string
          normalized_label: string
          rationale: string
          company: string | null
          created_at: Date
        }>
      >`
        SELECT raw_label, normalized_label, rationale, company, created_at
        FROM category_suggestions
        WHERE source = 'user'
        ORDER BY created_at DESC
      `,
    ])

    return {
      modelSuggestions: modelRows.map((r) => ({
        normalizedLabel: r.normalized_label,
        count: parseInt(r.count, 10),
        examples: r.examples,
      })),
      userSuggestions: userRows.map((r) => ({
        rawLabel: r.raw_label,
        normalizedLabel: r.normalized_label,
        rationale: r.rationale,
        source: 'user' as const,
        company: r.company ?? undefined,
        timestamp: r.created_at.toISOString(),
      })),
    }
  }
}
