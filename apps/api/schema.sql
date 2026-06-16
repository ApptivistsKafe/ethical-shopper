-- Ethical Shopper — Postgres schema
-- Run once against your database to set up the required tables.
-- Compatible with Neon (serverless Postgres) and standard PostgreSQL >=14.

-- ─── Ethics Reports Cache ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS ethics_reports (
  cache_key   TEXT        PRIMARY KEY,
  data        JSONB       NOT NULL,
  scored_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  ethics_reports IS 'Cached company ethics scores. Keyed by company:domain or company:slug.';
COMMENT ON COLUMN ethics_reports.cache_key IS 'e.g. company:amazon.com or company:whole-foods';
COMMENT ON COLUMN ethics_reports.data      IS 'Full EthicsReport JSON blob.';
COMMENT ON COLUMN ethics_reports.scored_at IS 'When the score was last computed. Drives the 7-day staleness window.';

-- ─── Category Suggestions ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS category_suggestions (
  id               SERIAL      PRIMARY KEY,
  normalized_label TEXT        NOT NULL,
  raw_label        TEXT        NOT NULL,
  rationale        TEXT        NOT NULL,
  source           TEXT        NOT NULL CHECK (source IN ('model', 'user')),
  company          TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  category_suggestions IS 'Suggested new ethical concern categories surfaced by the model or submitted by users.';
COMMENT ON COLUMN category_suggestions.normalized_label IS 'Lowercase, trimmed label used for model-suggestion deduplication.';
COMMENT ON COLUMN category_suggestions.source           IS '"model" suggestions are deduped by normalizedLabel; "user" suggestions are all retained (frequency = priority signal).';

CREATE INDEX IF NOT EXISTS idx_category_suggestions_label_source
  ON category_suggestions (normalized_label, source);

CREATE INDEX IF NOT EXISTS idx_category_suggestions_source_created
  ON category_suggestions (source, created_at DESC);

-- ─── Row Level Security ──────────────────────────────────────────────────────
-- Supabase auto-exposes a public PostgREST API over these tables via the anon
-- key. Enable RLS with NO policies so that public/anon access is denied by
-- default. Our backend connects via the pooled connection string as the
-- `postgres` role, which BYPASSES RLS (table owners bypass it) — so the API
-- keeps full access while the public endpoint is locked down.
--
-- IMPORTANT: ENABLE, not FORCE. FORCE would subject the owner role to RLS too
-- and break the backend's bypass. When accounts land (APP-28) and the extension
-- may hit Supabase directly with user JWTs (the `authenticated` role does NOT
-- bypass RLS), add explicit per-user policies at that point.
--
-- No-op on non-Supabase Postgres (Neon etc.) — harmless to run anywhere.

ALTER TABLE ethics_reports        ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_suggestions  ENABLE ROW LEVEL SECURITY;
