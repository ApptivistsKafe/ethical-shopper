import {
  EthicalStatus,
  ETHICAL_STATUS_NUMERIC,
  NEUTRAL_ROLLUP_VALUE,
  type CategoryScore,
  type UserWeights,
  type CategoryView,
  type CompanyView,
  type EthicsReport,
} from './types.js'
import { TAXONOMY, getTaxonomyEntry } from './taxonomy.js'

// ─── Numeric ↔ EthicalStatus ──────────────────────────────────────────────────

/**
 * Maps a continuous numeric score (1–5 scale) back to the nearest EthicalStatus band.
 * Boundaries: <1.5→Poor, <2.5→Concerning, <3.5→Mixed, <4.5→Good, ≥4.5→Excellent
 */
export function numericToEthicalStatus(value: number): EthicalStatus {
  if (value >= 4.5) return EthicalStatus.Excellent
  if (value >= 3.5) return EthicalStatus.Good
  if (value >= 2.5) return EthicalStatus.Mixed
  if (value >= 1.5) return EthicalStatus.Concerning
  return EthicalStatus.Poor
}

export function ethicalStatusToNumeric(status: EthicalStatus): number {
  return ETHICAL_STATUS_NUMERIC[status]
}

// ─── User Weight Clamping ─────────────────────────────────────────────────────

/** Upper bound for user-supplied category weights. */
export const MAX_USER_WEIGHT = 10

/**
 * Clamps an untrusted user weight to the valid range [0, MAX_USER_WEIGHT].
 *
 * REQUIREMENT: users may opt OUT of a category (weight 0) but must never be
 * able to INVERT its polarity. A negative weight would flip a category's
 * contribution in the rollup (making Poor scores raise the overall rating),
 * so anything non-finite or below zero is treated as opt-out.
 */
export function clampUserWeight(raw: number | undefined): number | undefined {
  if (raw === undefined) return undefined
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(raw, MAX_USER_WEIGHT)
}

// ─── Rollup ───────────────────────────────────────────────────────────────────

/**
 * Computes the overall EthicalStatus from a set of category scores.
 *
 * KEY DESIGN DECISION (neutral-as-midpoint):
 *   Neutral categories (score: null) are included in the rollup as NEUTRAL_ROLLUP_VALUE (3 = Mixed).
 *   This prevents a company with ONE bad category and everything else neutral from
 *   scoring the same as a company that is broadly mediocre across ALL categories.
 *
 *   Example with weights=1, 7 categories, neutral value=3:
 *     Company A: one Concerning (2), rest neutral → avg = (2 + 3×6)/7 ≈ 2.86 → Mixed
 *     Company B: all Concerning (2)               → avg = 2.0 → Concerning
 *     Company B correctly rates worse. ✓
 *
 *   Neutral categories are still EXCLUDED from the UI display — the math sees them,
 *   the user doesn't.
 *
 * @param categories Full taxonomy scores from the model (all CategoryIds, some may be null).
 * @param userWeights Per-user weight overrides. 0 = opted out (excluded from rollup entirely).
 *                    undefined = use taxonomy default weight.
 */
export function computeOverallScore(
  categories: CategoryScore[],
  userWeights: UserWeights = {},
): EthicalStatus {
  const categoryMap = new Map(categories.map((c) => [c.id, c]))

  let weightedSum = 0
  let totalWeight = 0

  for (const entry of TAXONOMY) {
    const userWeight = clampUserWeight(userWeights[entry.id])
    // 0 means opted out — exclude entirely
    if (userWeight === 0) continue

    const effectiveWeight =
      (userWeight ?? entry.defaultWeight) * confidenceMultiplier(categoryMap.get(entry.id))

    const categoryScore = categoryMap.get(entry.id)
    const numericScore =
      categoryScore?.score != null
        ? ETHICAL_STATUS_NUMERIC[categoryScore.score]
        : NEUTRAL_ROLLUP_VALUE

    weightedSum += numericScore * effectiveWeight
    totalWeight += effectiveWeight
  }

  if (totalWeight === 0) return EthicalStatus.Mixed
  return numericToEthicalStatus(weightedSum / totalWeight)
}

