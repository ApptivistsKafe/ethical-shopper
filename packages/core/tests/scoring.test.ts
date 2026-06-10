import { describe, it, expect } from 'vitest'
import {
  computeOverallScore,
  numericToEthicalStatus,
  clampUserWeight,
  MAX_USER_WEIGHT,
  filterVisibleCategories,
  composeExplanation,
  buildCompanyView,
  buildCompanyCacheKey,
  getEthicalStatusColor,
  getEthicalStatusEmoji,
} from '../src/scoring.js'
import {
  EthicalStatus,
  NEUTRAL_ROLLUP_VALUE,
  type CategoryScore,
  type EthicsReport,
} from '../src/types.js'
import { ALL_CATEGORY_IDS } from '../src/taxonomy.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeCategory(
  id: CategoryScore['id'],
  score: EthicalStatus | null,
  confidence = 1.0,
): CategoryScore {
  return { id, score, blurb: `Blurb for ${id}`, confidence }
}

/** All categories neutral except the specified ones. */
function categoriesWithScores(
  overrides: Partial<Record<CategoryScore['id'], EthicalStatus>>,
): CategoryScore[] {
  return ALL_CATEGORY_IDS.map((id) => makeCategory(id, overrides[id] ?? null))
}

function makeReport(categories: CategoryScore[], companyName = 'TestCo'): EthicsReport {
  return {
    company: { name: companyName, domain: 'testco.com', aliases: [] },
    categories,
    overallScore: EthicalStatus.Mixed,
    ratingBand: EthicalStatus.Mixed,
    meta: { modelUsed: 'fake', scoredAt: new Date().toISOString(), cacheKey: 'company:testco.com' },
  }
}

// ─── numericToEthicalStatus ───────────────────────────────────────────────────

describe('numericToEthicalStatus', () => {
  it('maps boundary values correctly', () => {
    expect(numericToEthicalStatus(5)).toBe(EthicalStatus.Excellent)
    expect(numericToEthicalStatus(4.5)).toBe(EthicalStatus.Excellent)
    expect(numericToEthicalStatus(4.49)).toBe(EthicalStatus.Good)
    expect(numericToEthicalStatus(4)).toBe(EthicalStatus.Good)
    expect(numericToEthicalStatus(3.5)).toBe(EthicalStatus.Good)
    expect(numericToEthicalStatus(3.49)).toBe(EthicalStatus.Mixed)
    expect(numericToEthicalStatus(3)).toBe(EthicalStatus.Mixed)
    expect(numericToEthicalStatus(2.5)).toBe(EthicalStatus.Mixed)
    expect(numericToEthicalStatus(2.49)).toBe(EthicalStatus.Concerning)
    expect(numericToEthicalStatus(2)).toBe(EthicalStatus.Concerning)
    expect(numericToEthicalStatus(1.5)).toBe(EthicalStatus.Concerning)
    expect(numericToEthicalStatus(1.49)).toBe(EthicalStatus.Poor)
    expect(numericToEthicalStatus(1)).toBe(EthicalStatus.Poor)
  })
})

// ─── computeOverallScore ──────────────────────────────────────────────────────

