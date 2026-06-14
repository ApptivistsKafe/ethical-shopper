# ADR 0003 — Content-safety dual gate (shared client + server)

- **Status:** Accepted — **implemented** (`packages/core/src/pageClassifier.ts`)
- **Date:** 2026-06-14

## Context

The extension strips a page and sends it to Gemini to extract cart contents.
This happens *early* — before anything else. So if a user is on an adult site
(e.g. OnlyFans) and a URL trips checkout detection, we'd forward explicit page
content to a professional LLM under our account. That's a liability we must
avoid. Separately, an attacker could POST arbitrary content to `/analyze` to use
it as a free LLM pipe.

## Decision

A **dual heuristic gate**, with the decision logic **shared** between client and
server via `@ethical-shopper/core`:

- **Positive gate (primary):** allow only pages that positively look like a
  branded-product checkout/cart (JSON-LD Product/Offer or `og:type=product`, OR
  price patterns + ≥2 distinct commerce keywords). "Positively confirm commerce"
  naturally rejects everything else, including adult pages.
- **Negative gate (high-precision backstop):** reject known adult domains, the
  RTA self-label / adult rating meta, or ≥2 distinct adult-industry terms.
- **Allowed = positive AND not negative.**

**Two enforcement points:**

1. **Client (primary), in the content script, on the live DOM, BEFORE sending.**
   For the innocent-user-on-an-adult-site case the content never leaves the
   machine — zero exposure. The client reads richer DOM signals (JSON-LD, meta).
2. **Server (backstop), in `/analyze`, on the submitted text+URL.** It cannot
   trust client-asserted metadata (an API-direct attacker controls the payload),
   so it re-derives signals from the content it's about to forward and rejects
   with 422 before any spend.

## Rationale

- Client-side gating is strictly better than server-side moderation for the
  liability case: the content is never received by anyone.
- "Positively identify commerce" is the user's framing and the correct one — the
  positive gate does the real work; the negative gate is defense in depth.
- Shared core logic + per-environment signal extractors (DOM on client,
  text on server) means one decision function, one test suite, two trust models.
- Tuned to minimize **both** false positives (wasted spend + exposure) and false
  negatives (real shoppers blocked), with a real-fixtures test suite.

## Implementation notes

- `pageClassifier.ts` is **self-contained (zero imports)** and exposed via a
  dedicated `./pageClassifier` subpath export so the content script (runs on
  every page) never pulls Zod through the barrel — `content.js` stays ~20 kB.
- The OpenAI Moderation API (free, purpose-built to receive questionable content
  for classification — ToS-permitted) remains an optional future server backstop
  for adversarial slip-through; not needed for the innocent-user case.

## Consequences

- Adult/non-commerce pages: panel silently doesn't appear (no friction), nothing
  sent. Real cart pages pass. Verified against Amazon/Etsy/Shopify fixtures.
- The vocabularies/domain list are intentionally non-exhaustive and easy to
  extend; the positive gate is the safety net behind them.
