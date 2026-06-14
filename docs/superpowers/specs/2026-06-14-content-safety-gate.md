# Spec — Content Safety & Page Classification

- **Status:** Largely implemented (core gate + client + server enforcement shipped)
- **Date:** 2026-06-14
- **Decision record:** [ADR 0003](../../adr/0003-content-safety-dual-gate.md)
- **Slots before:** Spec 3 (monetization) — this is launch-blocking hardening.

## 1. Goal

Never forward non-commerce or adult page content to an LLM. Protect against:

- **Accidental exposure** — an innocent user on an adult site (OnlyFans, etc.)
  whose URL trips checkout detection. (Primary concern.)
- **Deliberate abuse** — an attacker POSTing arbitrary content to `/analyze` to
  use it as a free LLM pipe.

Tuned to minimize **both** false positives (wasted spend + exposure) and false
negatives (real shoppers blocked).

## 2. Design (the dual gate)

- **Positive gate (primary):** allow only pages that positively look like a
  branded-product checkout/cart. Signals: JSON-LD `Product`/`Offer`,
  `og:type=product`, price patterns, ≥2 distinct commerce keywords.
- **Negative gate (backstop):** reject known adult domains, RTA self-label /
  adult rating meta, or ≥2 distinct adult-industry terms.
- **Allowed = isCommerce AND NOT isAdult.**

Two enforcement points, one shared decision function:

| Where | Input | Trust | File |
|---|---|---|---|
| Client (primary) | live DOM | richer (JSON-LD, meta) | `apps/extension/src/services/pageGate.ts` |
| Server (backstop) | submitted text + URL | only what it can re-derive | `apps/api/api/analyze.ts` (via `classifyText`) |
| Shared logic | `PageSignals` | — | `packages/core/src/pageClassifier.ts` |

The client gate runs **before anything leaves the machine** → zero exposure for
the accidental case. The server gate cannot trust client-asserted metadata, so it
re-derives signals from the content it's about to forward.

## 3. Status / done

- ✅ `pageClassifier.ts` — decision logic, vocabularies, `extractTextSignals`,
  `classifyText`. Self-contained; exposed via `./pageClassifier` subpath so the
  content script never bundles Zod (`content.js` ≈ 20 kB).
- ✅ Client `extractDomSignals` + gate wired into the content script.
- ✅ Server 422 backstop in `/analyze`.
- ✅ Tests: 26 core (real Amazon/Etsy/Shopify allow; news/SaaS/adult reject;
  adult double-caught) + 9 extension DOM-gate.

## 4. Future / tunable

- Vocabularies + adult-domain list are non-exhaustive by design; extend as real
  traffic reveals gaps. The positive gate is the safety net behind them.
- **OpenAI Moderation API** (free, ToS-permitted to receive content for
  classification) as an optional server backstop for adversarial slip-through.
- Tune thresholds (`MIN_COMMERCE_KEYWORDS`, `MIN_ADULT_KEYWORDS`) against
  measured false-positive/negative rates once there's real traffic.
- Decide policy on legit **adult-product retailers** (genuine commerce vs.
  caution) — currently they pass the positive gate if not on the domain list.
