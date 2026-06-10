# Ethical Shopper

A browser extension that shows you the ethics of the companies in your cart — before you check out.

When you reach a checkout or cart page, the extension extracts what you're buying, scores the
sellers **and** the brands across seven ethical dimensions (labor, climate, political & civic
giving, animal welfare, data privacy, governance, supply chain), and renders a compact
color + emoji panel with progressive disclosure: overall score → notable categories → cited
rationale.

## Monorepo layout

```
packages/core/     Shared domain layer — types, taxonomy, pure scoring functions,
                   Zod schemas, provider/store interfaces, test fakes. Zero I/O.
apps/api/          Vercel serverless functions — streaming /api/analyze (NDJSON),
                   /api/suggest, OpenRouter + Brave Search + Postgres providers.
apps/extension/    WXT browser extension — checkout detection, Shadow-DOM panel,
                   options page for per-category preferences.
frontend/ backend/ Legacy pre-monorepo code; kept until the new apps reach parity.
```

## Getting started

Requires Node ≥ 22 and pnpm ≥ 11.

```sh
pnpm install
pnpm build          # turbo: builds core, typechecks api, bundles extension
pnpm test           # deterministic Tier-1 tests — no API keys, no network, no cost
pnpm typecheck
pnpm lint
```

### Running the API locally

```sh
cd apps/api
cp .env.example .env   # fill in OPENROUTER_API_KEY (and optionally POSTGRES_URL, BRAVE_API_KEY)
pnpm dev               # vercel dev
```

Without `POSTGRES_URL` the API uses an in-memory cache (fine for dev). The Postgres schema is
in [apps/api/schema.sql](apps/api/schema.sql).

### Building the extension

```sh
cd apps/extension
API_BASE_URL=http://localhost:3000 pnpm build   # or your deployed URL
# Load .output/chrome-mv3/ as an unpacked extension in Chrome
```

## Testing philosophy

Two tiers:

- **Tier 1 (every commit, CI):** deterministic tests against `FakeModelProvider` /
  `InMemoryStore` / `FakeContextSource`. Zero cost, zero network, zero flakiness.
- **Tier 2 (manual / scheduled):** `pnpm eval` scores real companies with the real model and
  asserts directional bands (Patagonia lands Good+, Nestlé lands Mixed−). Budget-capped,
  requires `OPENROUTER_API_KEY`.

## Design docs

The architecture and all major decisions are documented in
[docs/superpowers/specs/](docs/superpowers/specs/).
