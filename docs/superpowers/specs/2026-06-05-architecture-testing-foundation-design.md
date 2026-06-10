# Spec 0 — Architecture & Testing Foundation

**Status:** Draft for final review
**Date:** 2026-06-05
**Supersedes:** the current Express monolith backend + scattered LLM calls

---

## 1. Goal

Establish the testable, debuggable foundation for Ethical Shopper and prove it with the first
real vertical slice (detect → extract → score a company's ethics → render). Every nondeterministic
or external dependency (LLM, web search, database) sits behind an interface with a fake, so the
whole system is unit-testable for **zero cost and zero flakiness**, while real models are exercised
only in a separate, rarely-run eval tier.

This is the foundation that makes every later feature (recommendations, personalization survey,
monetization, analytics, cross-browser, mobile) cheap and safe to build and test.

## 2. Product context

A browser extension (Chrome first, multi-browser via WXT) detects shopping checkout/cart pages,
identifies the companies/brands the user is buying from, and scores those companies on a set of
ethical concerns. A simple color + emoji rating is shown; users can drill into per-concern
sub-scores and a plain-language explanation. Later specs add real-time ethical product
alternatives, a values-personalization survey, affiliate monetization, analytics, and an Expo
mobile app. Ethics judgement at launch is **company/brand level only** (not per-product).

## 3. Scope

**In scope (Spec 0 + the core of Spec 1):**
- Monorepo (pnpm + Turborepo) with a shared `core` package; `api` (Vercel functions) and a WXT
  `extension`.
- The three core interfaces (`ModelProvider`, `ContextSource`, `Store`) + their fakes.
- The **analyze pipeline**: `extractCart` (generic LLM extraction) → `scoreCompany` (5-level
  per-category ethics) with **DB-as-cache**.
- The **ethics data model**: 5-level per-category scores with rationale blurbs, a *deterministic*
  derived overall + rating band + color/emoji, neutral-category exclusion, and dynamic-category
  capture. **Political giving is one default-on, rubric-scored category** (coarse LLM version this
  spec; data enrichment later).
- **Personalization data-model support**: every company scored across the *full* taxonomy with
  per-category blurbs cached; the deterministic per-user weighting/filter + summary-composition
  functions. (The onboarding survey UI is deferred; default weights apply for now.)
- The **thin extension client**: detect checkout → strip HTML → call `/analyze` → render the
  progressive-disclosure rating UI in the Shadow-DOM popup.
- The **two-tier test harness** (Tier 1 deterministic + Tier 2 real-LLM eval) and page fixtures.
- Vercel serverless deploy + Postgres.

**Out of scope (later specs — tracked in Linear/BACKLOG.md):**
- `/recommend` + web-search context (Spec 2), Reddit source.
- Personalization onboarding **survey UI** + profile storage (fast-follow).
- **Political-giving data enrichment**: OpenSecrets/FEC + published progressive scorecards →
  per-candidate progressive scores → company aggregate (fast-follow).
- Monetization/affiliate (Spec 3), analytics (Spec 4), additional browsers beyond the WXT baseline
  + **Expo mobile** (later), web app (later).
- Deterministic (non-LLM) page parser, model router, streaming, Redis, Tier-3 Playwright e2e,
  dynamic-category approval UI.

## 4. Architecture

### 4.1 Two halves

**Thin extension client** (reuse existing React/Shadow-DOM UI, re-homed into **WXT**):
- Content script: detect checkout → capture + strip page HTML (reuse/improve `processHtmlForAI`)
  → `POST /analyze` → render the rating UI in the Shadow-DOM popup.
- No secrets, no LLM logic, no business rules. A sensor + a renderer.

**Smart backend** (new clean core, TypeScript, Vercel serverless functions):
- Small modules behind interfaces, wired by thin HTTP handlers.

### 4.2 Module boundaries

| Module | Interface | Real implementation (launch) | Test fake |
|---|---|---|---|
| Model calls | `ModelProvider.complete()` | OpenRouter (BYOK) | `FakeModelProvider` (scripted) |
| Extraction | `extractCart(markdown, provider)` | generic LLM (Gemini 2.5 Flash-Lite) | uses fake provider |
| Ethics scoring | `scoreCompany(company, provider, store)` | LLM + cache | fakes |
| Recommendation context | `ContextSource.search()` | *interface + fake only this spec* | `FakeContextSource` |
| Persistence / cache | `Store` | `PostgresStore` | `InMemoryStore` |

> `recommend()` and a real `WebSearchSource` are designed here but **implemented in Spec 2**. This
> spec lands only the `ContextSource` interface + fake so the seam exists.

### 4.3 Repo structure (pnpm + Turborepo)

```
ethical-shopper/
  packages/
    core/          # shared TS: domain types, Zod schemas, interfaces, pure logic
                   #   (scoring rollup, per-user weighting, summary composition, color/emoji)
  apps/
    api/           # Vercel serverless functions (thin handlers): /analyze (+ /recommend later)
    extension/     # WXT browser extension (Chrome first; Firefox/Safari/etc. from one codebase)
  turbo.json
  pnpm-workspace.yaml
```

- **Turborepo** (free/OSS) orchestrates build/test/lint with content-hashed incremental builds;
  remote caching is optional and off until builds feel slow.
- **WXT** for the extension: Vite-based, file-based entrypoints (auto-manifest), content-script-UI
  helpers for the Shadow-DOM injection, and one codebase → 7 browsers. Retires the hand-rolled
  webpack config.
- **Mobile/web later:** an Expo app (and an eventual web app) drop in under `apps/` and share
  `core`. Known pnpm/Metro wrinkle for RN (`node-linker=hoisted`) is handled then, not now.
- **Vercel deploy:** only `apps/api` is a Vercel Project (root directory `apps/api`); the extension
  builds in the Turbo pipeline but ships to the browser stores, not Vercel.

**Migration note:** the first implementation step relocates today's `backend/` → `apps/api`
(rebuilt as functions) and `frontend/ethical-shopper-extension/` → `apps/extension` (re-homed into
WXT, reusing the React/Shadow-DOM components).

### 4.4 The load-bearing principle

A test constructs a real module (e.g. `scoreCompany`) with a `FakeModelProvider` and
`InMemoryStore`, feeds a known company, and asserts exact behavior — caching, error handling,
malformed-JSON recovery, rollup math, neutral exclusion — with **no API cost and no flakiness**.
Real providers are swapped in only for the eval tier.

## 5. Data model

### 5.1 Extraction output

```ts
Cart {
  items: Array<{
    name: string
    brand: string | null
    sellingCompany: string
    price: number | null
    url: string | null
    requiredAttributes?: { type?: string; size?: string }  // carried for Spec 2 recs
  }>
  sourceUrl: string
}
```

### 5.2 Ethics model (5-level, per-category, deterministic rollup)

Reuse the existing `EthicalStatus` enum (`Poor` … `Excellent`). The model supplies **per-category**
ratings + a short blurb; the headline rating is **computed**, never model-guessed.

```ts
EthicsReport {
  company: { name: string; domain: string | null; aliases: string[] }
  categories: Array<{
    id: CategoryId
    score: EthicalStatus | null   // null = NEUTRAL / no notable action → excluded from rollup & UI
    blurb: string                 // 1–2 sentence plain-language rationale, model-provided
    confidence: number            // 0–1
    sources?: string[]
  }>
  overallScore: EthicalStatus     // DETERMINISTIC weighted rollup over non-neutral categories
  ratingBand: EthicalStatus       // == overallScore; drives color + emoji (pure function)
  suggestedNewCategory?: { label: string; rationale: string }  // queued for review, NOT auto-applied
  meta: { modelUsed: string; scoredAt: string; cacheKey: string }
}
```

Deliberate choices that pay off:
- **Neutral categories (`score: null`) are excluded** from both the rollup and the UI. Most
  companies are neutral on most concerns absent direct action; excluding them means the overall
  reflects where a company *actually* has impact instead of regressing to a mushy middle.
- `overallScore`, `ratingBand`, color, and emoji are **pure functions of the non-neutral category
  scores + weights** → fully Tier-1 testable and explainable.
- **Per-category weights** are configurable and need *not* be equal (see §5.4 — political giving
  carries a heavier default weight).
- Map 5-level → numeric (Poor=1 … Excellent=5) for the weighted average, then back to the nearest
  band.

### 5.3 Controlled taxonomy + dynamic categories

- A **controlled seed taxonomy** of concern categories lives in `core` config with default weights
  and a rubric definition per category (the rubric text is what makes the LLM score consistently).
  Seed set (starting point, ~6–10): `labor`, `climate`, `political_giving`, `animal_welfare`,
  `data_privacy_surveillance`, `governance_anticompetitive`, `supply_chain`.
- Companies are **always scored across the full taxonomy** (so personalization re-weights with no
  re-scoring). Categories with no notable action come back `score: null` (neutral).
- **Dynamic categories:** when the model flags a relevant dimension outside the taxonomy, it returns
  `suggestedNewCategory`. Users can also submit suggestions in-extension. Both flow into one
  **suggestion log** (`{company, rawLabel, rationale, source: model|user, timestamp}`), normalized
  (lowercased/canonicalized) for a frequency **rollup**. Suggestions never auto-change scoring;
  approval (and the review UI) is deferred. Dedupe starts as normalized-string grouping; embeddings
  are an explicit non-goal for now.

### 5.4 Political giving (launch-coarse → enrichment later)

- This spec: `political_giving` is **one default-on category, scored by the same rubric mechanism**
  as the others — the LLM gathers what it can about a company's political/civic giving and scores
  it against an explicit, principle-anchored rubric (democracy, civil rights, rule of law,
  anti-corruption, scientific integrity), returning a blurb + sources. It carries a **heavier
  default weight**, reflecting that political giving is often a company's largest real lever across
  many issues.
- The rubric is framed around **supporting progressive candidates/causes**, not party labels — the
  judgment is "did this giving advance the stated principles," shown with reasoning + sources.
- **Enrichment (later spec):** replace coarse LLM judgment with hard data — **OpenSecrets/FEC**
  donation records → recipients → a **per-candidate progressive score** composed from published
  scorecards (LCV, ACLU, NAACP, Planned Parenthood, Progressive Punch, etc.) → a **single signed,
  continuous** company score (pro-progressive positive, anti-progressive negative, scaled by
  progressiveness × dollars). This is a constructed, transparent index we own.
- **Stance:** the app holds an owned, principle-anchored point of view here; it is transparent and
  sourced (defensible, not "controversy-free"), and the political dimension is one weighted category
  users can dial down/off — but the app does not ship an inverted (reward-anti-progressive) lens.

### 5.5 Personalization (data-model support this spec)

- Company category scores **and per-category blurbs** are **intrinsic, shared, and cached** (scored
  once across the full taxonomy).
- A user's values = `{ categoryId: weight }`. At display time, pure deterministic functions:
  1. **Re-weight** the non-neutral category scores by the user's weights → personalized
     `overallScore`/band (default weights when no profile).
  2. **Filter** the sub-score list to the non-neutral categories the user cares about.
  3. **Compose** the plain-language explanation by stitching together the cached per-category
     **blurbs** for only those categories.
- **Zero extra LLM cost per user.** The survey UI + profile storage are a fast-follow; this spec
  ships the functions + types + default weights.

### 5.6 Schemas

Every model output is validated with a **Zod schema shared between runtime and tests**, so contract
and code cannot drift. Invalid output is caught and handled (see §9).

## 6. Pipeline & data flow

```
[extension] detect checkout → strip HTML → markdown
   │ POST /analyze {markdown, url, userWeights?}
[api] extractCart(markdown)            ← cheap model, cached by content-hash
      → for each distinct company:
        scoreCompany(company)           ← DB-as-cache: hit = no LLM; miss = score full taxonomy + persist (scores+blurbs)
      → applyUserView(reports, userWeights)   ← pure: re-weight + filter + compose summary
   │ returns { cart, views[] }   (overall band + emoji/color + filtered sub-scores + composed explanation)
[extension] render the progressive-disclosure rating UI
```

- **Staged & cache-first.** Popular retailers are usually a cache hit → zero LLM cost. Only new
  companies pay for a model call, and they pay *once* (full taxonomy), reused for everyone.
- `/recommend` is a separate staged endpoint added in Spec 2 (designed now, not built now).
- **No streaming** at launch.

## 7. Presentation / UX (progressive disclosure)

Hide the complexity; surface it on demand.
- **Top level:** a single ethical score as **color + emoji** (smiley→frowny via the existing
  `EthicalStatus` color map).
- **Expand (dropdown):** per-concern **sub-scores**, showing **only** categories that are (a)
  non-neutral for this company **and** (b) of interest to this user. Neutral/uninterested concerns
  are simply absent.
- **Info icon (?):** opens a **plain-language explanation** of how the scores were reached —
  composed at display time from the cached per-category blurbs for the shown concerns, so it's
  specific to what *this* user cares about.
- All of this is a pure function of the cached `EthicsReport` + the user's weights — no extra
  model calls to expand or explain.

## 8. Determinism & consistency (the "not AI-sloppy" guarantees)

- **Cache is the primary guarantee:** a scored company is reused verbatim until inputs change or it
  goes stale → "same company → same score" by construction.
- **Temperature 0** on scoring for near-deterministic re-scores.
- **Rubric-anchored scoring** with per-category definitions + anchor examples → consistent,
  comparable scores across companies (the eval tier asserts bands *and* relative ordering).
- **Mandatory blurb + confidence** per category; the overall is deterministic, explainable math.

## 9. Error handling

- **Malformed model JSON:** Zod fails → one bounded repair retry → else a typed "could not assess"
  result; never throw raw to the client.
- **Cache/store error:** scoring proceeds; a write failure logs + degrades to uncached.
- **Partial cart:** companies that fail are returned `unassessed`, not dropped.
- **Provider/network failure:** typed error → the extension renders a neutral "couldn't check"
  state; the popup never breaks the host page.

## 10. Caching / persistence

- **DB-as-cache.** One durable Postgres row per company holding per-category scores **+ blurbs** +
  `scoredAt`; a configurable staleness window triggers re-scoring on read. This *is* the cache —
  **no Redis at launch** (`Store` allows adding it later with no refactor).
- Extraction results cached by page-content hash (short TTL).
- Tests use `InMemoryStore`; production `PostgresStore`. Identical interface.

## 11. LLM provider strategy

- **`ModelProvider` interface always** (the testing seam — non-negotiable, independent of vendor).
- **OpenRouter with BYOK** as the launch implementation: one integration for any model, fallbacks,
  and **~$0 fee under 1M req/mo** with pass-through pricing — ideal for the prompt-tuning phase.
- **Extraction model: Gemini 2.5 Flash-Lite** (cheap, fast, structured JSON); configurable per step.
- **Prompt caching passes through** OpenRouter (provider discounts + sticky routing), but our
  dominant cost lever is the **DB cache** (a known company isn't called at all).
- **No router** (cheap→escalate) at launch — one configured model per step.
- Swapping to direct providers or an open-weight model (for cheapest-provider routing) later is a
  one-line change behind the interface.

## 12. Testing strategy

### Tier 1 — Deterministic (every commit, zero cost, zero flakiness)
- **Pure logic/contract tests:** rollup math, 5-level↔numeric, neutral exclusion, per-user
  weighting, summary composition, color/emoji, cache-key derivation, dedup, malformed-JSON recovery.
- **Pipeline tests with `FakeModelProvider`:** scripted known/broken output → assert *system*
  behavior (caching, full-taxonomy scoring, graceful degradation, user-view filtering).
- **Schema guards:** valid output → correct domain objects; invalid → caught + handled.
- **Extension client tests (vitest + jsdom):** detector logic, rendering for a known `/analyze`
  response, expand/info interactions, paused-state.
- **Fixtures:** `fixtures/pages/` of real saved shopping-page HTML; extraction tests run the *real*
  stripping against a *fake* model.

### Tier 2 — Real-LLM eval (manual / scheduled, budget-capped; NOT in the CI gate)
- `npm run eval`, split into:
  - **Hard contract (must pass):** real output parses against Zod; scores in range; required fields.
  - **Soft quality (directional, aggregated):** curated known companies land in expected **bands**
    (e.g. Patagonia ≥ Good; a known severe bad-actor ≤ Concerning) as the **median over N runs** at
    temp 0; plus relative-ordering checks; plus an **LLM-as-judge** for blurb quality with a tunable
    **warn-vs-fail** threshold.
  - **Cost governor:** token-spend tracking, `--sample N`, hard budget ceiling, human-readable
    report.

### Tier 3 — Browser e2e (Playwright / Cloud Cowork)
Designed-for, deferred to a later spec.

## 13. Hosting / deployment

- **Vercel serverless** for `apps/api` (scales to zero — matches the cost concern; turnkey
  Turborepo deploy). **Managed Postgres** for cached ethics + (later) analytics.
- All storage behind `Store`; tests never touch real infra.
- **Escape hatch:** if always-on cache-warming/queues are later needed, add a small persistent
  worker alongside Vercel without rewriting the core.

## 14. Simplifications adopted

| Cut/deferred | Launch choice |
|---|---|
| Redis/KV hot cache | Postgres row + index |
| Model router | one configured model per step |
| Streaming responses | plain request/response |
| 3 model providers | single OpenRouter (BYOK) integration |
| 10-level scoring | existing 5-level enum |
| Political per-candidate data pipeline | coarse LLM rubric category (OpenSecrets enrichment later) |
| Personalization survey UI | default weights + the deterministic weighting/compose functions |
| Hand-rolled extension webpack | WXT |
| Graph DB for recs | Postgres relations |

## 15. Decisions & remaining notes

- **Repo:** pnpm + Turborepo; `packages/core`, `apps/api`, `apps/extension` (WXT); Expo/web later.
- **Provider:** OpenRouter BYOK + Gemini 2.5 Flash-Lite.
- **Eval cadence:** `npm run eval` manual + optional weekly schedule; never per-commit.
- **Seed taxonomy/weights** in §5.3 are a living starting point to refine (incl. the heavier
  `political_giving` default weight).

## 16. Success criteria

- `extractCart` + `scoreCompany` run end-to-end against a fixture page with `FakeModelProvider` +
  `InMemoryStore`, fully deterministically, in CI.
- The extension renders a correct color+emoji top score for a known `/analyze` response, expands to
  the right filtered sub-scores, and shows a composed explanation — all Tier-1.
- A second lookup of the same company is served from Postgres with no model call.
- Re-weighting a report for two different user-weight sets changes the overall + sub-score list
  deterministically, with no model call.
- `npm run eval` produces hard-contract pass/fail + a directional quality report under a budget cap.
- Deploys to Vercel; the WXT Chrome build talks to the deployed `/analyze`.
- A new contributor opens `apps/api` and sees one provider, one store, a few pure functions, and
  fakes — not a framework.

## 17. Addendum — decisions adopted during implementation (2026-06-10)

These supersede the corresponding rows in §14 and reflect what is actually built.

1. **Neutral-as-midpoint rollup.** Neutral (`null`) categories are INCLUDED in the weighted
   rollup at `NEUTRAL_ROLLUP_VALUE = 3` (the Mixed midpoint) but EXCLUDED from the UI. This
   prevents a company with one bad category (rest neutral) from rating worse than a company
   that is broadly mediocre across all categories. Verified by the "breadth test" in
   `packages/core/tests/scoring.test.ts`.

2. **Suggestion dedup is asymmetric.** Model-suggested categories are deduplicated by
   `normalizedLabel` (with a frequency count); user-submitted suggestions are ALL retained —
   submission frequency is the prioritization signal for taxonomy review. Users submit via the
   panel footer → `POST /api/suggest`.

3. **Two-model pipeline.** Extraction uses a cheap fast model (default
   `google/gemini-2.5-flash-lite`, 12s timeout); scoring uses a stronger model (default
   `anthropic/claude-sonnet-4-5`, 30s timeout) optionally enriched with Brave web search.
   Both configurable via `EXTRACTION_MODEL` / `SCORING_MODEL` env vars; both retry once on
   timeout/5xx, never on 4xx.

4. **Streaming /analyze (reverses the §14 deferral).** The endpoint streams NDJSON events
   (`cart` → N×`companyView` → `done`, with per-company `error` events) via Vercel response
   streaming (`supportsResponseStreaming: true`). The extension consumes the stream with a
   chunk-safe async generator and renders company cards as they resolve.

5. **Brands are scored, not just sellers.** `companiesToScore` scores unique sellers AND unique
   brands (capped at 8 companies/request, sellers first) — on a marketplace cart the brands
   are the signal, the marketplace is one row.

6. **Security hardening (new).**
   - All untrusted text (page markdown, search snippets) passes through
     `sanitizeUntrustedText` (invisible/bidi Unicode stripping, control chars, data-URIs,
     token/line/length caps, repeated-line dedup) and is wrapped in untrusted-data delimiters;
     system prompts carry explicit injection-hardening instructions.
   - User weights are Zod-validated at the API boundary AND clamped in core
     (`clampUserWeight`, range [0, 10]) — negative weights cannot invert category polarity.
   - `/analyze` and `/suggest` require a shared `X-ES-Token` when `EXTENSION_API_TOKEN` is set,
     plus best-effort per-IP rate limiting per warm instance (layer Vercel WAF on top).
   - Same-company concurrent scoring is single-flighted per instance; model output parsing is
     fence/prose tolerant (`extractJsonObject`).

7. **Personalization shipped early (reverses the §14 deferral).** The extension options page
   maps five preference levels (opt-out / 0.5 / default / 2 / 4) to `UserWeights` stored in
   `chrome.storage.sync`; the content script sends them with each `/analyze` request.
