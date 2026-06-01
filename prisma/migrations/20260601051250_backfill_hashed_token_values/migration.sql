-- PR-2 of 3 in the stakeholder-feedback-token hashing rollout.
--
-- Backfills every Token row created before PR-1 went live, converting the
-- raw 32-byte hex value stored in tokenHash into sha256(value) hex. After
-- this migration runs successfully, the raw-value fallback path in
-- src/routes/stakeholder/feedback/[token]/+page.server.ts becomes dead
-- code (it's removed in PR-3).
--
-- Cutoff: PR-1 merged at 2026-05-31 05:34:33 UTC (commit 85bf30b on main).
-- Any Token created strictly before that timestamp was written with the
-- raw URL value; everything created at or after that timestamp was already
-- written hashed by feedbackToken.ts:hashToken(). The fallback path in
-- PR-1 continues to handle any tokens created in the ~60s Vercel deploy
-- window where the merge was committed but the new code wasn't yet live —
-- those rows stay raw after this migration and the fallback covers them
-- until PR-3 ships.
--
-- Idempotency: Prisma's migrations table guarantees this runs exactly
-- once. The SQL itself is NOT safe to re-run manually — a second pass
-- would double-hash the same rows (which would orphan all post-PR-1
-- emailed links, since their URL value hashes once, not twice).
--
-- Performance: Token table is small in prod (single-digit thousands of
-- rows expected). UPDATE acquires row-level locks; expected completion
-- well under one second.
--
-- Suggested merge window: low-traffic period. The deploy is non-blocking
-- (no lock escalation) but a failure mid-migration would leave a mixed
-- state that the fallback handles correctly anyway.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

UPDATE "Token"
SET "tokenHash" = encode(digest("tokenHash", 'sha256'), 'hex')
WHERE "createdAt" < '2026-05-31 05:34:33'::timestamptz;