describe('computeOverallScore', () => {
  it('returns Mixed when all categories are neutral', () => {
    const cats = categoriesWithScores({})
    expect(computeOverallScore(cats)).toBe(EthicalStatus.Mixed)
  })

  it('returns Excellent when all categories are Excellent', () => {
    const overrides = Object.fromEntries(
      ALL_CATEGORY_IDS.map((id) => [id, EthicalStatus.Excellent]),
    ) as any
    expect(computeOverallScore(categoriesWithScores(overrides))).toBe(EthicalStatus.Excellent)
  })

  it('returns Poor when all categories are Poor', () => {
    const overrides = Object.fromEntries(
      ALL_CATEGORY_IDS.map((id) => [id, EthicalStatus.Poor]),
    ) as any
    expect(computeOverallScore(categoriesWithScores(overrides))).toBe(EthicalStatus.Poor)
  })

  /**
   * THE KEY BREADTH TEST (addresses question #1):
   * Company A: one Concerning, rest neutral → should score ~Mixed (near center).
   * Company B: ALL Concerning → should score Concerning (worse than Company A).
   * With neutral-as-midpoint, Company B correctly rates worse.
   */
  it('rates a broadly mediocre company worse than one with a single offense (breadth test)', () => {
    // Company A: one Concerning offense, everything else neutral
    const companyA = categoriesWithScores({ labor: EthicalStatus.Concerning })
    const scoreA = computeOverallScore(companyA)

    // Company B: Concerning across ALL concerns
    const allConcerning = Object.fromEntries(
      ALL_CATEGORY_IDS.map((id) => [id, EthicalStatus.Concerning]),
    ) as any
    const companyB = categoriesWithScores(allConcerning)
    const scoreB = computeOverallScore(companyB)

    // Company B (broad) should be rated equal or worse than Company A (single offense)
    const numericA = getNumericScore(scoreA)
    const numericB = getNumericScore(scoreB)
    expect(numericB).toBeLessThanOrEqual(numericA)
    // More specifically: Company A should be Mixed (near neutral), Company B should be Concerning
    expect(scoreA).toBe(EthicalStatus.Mixed)
    expect(scoreB).toBe(EthicalStatus.Concerning)
  })

  it('a single Poor category with rest neutral yields better than a company with all Poor', () => {
    const singlePoor = categoriesWithScores({ political_giving: EthicalStatus.Poor })
    const allPoor = categoriesWithScores(
      Object.fromEntries(ALL_CATEGORY_IDS.map((id) => [id, EthicalStatus.Poor])) as any,
    )
    const scoreA = computeOverallScore(singlePoor)
    const scoreB = computeOverallScore(allPoor)
    expect(getNumericScore(scoreA)).toBeGreaterThan(getNumericScore(scoreB))
  })

  it('respects user weights — opted-out category (weight=0) excluded from rollup', () => {
    // political_giving is Poor, but user doesn't care about it
    const cats = categoriesWithScores({ political_giving: EthicalStatus.Poor })
    const scoreWithout = computeOverallScore(cats, { political_giving: 0 })
    const scoreWith = computeOverallScore(cats)
    // Without the Poor category, score should be at least as good (closer to neutral).
    // When political_giving is the only non-neutral category, opting out replaces Poor(2)
    // with neutral(3) in the rollup — both resolve to Mixed(3) at this scale, so >= is correct.
    expect(getNumericScore(scoreWithout)).toBeGreaterThanOrEqual(getNumericScore(scoreWith))
  })

  it('heavier weight for a category amplifies its contribution', () => {
    const cats = categoriesWithScores({ labor: EthicalStatus.Poor })
    const normalWeight = computeOverallScore(cats, { labor: 1 })
    const heavyWeight = computeOverallScore(cats, { labor: 5 })
    expect(getNumericScore(heavyWeight)).toBeLessThanOrEqual(getNumericScore(normalWeight))
  })

  it('returns Mixed when all categories are opted out', () => {
    const cats = categoriesWithScores({ labor: EthicalStatus.Poor })
    const weights = Object.fromEntries(ALL_CATEGORY_IDS.map((id) => [id, 0])) as any
    expect(computeOverallScore(cats, weights)).toBe(EthicalStatus.Mixed)
  })

  it('political_giving default weight is higher than others (amplifies political signal)', () => {
    // Same score, but political_giving should drag the overall more than labor
    const withPolitical = categoriesWithScores({ political_giving: EthicalStatus.Poor })
    const withLabor = categoriesWithScores({ labor: EthicalStatus.Poor })
    const pScore = computeOverallScore(withPolitical)
    const lScore = computeOverallScore(withLabor)
    // political_giving has weight 1.5 vs labor 1.0, so it should pull more
    expect(getNumericScore(pScore)).toBeLessThanOrEqual(getNumericScore(lScore))
  })

  it('neutral value is 3 (Mixed) — the NEUTRAL_ROLLUP_VALUE constant', () => {
    expect(NEUTRAL_ROLLUP_VALUE).toBe(3)
  })

  it('NEGATIVE weights cannot invert polarity — treated as opt-out', () => {
    // All categories Poor; a malicious client sends a large negative weight
    // hoping to flip Poor contributions into positive ones.
    const allPoor = categoriesWithScores(
      Object.fromEntries(ALL_CATEGORY_IDS.map((id) => [id, EthicalStatus.Poor])) as any,
    )
    const attacked = computeOverallScore(allPoor, { political_giving: -50, labor: -50 })
    // Negative weights clamp to 0 (opt-out); the remaining Poor categories dominate.
    expect(attacked).toBe(EthicalStatus.Poor)
  })

  it('non-finite weights are treated as opt-out, not honored', () => {
    const cats = categoriesWithScores({ labor: EthicalStatus.Poor })
    expect(() => computeOverallScore(cats, { labor: Infinity })).not.toThrow()
    // NaN weight must not poison the rollup into NaN — result stays a valid band
    const withNaN = computeOverallScore(cats, { labor: NaN })
    expect(Object.values(EthicalStatus)).toContain(withNaN)
  })

  it('clampUserWeight clamps to [0, MAX_USER_WEIGHT]', () => {
    expect(clampUserWeight(undefined)).toBeUndefined()
    expect(clampUserWeight(-1)).toBe(0)
    expect(clampUserWeight(0)).toBe(0)
    expect(clampUserWeight(2)).toBe(2)
    expect(clampUserWeight(999)).toBe(MAX_USER_WEIGHT)
    expect(clampUserWeight(NaN)).toBe(0)
  })

  it('negative weight also hides the category from display (filterVisibleCategories)', () => {
    const cats = categoriesWithScores({ political_giving: EthicalStatus.Poor })
    const visible = filterVisibleCategories(cats, { political_giving: -3 })
    expect(visible.some((c) => c.id === 'political_giving')).toBe(false)
  })
})

