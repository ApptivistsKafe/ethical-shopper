# Spec — Accounts, Free Trial & Anti-Abuse

- **Status:** Design only — not yet built (needs auth-provider + DB decision)
- **Date:** 2026-06-14
- **Decision record:** [ADR 0002](../../adr/0002-accounts-trials-anti-abuse.md),
  [ADR 0001](../../adr/0001-persistence-postgres-now-graph-deferred.md)
- **Slots before:** Spec 3 (monetization) — launch-blocking hardening.

## 1. Goal

Gate LLM-hitting actions behind identity for legitimacy, traceability, abuse
reduction, ToS acceptance, cross-device preference sync, and a marketing channel
— without nuking the install-and-it-works conversion an extension depends on.

## 2. The model

```
install ──onInstalled──▶ POST /register ──▶ server mints token + quota row
   │                                              (anonymous, ~1–3 free analyses)
   ▼
use free trial (token sent as header; quota enforced server-side)
   │  quota exhausted
   ▼
prompt: verify email ──▶ auth provider ──▶ server LINKS token row to account
   │                                          (preferences/history carry over)
   ▼
full use (verified-account identity)
```

## 3. Decisions (from ADR 0002)

- **Auth provider, not roll-your-own** — Supabase Auth / Clerk / Auth.js.
- **Progressive wall**, not hard — trial first, then verified email.
- **Anonymous token = light friction + continuity**, not a real control
  (resettable; acceptable because the trial grants low-value, commerce-gated
  analysis bounded by rate limits + spend cap).
- **Harden the email layer**: block disposable-email domains.
- **IP = soft signal** (flag high token-churn per IP → force signup sooner);
  never a hard block (NAT collateral).
- **No fingerprinting** (bright line — we score companies on surveillance).

## 4. Open decision

- **Neon + Clerk/Auth.js** vs **Supabase** (Postgres + auth bundled). Pick at
  implementation time; Supabase consolidates the stack given accounts are in.

## 5. Work breakdown (for tickets)

1. Provision DB + auth provider (the open decision above).
2. `POST /register` — mint anonymous token + quota row at `onInstalled`.
3. Server-side quota enforcement on `/analyze` + `/recommend`; reframe the
   existing per-install-token tickets (APP-25/26) as this trial tier.
4. Email verification flow in the extension (popup/options auth dance).
5. Token→account linking (carry over preferences/history).
6. Disposable-email-domain blocklist.
7. IP soft-signal anomaly tightening.
8. Migrate `userWeights` from `chrome.storage` to the account (cross-device).

## 6. Explicitly out of scope here

Premium tiers, payment, affiliate attribution (Spec 3); behavioral anomaly
detection beyond the IP soft-signal (later, if abuse materializes).
