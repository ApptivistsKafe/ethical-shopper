import type { UserWeights, CategoryId } from '@ethical-shopper/core'
import { ALL_CATEGORY_IDS, MAX_USER_WEIGHT } from '@ethical-shopper/core'

const STORAGE_KEY = 'userWeights'

/**
 * Validates an untrusted stored value into well-formed UserWeights.
 * Drops unknown categories and clamps values to [0, MAX_USER_WEIGHT] —
 * storage contents can be stale (taxonomy changed) or corrupted.
 * Pure function for testability.
 */
export function normalizeStoredWeights(raw: unknown): UserWeights {
  if (typeof raw !== 'object' || raw === null) return {}

  const weights: UserWeights = {}
  for (const id of ALL_CATEGORY_IDS) {
    const value = (raw as Record<string, unknown>)[id]
    if (typeof value !== 'number' || !Number.isFinite(value)) continue
    weights[id] = Math.min(Math.max(value, 0), MAX_USER_WEIGHT)
  }
  return weights
}

/** Loads the user's category weights from synced extension storage. */
export async function loadUserWeights(): Promise<UserWeights> {
  if (typeof chrome === 'undefined' || !chrome.storage?.sync) return {}
  try {
    const result = await chrome.storage.sync.get(STORAGE_KEY)
    return normalizeStoredWeights(result[STORAGE_KEY])
  } catch {
    return {}
  }
}

/** Persists the user's category weights to synced extension storage. */
export async function saveUserWeights(weights: UserWeights): Promise<void> {
  await chrome.storage.sync.set({ [STORAGE_KEY]: weights })
}

/** Convenience for the options UI: weight currently in effect for a category. */
export function effectiveWeight(
  weights: UserWeights,
  id: CategoryId,
  defaultWeight: number,
): number {
  return weights[id] ?? defaultWeight
}
