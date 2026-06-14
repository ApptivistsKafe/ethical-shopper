// Types
export * from './types.js'

// Taxonomy
export { TAXONOMY, getTaxonomyEntry, ALL_CATEGORY_IDS } from './taxonomy.js'
export type { TaxonomyEntry } from './taxonomy.js'

// Scoring & presentation (pure functions)
export {
  computeOverallScore,
  numericToEthicalStatus,
  ethicalStatusToNumeric,
  clampUserWeight,
  MAX_USER_WEIGHT,
  filterVisibleCategories,
  composeExplanation,
  buildCompanyView,
  getEthicalStatusColor,
  getEthicalStatusStrokeColor,
  getEthicalStatusEmoji,
  buildCompanyCacheKey,
} from './scoring.js'

// Schemas (Zod)
export {
  EthicalStatusSchema,
  CategoryIdSchema,
  CategoryScoreSchema,
  EthicsReportSchema,
  ModelScoringResponseSchema,
  CartSchema,
  CartItemSchema,
  CategorySuggestionSchema,
  UserWeightsSchema,
  AnalyzeRequestSchema,
  SuggestRequestSchema,
  RecommendRequestSchema,
  ModelRecommendResponseSchema,
  parseScoringResponse,
  parseCart,
  parseRecommendResponse,
} from './schemas.js'
export type { ModelScoringResponse, ModelRecommendResponse, CartSchemaType } from './schemas.js'

// Interfaces
export type {
  ModelProvider,
  ModelMessage,
  ModelOptions,
  ModelResponse,
  Store,
  ContextSource,
  SearchResult,
  ExtractCartFn,
  ScoreCompanyFn,
} from './interfaces.js'

// Suggestions
export { normalizeSuggestionLabel, buildSuggestion } from './suggestions.js'

// Prompt-safety utilities
export { sanitizeUntrustedText, sanitizeSnippet, wrapUntrusted } from './sanitize.js'
export type { SanitizeOptions } from './sanitize.js'
export { extractJsonObject } from './modelJson.js'

// Content-safety gate (page classification — shared by client + server)
export {
  classifyPage,
  classifyText,
  extractTextSignals,
  isAdultHost,
  countDistinctKeywords,
  countMatches,
  MIN_COMMERCE_KEYWORDS,
  MIN_ADULT_KEYWORDS,
  RTA_LABEL,
  PAGE_CLASSIFIER_VOCAB,
} from './pageClassifier.js'
export type { PageSignals, PageDecision, PageClassification } from './pageClassifier.js'

// In-memory Store — a real (non-fake) implementation suitable for dev/demo environments
// where persistence across restarts is not required.
export { InMemoryStore } from './fakes/InMemoryStore.js'
