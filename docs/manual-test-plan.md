# Manual Test Plan — Specs 0–2

Walks every user-facing path through the extension UX, plus the few things only
reachable by hitting the API directly. Check items off as you go; anything that
fails, note the page URL and what you saw.

---

## 0. Setup (one time)

**Start the API locally** (no Vercel needed):

```sh
cd ~/dev/ethical-shopper
pnpm --filter @ethical-shopper/api dev:local
```

The startup banner shows env status. You want `OPENROUTER_API_KEY ✓` and
`BRAVE_API_KEY ✓`. `POSTGRES_URL ✗ (in-memory cache)` is fine for manual testing —
the cache just resets when the server restarts.

> **⚠ OpenRouter credits:** the account currently can't afford Claude Sonnet.
> Either add credits at openrouter.ai/settings/credits (recommended — scoring
> quality is what you're evaluating), or run the server with the cheap model:
> `SCORING_MODEL=google/gemini-2.5-flash-lite pnpm --filter @ethical-shopper/api dev:local`

**Build and load the extension:**

```sh
cd apps/extension
API_BASE_URL=http://localhost:3000 pnpm build
```

Chrome → `chrome://extensions` → enable Developer mode → "Load unpacked" →
select `apps/extension/.output/chrome-mv3/`.

After any rebuild: hit the ↻ refresh icon on the extension card, then reload the test page.

---

## 1. Checkout detection (content script triggering)

The panel should appear ~half a second after page load, top-right, **only** on cart/checkout pages.

| # | Page | Expect |
|---|---|---|
| 1.1 | `amazon.com/gp/cart/view.html` (with items in cart) | Panel appears |
| 1.2 | An Amazon **product** page (`/dp/...`) | No panel |
| 1.3 | `amazon.com` homepage | No panel |
| 1.4 | `etsy.com/cart` | Panel appears |
| 1.5 | `nike.com/cart` | Panel appears |
| 1.6 | `apple.com/shop/bag` | Panel appears |
| 1.7 | Any small store's `/cart` or `/checkout` page (generic keyword fallback) | Panel appears |
| 1.8 | A page with "cart" inside a word, e.g. a page about carto**graphy** | No panel |
| 1.9 | **SPA navigation**: from an Amazon product page, click through to the cart *without a full page reload* | Panel appears after navigation |
| 1.10 | SPA navigation **away** from the cart (cart → continue shopping) | Panel disappears |

## 2. The analyze flow (panel core UX)

On a real cart page with 2+ items from different brands:

| # | Step | Expect |
|---|---|---|
| 2.1 | Panel appears | Header "🛒 Ethical Shopper" + "Scanning your cart…" |
| 2.2 | Within a few seconds | "Scoring companies…" appears, then company cards **stream in one at a time** (not all at once — that's the streaming working) |
| 2.3 | Company coverage | You get a card for the **marketplace/seller** (e.g. Amazon) AND for each **brand** in the cart (e.g. Sony, Nike) |
| 2.4 | Each card collapsed | Emoji + company name + colored score badge (Excellent→Poor) + colored left border |
| 2.5 | Click a card | Expands to per-category rows — **only non-neutral categories** show (a company with no notable record shows "No notable concerns or highlights found.") |
| 2.6 | Click the ℹ on a category row | 1–2 sentence factual blurb appears; click again hides it |
| 2.7 | Bottom of expanded card | Composed plain-language explanation (joined from the visible blurbs) |
| 2.8 | ✕ button | Panel disappears and stays gone (no re-inject on the same page) |
| 2.9 | Sanity-check scores | Amazon should land Mixed/Concerning territory; a known-ethical brand (Patagonia) should land Good+. Same company on a different cart page → **same score** (cache) |
| 2.10 | Reload the same cart page | Much faster second run (companies come from cache) |

## 3. Ethical alternatives (Spec 2)

After the company cards finish (the "Your items" section appears at the bottom):

| # | Step | Expect |
|---|---|---|
| 3.1 | Items list | One row per cart item, with price, each with an "Alternatives" pill button |
| 3.2 | Click "Alternatives" on one item | Button → "Searching…" → up to 3 alternative cards in ~5–15s |
| 3.3 | Alternative card contents | Product name (link if URL known), brand, ~price, **ethics badge for the alternative's brand** (emoji + band), one-sentence factual reason |
| 3.4 | Reality check | The alternatives are real products/brands (spot-check one in a new tab); none are from the brand you're already buying |
| 3.5 | Attribute fidelity | For a sized item (shoes), alternatives are the same type of product |
| 3.6 | Niche/unique item (e.g. a personalized Etsy item) | "No clearly better alternative found" is an acceptable, rendered outcome |
| 3.7 | Click the same button flow on a second item recommending a popular brand twice | Second one is faster (brand score cache hit) |

## 4. Personalization (options page)

| # | Step | Expect |
|---|---|---|
| 4.1 | Click the toolbar icon → "Preferences" link | Options page opens: all 7 categories, dropdowns (Don't show / Matters less / Default / Matters more / Top priority) |
| 4.2 | Political & Civic Giving row | Has the "Weighted more heavily by default" note |
| 4.3 | Set Political Giving → "Don't show", Save | "✓ Saved" appears |
| 4.4 | Reload a cart page with a politically-flagged company (e.g. Amazon) | Political giving row is **gone** from expanded cards; overall score recalculated without it |
| 4.5 | Set a category the cart's companies score badly on to "Top priority", Save, reload | Overall band shifts down for those companies |
| 4.6 | Back to Default on everything, Save, reload | Original scores return |
| 4.7 | Close and reopen the options page | Saved selections persisted |

## 5. Pause toggle

| # | Step | Expect |
|---|---|---|
| 5.1 | Toolbar popup → toggle "Pause extension" ON while a cart page shows the panel | Panel disappears **live** (no reload needed) |
| 5.2 | Reload the cart page while paused | No panel |
| 5.3 | Toggle pause OFF (popup) | Panel re-appears on the open cart page within a second |
| 5.4 | Popup status line | "✓ Active on this page" on a cart page (unpaused); "— Not a checkout page" elsewhere |

## 6. Suggest-a-concern

| # | Step | Expect |
|---|---|---|
| 6.1 | After results: "Suggest a concern we should cover" link at panel bottom | Expands to input + Send |
| 6.2 | Submit e.g. "Misinformation" | "✓ Thanks — your suggestion was recorded." |
| 6.3 | Stop the dev server, try submitting | "Could not send — try again later." (no crash) |

## 7. Failure modes (resilience)

| # | Step | Expect |
|---|---|---|
| 7.1 | Stop the dev server, reload a cart page | Panel appears, then a red ⚠ error banner (e.g. "Network error…") — no infinite spinner, no console explosion |
| 7.2 | Restart server, reload | Recovers normally |
| 7.3 | Run server WITHOUT `BRAVE_API_KEY` (comment it out of .env) | Everything still works — scores just lack fresh web context |
| 7.4 | A cart page where extraction finds nothing (e.g. an empty cart) | "No companies identified in this cart." — not an error |
| 7.5 | While cards are still streaming, hit ✕ | Clean dismiss, no late-arriving ghost UI |

## 8. API-level checks (curl — things the UX can't reach)

With the dev server running:

```sh
# 8.1 Validation: negative weight must be REJECTED (polarity-inversion guard)
curl -s -X POST localhost:3000/api/analyze -H 'Content-Type: application/json' \
  -d '{"markdown":"x","url":"u","userWeights":{"political_giving":-5}}'
# expect: {"error":"Invalid request",...}

# 8.2 Missing fields → 400 with details
curl -s -X POST localhost:3000/api/analyze -H 'Content-Type: application/json' -d '{}'

# 8.3 Auth: restart server with EXTENSION_API_TOKEN=secret123, then:
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/analyze \
  -H 'Content-Type: application/json' -d '{"markdown":"x","url":"u"}'        # expect 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST localhost:3000/api/analyze \
  -H 'Content-Type: application/json' -H 'X-ES-Token: secret123' -d '{"markdown":"x","url":"u"}'  # expect 200

# 8.4 Rate limit: 11 rapid requests → the 11th returns 429
for i in $(seq 1 11); do curl -s -o /dev/null -w '%{http_code} ' -X POST \
  localhost:3000/api/analyze -H 'Content-Type: application/json' -d '{"markdown":"x","url":"u"}'; done; echo

# 8.5 Wrong method → 405
curl -s -o /dev/null -w '%{http_code}\n' localhost:3000/api/analyze
```

## 9. Tier-2 eval (scoring quality)

```sh
cd apps/api
pnpm eval                      # full fixture set, real model
EVAL_MAX_COMPANIES=2 pnpm eval # budget-capped variant
```

Expect every fixture "in band" (Patagonia Good+, Nestlé/Amazon Mixed or worse).
Run this with Claude Sonnet once credits are added — the cheap-model pass is
plumbing validation, the Claude pass is the real quality bar.

## 10. Cross-cutting eyeballs

- **Style isolation**: the panel looks identical on visually-busy sites (Amazon) and minimal ones — Shadow DOM means host CSS must never bleed in.
- **Z-order**: panel sits above site modals/dropdowns.
- **Performance feel**: ordinary (non-cart) pages show no extension jank — the heavy bundle only loads on cart pages.
- **Console hygiene**: open DevTools on a cart page; no uncaught errors from the extension (warnings about missing optional env are OK server-side).

---

## Known gaps while testing (don't file these as new bugs)

- No Vercel deploy yet — everything runs against `localhost:3000`; in-memory cache resets on server restart.
- Claude Sonnet scoring blocked until OpenRouter credits are added (cheap-model fallback works).
- Extraction is **not** cached by content-hash yet (every page load pays one cheap extraction call; scoring is cached).
- Onboarding **survey** UX doesn't exist (APP-11) — weights are set via the options page only.
- Placeholder icons (green squares) pending real branding.