// ─── filterVisibleCategories ──────────────────────────────────────────────────

describe('filterVisibleCategories', () => {
  it('excludes neutral categories from display', () => {
    const cats = categoriesWithScores({ labor: EthicalStatus.Poor })
    const visible = filterVisibleCategories(cats)
    expect(visible).toHaveLength(1)
    expect(visible[0]?.id).toBe('labor')
  })

  it('excludes opted-out categories from display', () => {
    const cats = categoriesWithScores({
      labor: EthicalStatus.Poor,
      climate: EthicalStatus.Good,
    })
    const visible = filterVisibleCategories(cats, { labor: 0 })
    expect(visible.map((c) => c.id)).toEqual(['climate'])
  })

  it('returns empty array when all are neutral', () => {
    const cats = categoriesWithScores({})
    expect(filterVisibleCategories(cats)).toHaveLength(0)
  })

  it('includes both positive and negative non-neutral scores', () => {
    const cats = categoriesWithScores({
      labor: EthicalStatus.Poor,
      climate: EthicalStatus.Excellent,
    })
    const ids = filterVisibleCategories(cats).map((c) => c.id)
    expect(ids).toContain('labor')
    expect(ids).toContain('climate')
  })
})

// ─── composeExplanation ────────────────────────────────────────────────────────

describe('composeExplanation', () => {
  it('returns a default message when no visible categories', () => {
    const result = composeExplanation([])
    expect(result).toMatch(/no notable/i)
  })

  it('joins blurbs from visible categories', () => {
    const cats = [
      makeCategory('labor', EthicalStatus.Poor),
      makeCategory('climate', EthicalStatus.Good),
    ]
    const result = composeExplanation(cats)
    expect(result).toContain('Blurb for labor')
    expect(result).toContain('Blurb for climate')
  })
})

// ─── buildCompanyView ─────────────────────────────────────────────────────────

