# ADR 0001 — Persistence: Postgres now, graph DB deferred (additive hybrid)

- **Status:** Accepted
- **Date:** 2026-06-14

## Context

We need durable storage for the company ethics-report cache (cache miss →
check DB → score + persist) and, over time, for products, user "pick" tracking,
affiliate mappings, and accounts. There's also a long-term vision (out of MVP
scope) of a **graph** of companies/products with reinforcement-weighted
"ethical alternative" edges that powers a standing, compounding recommendation
engine. The question: what data store(s), and how do we avoid a one-way-door
decision that would force a large refactor later?

## Decision

1. **Use managed Postgres (Neon, or Supabase if accounts drive it) as the
   entity + cache store now.** `PostgresStore` is already implemented behind the
   `Store` interface.
2. **Defer the graph database entirely.** Build nothing graph-specific for MVP.
3. When the reinforcement-recommendation feature is real, add a **dedicated
   graph DB as an additive hybrid**: it stores only IDs + edges + weights and
   references entity IDs that already live in Postgres — **no entity-data
   migration required**.
4. **Cheap insurance taken now:** every company and product gets a **stable,
   durable ID**, and entity data is kept **separable** from relationships (don't
   bury links inside entity blobs).

## Rationale

- **Scale isn't the deciding factor.** Tens of thousands to low millions of
  rows with JSON blobs is small for Postgres; the hot path is primary-key
  lookup (sub-ms, scale-independent). JSONB + TOAST handles big blobs; Postgres
  is effectively a document store for this use case.
- **The `Store` interface already makes the DB choice reversible** — swapping or
  adding a store is one new file, not a refactor of pipeline/core/extension.
- **The hybrid (entity store + lean graph storing only IDs/edges) is the
  long-term-clean architecture and is purely additive** — that's the property
  that keeps the door open with zero migration.
- **Shallow traversals.** Our recommendation queries are 1–2 hops; Postgres
  recursive CTEs / Apache AGE handle those, so we may not even need a dedicated
  graph DB until the graph is large and central.
- **Don't bet an unvalidated product on a less-mainstream multi-model DB
  (ArangoDB)** before testing. It's defensible if we want one-system-now, but
  it's premature optimization with weaker ops maturity and Vercel integration.

## Consequences

- Neon's serverless driver/pooler solves the Vercel serverless connection
  problem `PostgresStore` currently works around with `max: 1`.
- If accounts are adopted (see ADR 0002), **Supabase** (Postgres + auth bundled)
  becomes a strong alternative to Neon + a separate auth provider.
- A future "graph store" is a NEW interface, not a replacement for `Store`.

## Alternatives considered

- **ArangoDB / multi-model now** — rejected for MVP (premature, ops risk).
- **DynamoDB** — great pure-KV scale, but worse fit for our varied relational
  needs (products↔companies↔picks↔affiliate) and off-platform from Vercel.
