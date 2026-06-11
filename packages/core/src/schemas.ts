import { z } from 'zod'
import { EthicalStatus, type CategoryId } from './types.js'
import { ALL_CATEGORY_IDS } from './taxonomy.js'

// ─── Primitives ───────────────────────────────────────────────────────────────

export const EthicalStatusSchema = z.nativeEnum(EthicalStatus)

// Preserve the CategoryId literal union so z.infer gives 'labor' | 'climate' | ...
// rather than plain string — needed for type-safe assignment to CategoryScore.id.
export const CategoryIdSchema = z.enum(ALL_CATEGORY_IDS as unknown as [CategoryId, ...CategoryId[]])

// ─── Category Score ───────────────────────────────────────────────────────────

export const CategoryScoreSchema = z.object({
  id: CategoryIdSchema,
  score: EthicalStatusSchema.nullable(),
  blurb: z.string().min(1),
  confidence: z.number().min(0).max(1),
  sources: z.array(z.string()).optional(),
})

// ─── Company (in EthicsReport) ────────────────────────────────────────────────

export const CompanySchema = z.object({
  name: z.string().min(1),
  domain: z.string().nullable(),
  aliases: z.array(z.string()),
})

// ─── Suggested New Category ───────────────────────────────────────────────────

export const SuggestedNewCategorySchema = z.object({
  label: z.string().min(1),
  rationale: z.string().min(1),
  source: z.literal('model'),
})

// ─── Ethics Report (full model output) ───────────────────────────────────────

export const EthicsReportSchema = z.object({
  company: CompanySchema,
  categories: z.array(CategoryScoreSchema),
  overallScore: EthicalStatusSchema,
  ratingBand: EthicalStatusSchema,
  suggestedNewCategory: SuggestedNewCategorySchema.optional(),
  meta: z.object({
    modelUsed: z.string(),
    scoredAt: z.string(),
    cacheKey: z.string(),
  }),
})

// ─── Model scoring response (raw LLM output before domain processing) ─────────

/**
 * This is what the scoring model is asked to return.
 * overallScore is NOT included — we compute it deterministically.
 */
export const ModelScoringResponseSchema = z.object({
  categories: z.array(CategoryScoreSchema),
  suggestedNewCategory: SuggestedNewCategorySchema.optional(),
})

export type ModelScoringResponse = z.infer<typeof ModelScoringResponseSchema>

// ─── Cart / Extraction ────────────────────────────────────────────────────────

export const CartItemSchema = z.object({
  name: z.string().min(1),
  brand: z.string().nullable(),
  sellingCompany: z.string().min(1),
  price: z.number().nullable(),
  url: z.string().nullable(),
  requiredAttributes: z
    .object({
      type: z.string().optional(),
      size: z.string().optional(),
    })
    .optional(),
})

export const CartSchema = z.object({
  // Empty carts are valid — extraction finding nothing is a graceful "no items"
  // outcome, not an error.
  items: z.array(CartItemSchema),
  sourceUrl: z.string(),
})

export type CartSchemaType = z.infer<typeof CartSchema>

// ─── API Request Validation ───────────────────────────────────────────────────

/**
 * User weights from an untrusted client. Bounds enforced here AND clamped again
 * in scoring (defense in depth) — negative weights would invert category
 * polarity, which is explicitly disallowed.
 */
export const UserWeightsSchema = z.record(CategoryIdSchema, z.number().min(0).max(10))

export const AnalyzeRequestSchema = z.object({
  markdown: z.string().min(1).max(200_000),
  url: z.string().min(1).max(2_000),
  userWeights: UserWeightsSchema.optional(),
})

export const SuggestRequestSchema = z.object({
  label: z.string().trim().min(2).max(80),
  rationale: z.string().trim().max(500).optional(),
})

// ─── Recommendations (Spec 2) ─────────────────────────────────────────────────

export const RecommendRequestSchema = z.object({
  item: CartItemSchema,
  userWeights: UserWeightsSchema.optional(),
})

/**
 * What the recommendation model is asked to return.
 * Ethics views are NOT included — alternatives' brands are scored separately
 * through the cached scoreCompany pipeline for consistency with /analyze.
 */
export const ModelRecommendResponseSchema = z.object({
  alternatives: z
    .array(
      z.object({
        productName: z.string().min(1),
        brand: z.string().min(1),
        sellingCompany: z.string().nullable(),
        approxPrice: z.number().nullable(),
        url: z.string().nullable(),
        reason: z.string().min(1),
      }),
    )
    .max(5),
})

export type ModelRecommendResponse = z.infer<typeof ModelRecommendResponseSchema>

export function parseRecommendResponse(raw: unknown): ModelRecommendResponse {
  return ModelRecommendResponseSchema.parse(raw)
}

// ─── Category Suggestion ──────────────────────────────────────────────────────

export const CategorySuggestionSchema = z.object({
  rawLabel: z.string().min(1),
  normalizedLabel: z.string().min(1),
  rationale: z.string(),
  source: z.enum(['model', 'user']),
  company: z.string().optional(),
  timestamp: z.string(),
})

// ─── Convenience ─────────────────────────────────────────────────────────────

/** Safely parse model output; returns data or throws with a descriptive error. */
export function parseScoringResponse(raw: unknown): ModelScoringResponse {
  return ModelScoringResponseSchema.parse(raw)
}

export function parseCart(raw: unknown): CartSchemaType {
  return CartSchema.parse(raw)
}
