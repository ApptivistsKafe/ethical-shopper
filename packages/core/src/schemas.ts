import { z } from 'zod'
import { EthicalStatus } from './types.js'
import { ALL_CATEGORY_IDS } from './taxonomy.js'

// ─── Primitives ───────────────────────────────────────────────────────────────

export const EthicalStatusSchema = z.nativeEnum(EthicalStatus)

export const CategoryIdSchema = z.enum(ALL_CATEGORY_IDS as [string, ...string[]])

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
  items: z.array(CartItemSchema).min(1),
  sourceUrl: z.string(),
})

export type CartSchemaType = z.infer<typeof CartSchema>

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
