# Spec 0 — Architecture & Testing Foundation

**Status:** Draft for review
**Date:** 2026-06-05
**Supersedes:** the current Express monolith backend + scattered LLM calls

---

## 1. Goal

Establish the testable, debuggable foundation for Ethical Shopper and prove it with the
first real vertical slice (detect → extract → score a company's ethics → render). Every
nondeterministic or external dependency (LLM, web search, database) sits behind an interface
with a fake, so the whole system can be unit-tested for **zero cost and zero flakiness**, while
real models are exercised only in a separate, rarely-run eval tier.

This is the thing that makes every later feature (recommendations, personalization, monetization,
analytics, cross-browser) cheap and safe to build and test.

## 2. Product context (one paragraph)

A browser extension (Chrome at launch) detects shopping checkout/cart pages, identifies the
companies/brands the user is buying from, and scores those companies on a set of ethical
concerns. Unethical companies get a clear color + emoji rating; later specs add real-time
ethical product alternatives, personalization, affiliate monetization, and analytics. The
ethics judgement at launch is **company/brand level only** (not per-product).

## 3. Scope of this spec

**In scope (Spec 0 + the core of Spec 1):**
- Monorepo structure with a shared `core` of domain logic + interfaces.
- The three core interfaces (`ModelProvider`, `ContextSource`, `Store`) + their fakes.
- The **analyze pipeline**: `extractCart` (generic LLM extraction) → `scoreCompany`
  (5-level per-category ethics) with **DB-as-cache**.
- The **ethics data model**: 5-level per-category scores, a *deterministic* derived overall +
  rating band + color/emoji, and dynamic-category capture.
- **Personalization data-model support**: full controlled taxonomy stored per company, plus the
  deterministic per-user weighting/filtering function. (The onboarding survey UI is deferred.)
- The **thin extension client**: detect checkout → strip HTML → call `/analyze` → render badges
  in the existing Shadow-DOM popup.
- The **two-tier test harness** (Tier 1 deterministic + Tier 2 real-LLM eval) and page fixtures.
- Vercel serverless deploy + Postgres.

**Out of scope (later specs — tracked in Linear/BACKLOG.md):**
- `/recommend` + web-search context (Spec 2), Reddit source.
- Personalization onboarding survey UI + profile storage (fast-follow).
- Monetization/affiliate (Spec 3), analytics (Spec 4), cross-browser (Spec 5).
- Deterministic (non-LLM) page parser, model router, streaming, Redis, Tier-3 Playwright e2e,
  dynamic-category approval UI. (All deliberately deferred per the simplification pass.)

## 4. Architecture

### 4.1 Two halves

**Thin extension client** (reuse existing React/Mantine/Shadow-DOM work):
- Content script: detect checkout → capture + strip page HTML (reuse/improve `processHtmlForAI`)
  → `POST /analyze` → render rating badges in the Shadow-DOM popup.
- No secrets, no LLM logic, no business rules. A sensor + a renderer.

**Smart backend** (new clean core, TypeScript, Vercel serverless functions):
- Small modules, each behind an interface, wired together by thin HTTP handlers.

### 4.2 Module boundaries

| Module | Interface | Real implementation (launch) | Test fake |
|---|---|---|---|
| Model calls | `ModelProvider.complete()` | OpenRouter (single provider) | `FakeModelProvider` (scripted) |
| Extraction | `extractCart(markdown, provider)` | generic LLM (cheap model) | uses fake provider |
| Ethics scoring | `scoreCompany(company, provider, store)` | LLM + cache | fakes |
| Recommendation context | `ContextSource.search()` | `WebSearchSource` (on) — *interface only this spec* | `FakeContextSource` |
| Persistence / cache | `Store` (companies, analytics) | `PostgresStore` | `InMemoryStore` |

> Note: the `recommend()` module and a real `WebSearchSource` are designed here but **implemented
> in Spec 2**. This spec only lands the `ContextSource` interface + fake so the seam exists.

### 4.3 Proposed repo structure

```
ethical-shopper/
  core/        # shared TS: domain types, Zod schemas, interfaces, pure logic
               #   (scoring math, per-user weighting, color/emoji). No build step;
               #   imported via TS path alias by both api/ and extension/.
  api/         # Vercel serverless functions (thin handlers): /analyze (+ /recommend later)
  extension/   # the React/Shadow-DOM extension (migrated from frontend/ethical-shopper-extension)
  docs/
```

**Migration note / decision point:** today the repo has `backend/` (Express, to be replaced) and
`frontend/ethical-shopper-extension/` (the UI, to keep). The first implementation step relocates
the UI to `extension/` and rebuilds `backend/` as `api/` functions. If you'd rather minimize
churn, we can keep the existing folder names and only add `core/` — flag your preference in review.

### 4.4 The load-bearing principle

A test constructs a real module (e.g. `scoreCompany`) with a `FakeModelProvider` and
`InMemoryStore`, feeds a known company, and asserts exact behavior — caching, error handling,
malformed-JSON recovery, score math — with **no API cost and no flakiness**. Real providers are
swapped in only for the eval tier.

## 5. Data model

### 5.1 Extraction output

```ts
Cart {
  items: Array<{
    name: string
    brand: string | null
    sellingCompany: string   // the retailer/site
    price: number | null
    url: string | null
    requiredAttributes?: { type?: string; size?: string }  // carried for Spec 2 recs
  }>
  sourceUrl: string
}
```

### 5.2 Ethics model (5-level, per-category, deterministic rollup)

Reuse the existing `EthicalStatus` enum (`Poor` … `Excellent`). The model supplies **per-category**
ratings; the headline rating is **computed**, never model-guessed.

```ts
EthicsReport {
  company: { name: string; domain: string | null; aliases: string[] }
  categories: Array<{
    id: CategoryId        // from a controlled seed taxonomy (see 5.3)
    score: EthicalStatus  // 5-level
    rationale: string     // short, model-provided
    confidence: number    // 0–1, model-provided; low-confidence can be down-weighted
  }>
  overallScore: EthicalStatus   // DETERMINISTIC weighted rollup of category scores
  ratingBand: EthicalStatus     // == overallScore; drives color + emoji (pure function)
  suggestedNewCategory?: { label: string; rationale: string }  // queued for human review, NOT auto-applied
  meta: { modelUsed: string; scoredAt: string; sources: string[]; cacheKey: string }
}
```

- `overallScore`, `ratingBand`, color, and emoji are **pure functions of the category scores** →
  fully Tier-1 testable, explainable ("Concerning because labor=Poor, climate=Concerning").
- Map 5-level → numeric internally (Poor=1 … Excellent=5) for the weighted average, then map back
  to the nearest band.

### 5.3 Controlled taxonomy + dynamic categories

- A **controlled seed taxonomy** of concern categories (e.g. `labor`, `climate`,
  `political_donations`, `animal_welfare`, `data_privacy_surveillance`,
  `governance_anticompetitive`) lives in `core` config with default weights.
- Companies are **always scored across the full taxonomy** (so personalization can re-weight later
  with no re-scoring).
- When the model proposes a dimension outside the taxonomy, it returns `suggestedNewCategory`,
  which is **logged/queued for human review** — it does not change scoring. (Approval UI deferred.)

### 5.4 Personalization (data-model support only this spec)

- Company category scores are **intrinsic and shared** across all users (scored once, cached).
- A user's values are a set of `{ categoryId: weight }`. The displayed overall is the **user's
  weights applied to the company's stored category scores** — a pure, deterministic function with
  **zero extra LLM cost per user**. Default weights apply when no profile exists.
- This spec ships the weighting/filter function + types. The **onboarding survey UI + profile
  storage** are a fast-follow spec.

### 5.5 Schemas

Every model output is validated with a **Zod schema** that is **shared between runtime and tests**,
so the contract and the code cannot drift. Invalid output is caught and handled (see §7).

## 6. Pipeline & data flow

```
[extension] detect checkout → strip HTML → markdown
   │ POST /analyze {markdown, url}
[api] extractCart(markdown)            ← cheap model, cached by content-hash
      → for each distinct company:
        scoreCompany(company)           ← DB-as-cache: hit = no LLM; miss = score + persist
   │ returns { cart, reports[] }  (overall + band computed per default or supplied weights)
[extension] render color + emoji badges in the Shadow-DOM popup
```

- **Staged & cache-first.** Popular retailers are usually a cache hit → zero LLM cost. Only
  genuinely new companies pay for a model call.
- `/recommend` is a **separate** staged endpoint added in Spec 2; the extension calls it only when
  a company is below threshold. Designed now, not built now.
- **No streaming** at launch (simpler to debug); revisit only if function timeouts bite.

## 7. Error handling

- **Malformed model JSON:** Zod validation fails → one bounded repair retry (re-prompt) → if still
  invalid, return a typed "could not assess" result; never throw raw to the client.
- **Cache miss / store error:** scoring proceeds; a store write failure logs + degrades to
  uncached (still returns a result).
- **Partial cart:** companies that fail extraction/scoring are returned with an explicit
  `unassessed` status rather than dropping the whole response.
- **Provider/network failure:** typed error surfaced to the extension, which renders a neutral
  "couldn't check" state (the popup never breaks the host page).

## 8. Caching / persistence

- **DB-as-cache.** One durable Postgres row per company holding its per-category scores + `scoredAt`.
  A configurable staleness window (e.g. N days) triggers re-scoring on read. This *is* the cache —
  **no separate Redis at launch** (`Store` interface allows adding it later with no refactor).
- Extraction results cached by page-content hash (short TTL).
- Tests use `InMemoryStore`; production uses `PostgresStore`. Identical interface.

## 9. LLM provider strategy

- **Single provider via OpenRouter** at launch (one integration, many models; fewer SDKs). The
  `ModelProvider` interface allows adding Gemini-direct/OpenAI-direct later.
- **Extraction model: Gemini 2.5 Flash-Lite** (cheap, fast, structured-JSON output) as the default;
  configurable per step.
- **No router** (cheap→escalate) at launch — a single configured model per step; routing is a
  deferred cost optimization.

## 10. Testing strategy

### Tier 1 — Deterministic (every commit, zero cost, zero flakiness)
- **Pure logic/contract tests:** score rollup math, 5-level↔numeric mapping, color/emoji, per-user
  weighting, cache-key derivation, dedup, malformed-JSON recovery.
- **Pipeline tests with `FakeModelProvider`:** script known/broken model output, assert *system*
  behavior (caching, dedup, "Reddit off", graceful degradation).
- **Schema guards:** valid output → correct domain objects; invalid output → caught + handled.
- **Extension client tests (vitest + jsdom):** detector logic, rendering for a known `/analyze`
  response, paused-state behavior. (Extend the existing tests.)
- **Fixtures:** `fixtures/pages/` of real saved shopping-page HTML; extraction tests run the *real*
  stripping (`processHtmlForAI`) against a *fake* model.

### Tier 2 — Real-LLM eval (manual/scheduled, budget-capped; NOT in the normal CI gate)
- `npm run eval`, split into:
  - **Hard contract (must pass):** real output parses against the Zod schema; scores in range;
    required fields present.
  - **Soft quality (directional, aggregated):** a curated set of known companies must land in
    expected score **bands** (e.g. Patagonia ≥ Good; a known severe bad-actor ≤ Concerning),
    asserted as the **median over N runs** at temperature 0; plus an **LLM-as-judge** for
    qualitative checks with a tunable **warn-vs-fail** threshold.
  - **Cost governor:** tracks token spend, supports `--sample N` + a hard budget ceiling, logs a
    human-readable report.

### Tier 3 — Browser e2e (Playwright / Cloud Cowork)
Deferred to a later spec; designed-for but not built here.

## 11. Hosting / deployment

- **Vercel serverless** for `api/` (scales to zero — matches the cost concern; great DX).
- **Managed Postgres** for cached ethics + (later) analytics.
- All storage behind the `Store` interface; tests never touch real infra.
- **Escape hatch:** if always-on background cache-warming/queues are later needed, add a small
  persistent worker alongside Vercel without rewriting the core.

## 12. Simplifications adopted (and why)

| Cut/deferred | Replaced with at launch |
|---|---|
| Redis/KV hot cache | Postgres row + index |
| Model router | one configured model per step |
| Streaming responses | plain request/response |
| 3 model providers | single OpenRouter integration |
| 10-level scoring | existing 5-level enum |
| `core` as a published package | a `core/` folder via TS path alias |
| Multi-source context now | one `ContextSource` interface + fake (Web/Reddit later) |
| Graph DB for recs | Postgres relations |

## 13. Assumptions & open questions (please confirm in review)

1. **Repo layout:** proposed `core/` + `api/` + `extension/` (relocating the current `backend/` and
   `frontend/ethical-shopper-extension/`). Acceptable, or keep existing folder names + only add `core/`?
2. **OpenRouter** is the single launch provider (uses your existing OpenRouter key); Gemini
   2.5 Flash-Lite as the default extraction model. OK?
3. **Eval cadence:** `npm run eval` is manual + optionally a scheduled (e.g. weekly) run; never in
   the per-commit gate. OK?
4. The **seed taxonomy** in §5.3 is a starting set; final categories/weights to be refined.

## 14. Success criteria

- `extractCart` and `scoreCompany` run end-to-end against a fixture page with a `FakeModelProvider`
  and `InMemoryStore`, fully deterministically, in CI.
- The extension renders a correct color+emoji badge for a known `/analyze` response (Tier-1).
- `npm run eval` produces hard-contract pass/fail + a directional quality report under a budget cap.
- A second company lookup is served from the Postgres cache with no model call.
- Deploys to Vercel; the Chrome extension talks to the deployed `/analyze`.
- A new contributor can open `api/` and see one provider, one store, a few pure functions, and
  fakes — not a framework.
