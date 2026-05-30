# Security & Hygiene Follow-ups

Items identified by the 2026-05-30 audit that were **not** shipped in PR #5 because they require data migrations in production, external account access, or org-admin permissions. Each item has concrete next steps so the work is ready to pick up.

---

## 1. Hash stakeholder feedback tokens (IDOR risk)

**Severity:** High — DB leak exposes every active feedback link.

**Current state:** `Token.tokenHash` column name implies a hash is stored, but the raw 32-byte hex value is persisted. See `src/routes/individual/dashboard/+page.server.ts` (token creation) and `src/routes/stakeholder/feedback/[token]/+page.server.ts:65` (lookup).

**Safe rollout (3 PRs, ~1 sprint):**

1. **PR-1 (additive, zero risk):** On create, store `createHash('sha256').update(token).digest('hex')`. On lookup, hash the URL token before query. **Also** add a fallback path that tries the raw value if the hashed lookup returns nothing. Existing emails with raw-token URLs continue to work; new tokens are stored hashed.
2. **PR-2 (data migration):** One-shot UPDATE that hashes every existing `Token.tokenHash` row in a transaction. After this runs, all rows are hashed and the fallback path in PR-1 is dead code but harmless.
3. **PR-3 (cleanup):** Remove the raw-value fallback from lookup. Single line.

**Why not in one PR:** during the rolling deploy window of a single-PR fix, in-flight requests against just-deployed instances might find unhashed rows; just-deployed instances looking up old emails would 404. The 3-PR dance avoids any user-visible regression.

---

## 2. `@@unique([userId, cycleId, weekNumber, type])` on `Insight`

**Severity:** Medium — TOCTOU race between cron findFirst and create can produce duplicate insights.

**Blocker:** Migration will fail if any duplicate rows already exist.

**Steps:**

1. Run the dedupe check:
   ```sql
   SELECT "userId", "cycleId", "weekNumber", "type", COUNT(*) c
   FROM "Insight"
   WHERE "weekNumber" IS NOT NULL
   GROUP BY 1, 2, 3, 4
   HAVING COUNT(*) > 1;
   ```
2. If any rows: write a dedupe migration that keeps the most recent and deletes earlier dupes (decide policy with Marc).
3. Then add `@@unique(...)` to schema and let `prisma migrate dev` generate the constraint.

Note that `type` includes nullable `weekNumber` and `cycleId` fields for some Insight kinds (e.g., `COACH_PREP`, `CYCLE_REPORT`). Postgres treats NULLs as distinct in unique constraints — verify the constraint shape matches the actual de-dup intent for each Insight type.

---

## 3. Provision Upstash Redis + set env vars

**Severity:** High — rate limiter is silent no-op on Vercel serverless.

**Steps:**

1. Sign in at upstash.com (or create account).
2. Create a Redis instance, region close to Vercel (iad1).
3. Copy REST URL + REST Token.
4. In Vercel project settings → Environment Variables (production + preview):
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`
5. Redeploy or wait for next push. `rateLimit.ts` auto-uses Upstash when env vars present.

---

## 4. Sentry DSN setup

**Severity:** High — zero error monitoring in prod today.

**Steps:**

1. Create Sentry project for Forbetra (sveltekit platform).
2. Copy DSN. Set in Vercel env:
   - `SENTRY_DSN` (server)
   - `VITE_SENTRY_DSN` (client)
3. `hooks.server.ts` and `hooks.client.ts` already guard init behind `if (dsn)` — Sentry activates on next deploy.
4. **Bonus (separate PR):** add `sentryVitePlugin` to `vite.config.ts` for source map upload. Requires `SENTRY_AUTH_TOKEN` env var.
5. **Bonus:** bump `tracesSampleRate` from 0 → 0.1 for performance traces.

---

## 5. Neon pooled URL + `directUrl`

**Severity:** Medium — works today; will hit connection limits at scale.

**Current state:** `DATABASE_URL` uses `-pooler` subdomain (good!). But `schema.prisma` has no `directUrl`, so Prisma migrations may hit the pool which can fail on transactional DDL.

**Steps:**

1. Add to `schema.prisma`:
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_DATABASE_URL")
   }
   ```
2. In Vercel env, set `DIRECT_DATABASE_URL` to the Neon **direct** connection string (the one without `-pooler` in the subdomain).
3. Migrations use `directUrl`; runtime queries use the pooled `url`.

---

## 6. GitHub branch protection on `main`

**Severity:** Medium — CI is advisory only today.

**Blocker:** needs Advance-Layer-Labs org-admin (Kieran).

**Settings:**

- Branches → `main` → Add rule
- ✅ Require a pull request before merging
- ✅ Require status checks to pass: `Lint & Type Check`, `Tests`, `Build`
- ✅ Require branches to be up to date

---

## 7. Confirm `CRON_SECRET` ↔ `JOB_SECRET_TOKEN` in Vercel env

`createCronJobHandler` in `src/lib/server/cronAuth.ts` accepts either, so this is just a verification check.

**Steps:** Vercel → Environment Variables. Check both exist OR confirm `CRON_SECRET` (set by Vercel cron) matches what your jobs expect.

---

## 8. Deeper `docs/` reorganization

Many cross-doc relative refs exist (CLAUDE.md → expert-panel-\*, DESIGN_SPEC → prototype-v2, etc.). A proper `docs/active/` + `docs/archive/` + `docs/specs/` reorg would need all of these updated atomically. The reorg outline lives in PR #5's description; do as one focused PR when ready.
