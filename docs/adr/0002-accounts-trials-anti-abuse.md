# ADR 0002 — Accounts, free trial, and anti-abuse model

- **Status:** Accepted (design); implementation deferred to its own spec
- **Date:** 2026-06-14

## Context

`/analyze` and `/recommend` hit paid LLMs under our account. The shared
`X-ES-Token` baked into the extension only grants "permission to call our own
backend" (it is **not** an LLM key — those live server-side only), but it's
extractable, so the realistic threat is *someone scripting our endpoint for
free LLM-ish usage*. We also want legitimacy, traceability, a marketing channel,
ToS acceptance, and cross-device preference sync.

## Decision

1. **Adopt email-verified accounts**, via an **auth provider** (Supabase Auth /
   Clerk / Auth.js) — never roll our own auth.
2. **Progressive wall, not a hard one.** Anonymous installs get a small,
   tightly-capped free trial (≈1–3 analyses) so users feel the value first;
   continuing / saving preferences requires a verified account.
3. **Install token bridges anonymous → authenticated.** Server issues a token at
   `chrome.runtime.onInstalled` (`POST /register`), stores it with a quota row,
   and **links it to the account on verification** — preferences/history carry
   over.
4. **Treat the anonymous token as light friction, not a real control.** It's
   resettable (clear storage / incognito); that's acceptable because what it
   grants is low-value (narrow, commerce-gated cart analysis) and is bounded by
   rate limits + the OpenRouter spend cap.
5. **Harden the email layer instead:** block known **disposable-email domains**.
6. **IP is a soft signal, never a hard block** (carrier-grade NAT / shared IPs
   cause collateral damage). Use high token-churn per IP to tighten/force signup
   sooner, not to ban.
7. **Do NOT fingerprint users.** It's defeatable, an arms race, and — for a
   product that scores companies on data-privacy/surveillance — hypocritical.
   This is a bright line.

## Rationale

- Email verification is the **strongest** anti-abuse lever (raises the cost of
  creating identities) and subsumes per-install tokens (APP-25/26 become the
  anonymous-trial tier under this model).
- The progressive wall preserves conversion (extensions are expected to "just
  work") while still capturing legitimacy/traceability/marketing.
- The best deterrent is structural: once abuse means farming verified emails
  past disposable-domain blocks, solving rate limits, and hitting a spend cap,
  our endpoint is a worse deal than the free LLM tiers available elsewhere.

## Consequences

- Adds a `users` relational layer → reinforces Postgres (ADR 0001), and makes
  **Supabase** attractive (Postgres + auth in one).
- Extension auth is slightly more involved than web auth (OAuth/token dance in
  popup/options, token in `chrome.storage`) — well-trodden with Clerk/Supabase.
- Accounts are their own body of work → tracked in a dedicated spec, not Specs 0–2.

## Open decision for the user

- **Neon + Clerk/Auth.js** (best-of-breed per layer) vs **Supabase** (Postgres +
  auth bundled). Driven by this ADR; pick at implementation time.
