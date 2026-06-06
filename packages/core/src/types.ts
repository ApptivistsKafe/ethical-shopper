// ─── Ethical Status ──────────────────────────────────────────────────────────

export enum EthicalStatus {
  Excellent = 'Excellent',
  Good = 'Good',
  Mixed = 'Mixed',
  Concerning = 'Concerning',
  Poor = 'Poor',
}

/** Numeric representation for weighted rollup math (Poor=1 … Excellent=5). */
export const ETHICAL_STATUS_NUMERIC: Record<EthicalStatus, number> = {
  [EthicalStatus.Excellent]: 5,
  [EthicalStatus.Good]: 4,
  [EthicalStatus.Mixed]: 3,
  [EthicalStatus.Concerning]: 2,
  [EthicalStatus.Poor]: 1,
}

/**
 * The numeric value assigned to a NEUTRAL (null) category in the rollup.
 * Using 3 (Mixed) ensures that:
 *  - A company neutral on everything scores 3 (Mixed) — inoffensive middle.
 *  - A company with one bad category and the rest neutral scores > that one bad score alone.
 *  - A company broadly mediocre across all categories scores lower than a neutral one.
 * Neutrals are still EXCLUDED from the UI display; only the math uses this value.
 */
export const NEUTRAL_ROLLUP_VALUE = 3

// ─── Taxonomy ────────────────────────────────────────────────────────────────

export type CategoryId =
  | 'labor'
  | 'climate'
  | 'political_giving'
  | 'animal_welfare'
  | 'data_privacy_surveillance'
  | 'governance_anticompetitive'
  | 'supply_chain'

// ─── Ethics Report ───────────────────────────────────────────────────────────

export interface CategoryScore {
  id: CategoryId
  /**
   * null = NEUTRAL — company has no notable positive or negative action on this concern.
   * Neutral categories are EXCLUDED from the UI but included in rollup math as NEUTRAL_ROLLUP_VALUE.
   */
  score: EthicalStatus | null
  /** 1–2 sentence plain-language rationale. Always present even when neutral. */
  blurb: string
  /** 0–1 model-provided confidence. Low-confidence categories are down-weighted in rollup. */
  confidence: number
  sources?: string[]
}

export interface EthicsReport {
  company: {
    name: string
    domain: string | null
    aliases: string[]
  }
  /** Full taxonomy scored — always all categories. Neutrals have score: null. */
  categories: CategoryScore[]
  /** Deterministic weighted rollup over all categories (neutrals as midpoint). */
  overallScore: EthicalStatus
  /** Same as overallScore; drives color + emoji rendering. */
  ratingBand: EthicalStatus
  /**
   * When the model detects an ethical dimension not in the taxonomy.
   * Queued for human review — NEVER auto-applied to scoring.
   */
  suggestedNewCategory?: {
    label: string
    rationale: string
    source: 'model'
  }
  meta: {
    modelUsed: string
    scoredAt: string
    cacheKey: string
  }
}

// ─── Suggestion Log ───────────────────────────────────────────────────────────

/** Source of a suggested new ethical concern category. */
export type SuggestionSource = 'model' | 'user'

export interface CategorySuggestion {
  rawLabel: string
  /** Normalized (lowercase, trimmed) for model-suggestion dedup. User suggestions are NOT deduped. */
  normalizedLabel: string
  rationale: string
  source: SuggestionSource
  company?: string
  timestamp: string
}

// ─── Cart ─────────────────────────────────────────────────────────────────────

export interface CartItem {
  name: string
  brand: string | null
  sellingCompany: string
  price: number | null
  url: string | null
  /** Carried forward for Spec 2 recommendations accuracy. */
  requiredAttributes?: {
    type?: string
    size?: string
  }
}

export interface Cart {
  items: CartItem[]
  sourceUrl: string
}

// ─── User Personalization ─────────────────────────────────────────────────────

/**
 * Per-category weight for a user's personalized view.
 * 0 = opted out (category hidden and excluded from rollup).
 * undefined = use the taxonomy default weight.
 * Values >0 are relative multipliers.
 */
export type UserWeights = Partial<Record<CategoryId, number>>

// ─── Presentation Views ───────────────────────────────────────────────────────

export interface CategoryView {
  id: CategoryId
  label: string
  score: EthicalStatus
  blurb: string
  confidence: number
}

export interface CompanyView {
  companyName: string
  overallScore: EthicalStatus
  ratingBand: EthicalStatus
  color: string
  emoji: string
  /** Only non-neutral categories the user cares about. Empty = no notable concerns/highlights. */
  visibleCategories: CategoryView[]
  /** Plain-language explanation composed from the blurbs of visibleCategories. */
  explanation: string
}

// ─── API Contracts ────────────────────────────────────────────────────────────

export interface AnalyzeRequest {
  markdown: string
  url: string
  userWeights?: UserWeights
}

export interface AnalyzeResponse {
  cart: Cart
  views: CompanyView[]
}

/** Streamed event shape for the /analyze endpoint. */
export type AnalyzeStreamEvent =
  | { type: 'cart'; cart: Cart }
  | { type: 'companyView'; view: CompanyView }
  | { type: 'done' }
  | { type: 'error'; message: string }