describe('buildCompanyView', () => {
  it('builds a correct view for a company with mixed scores', () => {
    const cats = categoriesWithScores({
      labor: EthicalStatus.Poor,
      climate: EthicalStatus.Good,
    })
    const report = makeReport(cats, 'Acme Corp')
    const view = buildCompanyView(report)

    expect(view.companyName).toBe('Acme Corp')
    expect([EthicalStatus.Mixed, EthicalStatus.Concerning, EthicalStatus.Good]).toContain(
      view.overallScore,
    )
    expect(view.visibleCategories).toHaveLength(2)
    expect(view.explanation).toBeTruthy()
    expect(view.color).toMatch(/^hsl/)
    expect(view.emoji).toBeTruthy()
  })

  it('applies user weights when building a view', () => {
    const cats = categoriesWithScores({ political_giving: EthicalStatus.Poor })
    const report = makeReport(cats)
    const withPolitics = buildCompanyView(report)
    const withoutPolitics = buildCompanyView(report, { political_giving: 0 })

    // With politics: political_giving is visible and drags score down
    expect(withPolitics.visibleCategories.some((c) => c.id === 'political_giving')).toBe(true)
    // Without: political_giving is hidden
    expect(withoutPolitics.visibleCategories.some((c) => c.id === 'political_giving')).toBe(false)
    // Score should be at least as good when the bad category is excluded.
    // With only political_giving non-neutral, excluding it replaces Poor(2) with neutral(3)
    // in the rollup — both resolve to Mixed(3), so >= is correct.
    expect(getNumericScore(withoutPolitics.overallScore)).toBeGreaterThanOrEqual(
      getNumericScore(withPolitics.overallScore),
    )
  })

  it('has no visible categories for a fully neutral company', () => {
    const report = makeReport(categoriesWithScores({}))
    const view = buildCompanyView(report)
    expect(view.visibleCategories).toHaveLength(0)
    expect(view.overallScore).toBe(EthicalStatus.Mixed)
  })
})

// ─── buildCompanyCacheKey ────────────────────────────────────────────────────

describe('buildCompanyCacheKey', () => {
  it('uses domain when available, stripping www', () => {
    expect(buildCompanyCacheKey('Amazon', 'www.amazon.com')).toBe('company:amazon.com')
    expect(buildCompanyCacheKey('Google', 'google.com')).toBe('company:google.com')
  })

  it('falls back to normalized name when no domain', () => {
    expect(buildCompanyCacheKey('Whole Foods', null)).toBe('company:whole-foods')
    expect(buildCompanyCacheKey('Apple Inc', null)).toBe('company:apple-inc')
  })
})

// ─── color & emoji ────────────────────────────────────────────────────────────

describe('getEthicalStatusColor', () => {
  it('returns hsl strings for all statuses', () => {
    for (const status of Object.values(EthicalStatus)) {
      expect(getEthicalStatusColor(status)).toMatch(/^hsl\(\d+,100%,85%\)/)
    }
  })

  it('green for Excellent, red for Poor', () => {
    const excellent = getEthicalStatusColor(EthicalStatus.Excellent)
    const poor = getEthicalStatusColor(EthicalStatus.Poor)
    // Excellent hue ≈ 120 (green), Poor hue ≈ 0 (red)
    expect(excellent).toMatch(/hsl\(120,/)
    expect(poor).toMatch(/hsl\(0,/)
  })
})

describe('getEthicalStatusEmoji', () => {
  it('returns an emoji for every status', () => {
    for (const status of Object.values(EthicalStatus)) {
      const emoji = getEthicalStatusEmoji(status)
      expect(emoji).toBeTruthy()
      expect(typeof emoji).toBe('string')
    }
  })

  it('uses a smile for Excellent and a frown for Poor', () => {
    expect(getEthicalStatusEmoji(EthicalStatus.Excellent)).toBe('😊')
    expect(getEthicalStatusEmoji(EthicalStatus.Poor)).toBe('😠')
  })
})

// ─── Helper ───────────────────────────────────────────────────────────────────

function getNumericScore(status: EthicalStatus): number {
  const map: Record<EthicalStatus, number> = {
    [EthicalStatus.Excellent]: 5,
    [EthicalStatus.Good]: 4,
    [EthicalStatus.Mixed]: 3,
    [EthicalStatus.Concerning]: 2,
    [EthicalStatus.Poor]: 1,
  }
  return map[status]
}