/**
 * Returns a confidence multiplier (0.5–1.0) that down-weights low-confidence scores.
 * A null/missing category has full weight (neutral value is reliable).
 */
function confidenceMultiplier(cat: CategoryScore | undefined): number {
  if (!cat || cat.score === null) return 1.0
  // confidence 0→0.5 multiplier, confidence 1→1.0 multiplier
  return 0.5 + cat.confidence * 0.5
}

// ─── User View ────────────────────────────────────────────────────────────────

/**
 * Filters the full category list to only those a given user wants to see:
 *   - Non-neutral (score !== null)
 *   - Not opted-out by the user (weight !== 0)
 */
export function filterVisibleCategories(
  categories: CategoryScore[],
  userWeights: UserWeights = {},
): CategoryScore[] {
  return categories.filter(
    (cat) => cat.score !== null && clampUserWeight(userWeights[cat.id]) !== 0,
  )
}

/**
 * Composes a plain-language explanation from the blurbs of visible categories.
 * No model calls — purely concatenates cached blurbs.
 */
export function composeExplanation(visibleCategories: CategoryScore[]): string {
  const blurbs = visibleCategories.map((c) => c.blurb).filter(Boolean)
  if (blurbs.length === 0)
    return 'No notable ethical concerns or highlights found for this company.'
  return blurbs.join(' ')
}

/**
 * Builds the complete presentation view for a company from its cached EthicsReport.
 * Pure function — no I/O, no model calls.
 */
export function buildCompanyView(report: EthicsReport, userWeights: UserWeights = {}): CompanyView {
  const overallScore = computeOverallScore(report.categories, userWeights)
  const visible = filterVisibleCategories(report.categories, userWeights)

  const visibleCategories: CategoryView[] = visible.map((cat) => ({
    id: cat.id,
    label: getTaxonomyEntry(cat.id).label,
    score: cat.score!, // non-null guaranteed by filterVisibleCategories
    blurb: cat.blurb,
    confidence: cat.confidence,
  }))

  return {
    companyName: report.company.name,
    overallScore,
    ratingBand: overallScore,
    color: getEthicalStatusColor(overallScore),
    emoji: getEthicalStatusEmoji(overallScore),
    visibleCategories,
    explanation: composeExplanation(visible),
  }
}

// ─── Color & Emoji ────────────────────────────────────────────────────────────

/** HSL green→red gradient on a continuous 0–1 scale. */
function greenRedGradient(hueOffsetPct: number, lightness: number): string {
  const hue = ((1 - hueOffsetPct) * 120).toFixed(0)
  return `hsl(${hue},100%,${lightness}%)`
}

const STATUS_HUE: Record<EthicalStatus, number> = {
  [EthicalStatus.Excellent]: 0,
  [EthicalStatus.Good]: 0.25,
  [EthicalStatus.Mixed]: 0.5,
  [EthicalStatus.Concerning]: 0.75,
  [EthicalStatus.Poor]: 1,
}

export function getEthicalStatusColor(status: EthicalStatus): string {
  return greenRedGradient(STATUS_HUE[status], 85)
}

export function getEthicalStatusStrokeColor(status: EthicalStatus): string {
  return greenRedGradient(STATUS_HUE[status], 30)
}

const STATUS_EMOJI: Record<EthicalStatus, string> = {
  [EthicalStatus.Excellent]: '😊',
  [EthicalStatus.Good]: '🙂',
  [EthicalStatus.Mixed]: '😐',
  [EthicalStatus.Concerning]: '😟',
  [EthicalStatus.Poor]: '😠',
}

export function getEthicalStatusEmoji(status: EthicalStatus): string {
  return STATUS_EMOJI[status]
}

// ─── Cache Key ────────────────────────────────────────────────────────────────

/** Stable cache key for a company — lowercase domain preferred, else normalized name. */
export function buildCompanyCacheKey(name: string, domain?: string | null): string {
  if (domain) return `company:${domain.toLowerCase().replace(/^www\./, '')}`
  return `company:${name.toLowerCase().replace(/\s+/g, '-')}`
}
