/**
 * Tier-2 evaluation harness — real-LLM directional checks.
 *
 * Tier 1 (vitest, FakeModelProvider) proves the plumbing; this harness proves
 * the actual model + rubric produce sane scores. It runs MANUALLY or on a
 * schedule — never in per-commit CI — because it costs real money.
 *
 *   OPENROUTER_API_KEY=sk-... pnpm eval
 *
 * Budget controls:
 *   EVAL_MAX_COMPANIES  cap on companies scored per run (default: all fixtures)
 *   SCORING_MODEL       override the model under test
 *   BRAVE_API_KEY       optional — enables web-context enrichment like production
 *
 * Assertions are DIRECTIONAL BANDS, not exact scores: model output legitimately
 * varies run to run; what must hold is that companies with well-documented
 * records land on the right side of the scale. A band miss exits non-zero.
 *
 * TODO(Tier-2): add LLM-as-judge checks on blurb quality (factuality, specificity).
 */
import { EthicalStatus } from '@ethical-shopper/core'
import { InMemoryStore } from '@ethical-shopper/core'
import { OpenRouterProvider } from '../src/providers/OpenRouterProvider.js'
import { BraveSearchSource } from '../src/providers/BraveSearchSource.js'
import { makeScoreCompanyFn } from '../src/pipeline/scoreCompany.js'

interface EvalFixture {
  name: string
  domain: string
  /** The overall score must land in one of these bands. Generous by design. */
  acceptableBands: EthicalStatus[]
  why: string
}

// Companies with broadly documented, directionally unambiguous records.
const FIXTURES: EvalFixture[] = [
  {
    name: 'Patagonia',
    domain: 'patagonia.com',
    acceptableBands: [EthicalStatus.Good, EthicalStatus.Excellent],
    why: 'B-Corp, 1% for the Planet, ownership transferred to climate trust',
  },
  {
    name: 'Nestlé',
    domain: 'nestle.com',
    acceptableBands: [EthicalStatus.Poor, EthicalStatus.Concerning, EthicalStatus.Mixed],
    why: 'decades of documented water, labor, and marketing controversies',
  },
  {
    name: 'Amazon',
    domain: 'amazon.com',
    acceptableBands: [EthicalStatus.Poor, EthicalStatus.Concerning, EthicalStatus.Mixed],
    why: 'documented union suppression, warehouse safety record',
  },
  {
    name: 'Ben & Jerrys',
    domain: 'benjerry.com',
    acceptableBands: [EthicalStatus.Mixed, EthicalStatus.Good, EthicalStatus.Excellent],
    why: 'long progressive activism record (Unilever ownership keeps Mixed acceptable)',
  },
]

async function main(): Promise<void> {
  if (!process.env['OPENROUTER_API_KEY']) {
    console.error('OPENROUTER_API_KEY is required — this harness makes real model calls.')
    console.error('Usage: OPENROUTER_API_KEY=sk-... pnpm eval')
    process.exit(2)
  }

  const maxCompanies = Number(process.env['EVAL_MAX_COMPANIES'] ?? FIXTURES.length)
  const fixtures = FIXTURES.slice(0, maxCompanies)
  const model = process.env['SCORING_MODEL'] ?? 'anthropic/claude-sonnet-4-5'

  const provider = new OpenRouterProvider({ model, timeoutMs: 45_000 })
  const contextSource = process.env['BRAVE_API_KEY'] ? new BraveSearchSource() : undefined
  const store = new InMemoryStore()
  const scoreCompany = makeScoreCompanyFn(contextSource)

  console.log(`\nTier-2 eval — model: ${model}, context: ${contextSource ? 'web search' : 'none'}`)
  console.log(`Scoring ${fixtures.length} companies…\n`)

  let failures = 0
  for (const fixture of fixtures) {
    try {
      const report = await scoreCompany(fixture.name, fixture.domain, provider, store)
      const pass = fixture.acceptableBands.includes(report.overallScore)
      if (!pass) failures++

      console.log(
        `${pass ? '✓' : '✗'} ${fixture.name.padEnd(14)} → ${report.overallScore.padEnd(11)}` +
          ` (accepted: ${fixture.acceptableBands.join('/')})`,
      )
      if (!pass) {
        console.log(`    why expected: ${fixture.why}`)
        for (const cat of report.categories.filter((c) => c.score !== null)) {
          console.log(`    ${cat.id}: ${String(cat.score)} — ${cat.blurb}`)
        }
      }
    } catch (err) {
      failures++
      console.log(
        `✗ ${fixture.name.padEnd(14)} → ERROR: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  console.log(`\n${fixtures.length - failures}/${fixtures.length} fixtures in band.`)
  process.exit(failures > 0 ? 1 : 0)
}

void main()
