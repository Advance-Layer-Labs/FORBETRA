# Security & Hygiene Follow-ups

_Status board for items identified by the 2026-05-30 hygiene audit. Last refresh: 2026-05-31._

Comprehensive sequencing lives in `docs/improvement-plan.md`; this doc is the short security/ops checklist.

## Status at a glance

| #   | Item                                            | Status                                                                       |
| --- | ----------------------------------------------- | ---------------------------------------------------------------------------- |
| 1   | Hash stakeholder feedback tokens (3-PR rollout) | 🟡 PR-1 ✅ (PR #8) · PR-2 pending · PR-3 pending                             |
| 2   | `@@unique` on `Insight`                         | ✅ shipped in PR #7 (dedupe check came back clean)                           |
| 3   | Provision Upstash Redis                         | ❌ external — needs Marc                                                     |
| 4   | Sentry DSN                                      | ❌ external — needs Marc                                                     |
| 5   | Neon `directUrl`                                | ❌ external — needs Marc to grab URL from Neon, then 1-line schema PR        |
| 6   | GitHub branch protection on `main`              | ✅ set via API (require PR + 3 CI checks; admins can bypass for emergencies) |
| 7   | `CRON_SECRET` ↔ `JOB_SECRET_TOKEN` in Vercel    | ❌ trivial verification — needs Marc                                         |
| 8   | Deeper `docs/` reorg                            | ⏸ deprioritized — `improvement-plan.md` is now the canonical entry           |

---

## 1. Hash stakeholder feedback tokens — PR-2 + PR-3 still open

**Severity:** High — DB leak exposes every active feedback link.

**Shipped (PR #8, 2026-05-31):**

- New `$lib/server/tokenHash` helper (`sha256(token)` → hex)
- `feedbackToken.ts`: hash before storing on create
- Stakeholder feedback lookup: dual-read (hash first, raw fallback) so pre-PR-1 emailed links still work
- Removed broken `feedbackUrl` exposure in `/admin/preview`

**PR-2 (this PR, when shipped):** one-shot UPDATE that hashes every pre-PR-1 `Token.tokenHash` row in place. Cutoff: rows where `createdAt < '2026-05-31 05:34:33'`. Anything created later was already written hashed.

**PR-3 (after PR-2):** remove the raw-value fallback in `findTokenByUrlValue` / `findTokenByUrlValueSelect`. Single-file diff.

**Sequencing constraint:** don't ship PR-2 + PR-3 together — the raw fallback in PR-1 is what makes PR-2's deploy safe. If a request lands mid-migration on an unhashed row, the fallback catches it.

---

## 3. Upstash Redis

**Severity:** High — `rateLimit.ts` silently falls back to in-memory on Vercel serverless without these env vars. Rate limit is effectively no-op in prod today.

**Steps:**

1. https://console.upstash.com → Sign up
2. Create Redis instance → region `us-east-1` (matches Vercel iad1)
3. Open the database → REST API tab → copy URL + Token
4. Vercel env vars → add both, all environments:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Redeploy

---

## 4. Sentry DSN

**Severity:** High — zero error monitoring in prod today.

**Steps:**

1. https://sentry.io → Sign up (sagalwm@gmail.com)
2. Create Project → SvelteKit → name `forbetra`
3. Copy DSN (looks like `https://abc@o12345.ingest.us.sentry.io/678`)
4. Vercel env vars → add both, all environments:
   - `SENTRY_DSN` (server-side)
   - `VITE_SENTRY_DSN` (client-side, same DSN)
5. Trigger redeploy
6. Ping me — I'll PR the 1-line `tracesSampleRate: 0 → 0.1` bump in `hooks.server.ts` for performance traces

**Optional follow-up:** `sentryVitePlugin` for source-map upload (needs `SENTRY_AUTH_TOKEN` env var).

---

## 5. Neon `directUrl`

**Severity:** Medium — works today (current `DATABASE_URL` uses the `-pooler` subdomain), but Prisma migrations should use a non-pooled connection for transactional DDL.

**Steps:**

1. https://console.neon.tech → Forbetra project → Connection Details
2. Disable "Pooled connection" toggle → copy the **direct** connection string (no `-pooler` in the host)
3. Vercel env vars → add `DIRECT_DATABASE_URL` = direct URL, all environments
4. Ping me — I'll ship a 1-line `schema.prisma` change adding `directUrl = env("DIRECT_DATABASE_URL")`

**Deferred reason:** schema validation runs at build time and would fail if `DIRECT_DATABASE_URL` isn't set when the schema change merges. Env var has to be set in Vercel **first**.

---

## 7. Confirm `CRON_SECRET` in Vercel env

`src/lib/server/cronAuth.ts:isAuthorized` accepts either `process.env.CRON_SECRET` (Vercel's native cron header) or `process.env.JOB_SECRET_TOKEN`. The current cron jobs work, so one of them is set — just confirm which.

**Steps:** Vercel → Settings → Environment Variables → search for `CRON_SECRET` and `JOB_SECRET_TOKEN`. Paste back which exist.

---

## 8. Deeper `docs/` reorg (deprioritized)

`docs/improvement-plan.md` is now the canonical product/tech entry point. The original reorg outline (`active/`, `archive/`, `specs/`) is no longer high-leverage. Revisit only if `docs/` becomes hard to navigate.
