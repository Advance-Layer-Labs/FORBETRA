# Forbetra — Comprehensive Cleanup & Improvement Plan

_Built 2026-05-30. Synthesizes the UX flow analysis (`docs/ux-flow/architecture.md`), the hygiene audit (`docs/security-hygiene-followups.md`), and code-quality observations from a full-route walkthrough. Prioritized for **pre-scale real-world testing** posture._

This plan is **organized for sequencing**, not severity alone. The Tier 0 items genuinely block "let real users hit it"; Tier 1 items compound as user count grows; Tier 2 is hygiene; Tier 3 is the strategic backlog.

---

## TL;DR

| Tier | What                   | Why                                          | Effort (your time) |
| ---- | ---------------------- | -------------------------------------------- | ------------------ |
| 0    | 5 pre-scale blockers   | Without these, first real user surfaces risk | ~3 hours total     |
| 1    | 7 UX retention wins    | First-cycle empty states + onboarding lift   | ~2–3 days dev      |
| 2    | 8 hygiene + IA cleanup | Tech debt that compounds                     | ~1 week dev        |
| 3    | 6 strategic upgrades   | Next-phase backlog (post-feedback)           | open-ended         |

**Recommended sequencing:** Tier 0 → Tier 1 retention wins (most leverage on actual user behavior) → Tier 2 in parallel as small PRs → Tier 3 only after first 20–50 real users in production.

---

## Tier 0 — Pre-scale blockers (do before real users)

Five items. Most are env-var or external-account setup, not code. Total time: ~3 hours of your time if you have the credentials ready.

### 0.1 Sentry DSN

**Status:** `hooks.server.ts` + `hooks.client.ts` already guard Sentry behind `if (dsn)`. Code is ready. Just need the DSN.

**Why now:** zero error monitoring in production. The moment a real user hits a bug you can't debug, you have no telemetry. This is the single highest-leverage observability install possible.

**Action:**

1. Create Sentry project (sveltekit platform) at sentry.io
2. Set `SENTRY_DSN` (server) and `VITE_SENTRY_DSN` (client) in Vercel production + preview env
3. Bump `tracesSampleRate` from 0 → 0.1 in `hooks.server.ts` for performance traces
4. Bonus PR: add `sentryVitePlugin` for source map uploads (needs `SENTRY_AUTH_TOKEN`)

**Effort:** 20 minutes (you), 0 minutes (code).

### 0.2 Upstash Redis for rate limiting

**Status:** `rateLimit.ts` is implemented but is a silent no-op on Vercel serverless without Upstash env vars. Means impersonation rate-limit, feedback submission rate-limit, etc., are all bypassable today.

**Why now:** the moment SMS is live with real users, abuse vectors open (mass invite, etc.). Rate limit must be active before that scales.

**Action:**

1. Sign in at upstash.com → create Redis instance (region `iad1` near Vercel)
2. Copy REST URL + Token
3. Set `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env (production + preview)
4. Redeploy

**Effort:** 15 minutes. Zero code change.

### 0.3 Hash stakeholder feedback tokens (IDOR fix)

**Status:** `Token.tokenHash` column stores raw 32-byte hex, not a hash. A DB leak exposes every active feedback link.

**Why now:** the moment more than ~50 stakeholders have active tokens in prod, the risk scales. Easier to do it now while count is small.

**Action (3 PRs over 1 sprint, per hygiene followups doc):**

1. PR-1: Dual-read path — store hashed, look up hashed-first with raw fallback for old links
2. PR-2: One-shot UPDATE to hash all existing rows
3. PR-3: Remove the raw fallback

**Effort:** ~3–4 hours dev across the 3 PRs.

**DO NOT do in one PR** — rolling deploy window would break in-flight email links.

### 0.4 GitHub branch protection on `main`

**Status:** CI runs but is advisory only — anyone can merge to main without checks passing.

**Why now:** With Kieran integrated as a contributor, two people touching main without protection guarantees an accidental break.

**Blocker:** needs Advance-Layer-Labs org-admin (Kieran). Already on Kieran's plate per `kieran-onboarding.md` §6.D.

**Action when Kieran's clicking:** GitHub → Branches → `main` → require PR + status checks (Lint, Tests, Build) + up-to-date branches.

**Effort:** 30 seconds (Kieran).

### 0.5 Audit `/admin/seed` and `/admin/demo` for prod-presence

**Status:** Both routes exist in `src/routes/admin/`. Unclear whether they should be reachable in prod.

**Why now:** Before real users + a public domain, anything admin should be defensive. Even if locked behind ADMIN role, dev-only utilities shouldn't be in prod surface area.

**Action:** Inspect both. Gate behind `if (env.NODE_ENV !== 'production')` if they're truly dev-only, OR confirm they're safe and well-guarded.

**Effort:** 20 minutes read + small edit.

---

## Tier 1 — UX retention wins (do in next 2 weeks)

Seven items. These determine whether a first-time user becomes a second-cycle user. The empty-state work in particular has compounding ROI.

### 1.1 Empty-state copy for Insights, Feedback, Ask (UX architecture §4.4–4.6)

**The problem:** A first-week user sees menu items for Insights, Feedback, and Ask — but those features have no data yet. The pages render empty. **Most likely interpretation: the app is broken.**

**Action:** Add explicit "this will fill in when…" messaging:

- **Insights:** "Your first AI insight will arrive after your week 2 check-in (Sun Jun X). It analyzes patterns in your reflections + feedback."
- **Feedback:** "Your stakeholders haven't responded yet. Expected first feedback: [date based on cron + their first reminder]."
- **Ask:** Show 3 suggested prompts that work even with sparse data ("How am I doing this week?", "What should I focus on?", etc.)

**Effort:** ~3 hours. Just copy + a small "empty state" component for each.

**Leverage:** This is probably the single highest first-week retention lever.

### 1.2 Stakeholder invitation deferral

**The problem (architecture.md §3):** Onboarding asks for up to 10 names + emails before showing any value. Highest-stakes drop-off step.

**Action options to consider:**

- **A. Defer entirely:** Move stakeholder invite to **after first check-in is submitted**. New flow: onboard → 1 check-in → "now let's get 360° on this. Who should weigh in?"
- **B. Half-defer:** Onboarding asks for 1–2 (the most critical), with "you can add more later" framed positively.
- **C. Pre-fill:** If coach-invited, the coach has already named the stakeholders. Show those names with "edit if needed" rather than empty fields.

**Recommendation:** Option B + C combined. Don't fully defer (it loses the moment of "set up the loop") but lower the asking-bar from 10 to 1–2.

**Effort:** ~1 day dev. Onboarding wizard step rework.

### 1.3 Cycle transition celebration moment

**The problem (architecture.md §10 #9):** End-of-cycle is currently a quiet UI state change. The hub renders the "complete" state and offers a new cycle. For a user who just completed 12 weeks of self-reflection, this is underwhelming.

**Action:** A modal / page that surfaces:

- "Here's what changed across your 12 weeks" (scorecard delta, effort trend, top insight)
- An option to share with their coach (or download as PDF)
- A clear "Start your next cycle" CTA — with optionally a brief "what would you adjust?"

**Effort:** ~1.5 days dev. New page/modal + summarization query.

### 1.4 First-time Coach session-view tour

**The problem (architecture.md §5.3):** Most information-dense screen in the app. New coach lands and feels like a cockpit they can't read.

**Action:** Lightweight 3-step overlay first time they open a session — "Here's the recent activity. Here's the AI prep. Here's where you take notes." Saves a state, never shows again.

**Effort:** ~4 hours dev.

### 1.5 Default to Scorecard tab once user has feedback (architecture.md §4.3)

**The problem:** Today is always default hub tab. But after 4+ weeks of stakeholder feedback, the Scorecard is the most valuable view.

**Action:** Add a derived "hub default" rule: if user has ≥ N feedback entries in current cycle, default to Scorecard tab instead of Today. Or: surface a banner on Today saying "your blind-spot view is ready" with a CTA.

**Effort:** ~2 hours dev.

### 1.6 Suggested subgoals in onboarding (architecture.md §3)

**The problem:** Step 3 asks for up to 5 measurable subgoals with no guidance. Cold start is hard.

**Action:** Once the user types an objective title in step 2, prompt Claude to generate 3 suggested subgoals based on it. User accepts / edits / replaces. Big cognitive-load reducer.

**Effort:** ~6 hours dev (prompt + UI + accept flow).

### 1.7 Activity-aware reminder scheduling (architecture.md §8)

**The problem:** Mon-Fri 9am + 2pm cron jobs can double-tap users who don't engage. Reminder fatigue is a real churn vector.

**Action:** Smart skip — if a user checked in within the last 2 days, suppress the next reminder. If they haven't checked in for 5+ days, escalate one notification then quiet.

**Effort:** ~1 day dev. Cron job logic change + a small "skip recent" predicate.

---

## Tier 2 — Hygiene & IA cleanup (2-week background queue)

Eight items. Each is small. Knock out as small PRs while Tier 1 ships.

### 2.1 Insight `@@unique` constraint (hygiene #2)

Dedupe check + migration. ~2 hours.

### 2.2 Neon `directUrl` for migrations (hygiene #5)

Add `directUrl` to schema.prisma + `DIRECT_DATABASE_URL` env. ~30 minutes.

### 2.3 `CRON_SECRET` ↔ `JOB_SECRET_TOKEN` verification (hygiene #7)

Just verify env. ~10 minutes.

### 2.4 `/individual/dashboard` audit (architecture.md §4.12)

Likely a vestige of pre-Tier 2 IA. Decide: kill it, redirect to /individual, or keep with refresh. ~30 minutes inspection.

### 2.5 `/reflections` audit (architecture.md §9.1)

Legacy route. May still be linked from old emails. Decide: kill or keep as redirect. ~15 minutes.

### 2.6 Username field on sign-up (architecture.md §2.3)

Clerk-configured. Username is required but probably unnecessary friction. Toggle off in Clerk dashboard. ~5 minutes.

### 2.7 Stakeholder invalid page recovery CTA (architecture.md §2.8)

Current dead-end → add "request a new link" that emails the individual. ~3 hours dev.

### 2.8 Deeper `docs/` reorg (hygiene #8)

`docs/active/`, `docs/archive/`, `docs/specs/`. Lots of cross-link updates. ~3 hours.

---

## Tier 3 — Strategic upgrades (post-50-real-users backlog)

Six items. Don't build until real-user feedback has prioritized them.

### 3.1 Coach invite templates (architecture.md §5.6)

"Save as template" → re-use across similar clients. Compounds time savings for active coaches.

### 3.2 Compare-to-prior-cycle in Progress view (architecture.md §4.2)

Overlay current cycle with prior. The "am I getting better?" question.

### 3.3 Stakeholder feedback save-and-resume (architecture.md §6)

Currently single-sitting. Let stakeholders pause + resume mid-form.

### 3.4 Individual monthly summary (architecture.md §8)

Parallel to stakeholder-impact monthly. "Here's what you accomplished this month."

### 3.5 "Reveal" explainer & smart prompting (architecture.md §4.4)

Where does the user learn about the asymmetric Reveal toggle? Make discovery deliberate.

### 3.6 Mid-cycle objective edit (architecture.md §4.11)

If a user realizes their objective is wrong 3 weeks in, what's the path? Right now only end-of-cycle.

---

## Recommended sequencing (next 4 weeks)

**Week 1 (this week):**

- All of Tier 0 (5 items, ~3 hours your time + ~4 hours dev for token hashing)
- Sentry + Upstash + branch-protection ask to Kieran

**Week 2:**

- Tier 1.1 (empty-state copy) — single biggest first-week retention win
- Tier 1.7 (reminder scheduling) — also retention
- Tier 2.6 (kill username field) — frictionless quick win

**Week 3:**

- Tier 1.2 (stakeholder invitation deferral)
- Tier 1.5 (Scorecard default once feedback exists)
- Tier 2.4–2.5 (route audits)

**Week 4:**

- Tier 1.3 (cycle celebration moment)
- Tier 1.6 (suggested subgoals)
- Tier 1.4 (Coach session tour)

Tier 3 is intentionally left for "after first wave of real users provides directional signal."

---

## What's deliberately NOT in this plan

Some things came up that I'm choosing to defer / not address:

- **Marketing landing redesign** (architecture.md §2.1) — your strategic posture is "real-world testing before new feature work," and a marketing site fits in that "post-test" bucket
- **Tier 4 roadmap features** — same logic, deferred per CLAUDE.md
- **Custom Clerk UI** — purely cosmetic. Not blocking
- **Email/SMS template visual polish** — already shipped to standard quality

If any of these become more important based on early user feedback, they can graduate up the tiers.

---

## How to use this doc going forward

1. Treat **Tier 0** as a checklist: each item is independently shippable
2. Treat **Tier 1** as a 2-week sprint plan
3. Treat **Tier 2** as a small-PR background queue
4. Treat **Tier 3** as "next-quarter backlog candidates"

Each item has a section reference back to its source — the UX flow doc (`docs/ux-flow/architecture.md` §X) or the hygiene doc (`docs/security-hygiene-followups.md` #X). When you ship something, mark it ✅ here and link the PR.

---

## Open questions for you to react to

1. **Stakeholder invitation deferral (1.2):** Recommendation is half-defer (B+C). Comfortable with that, or do you have a stronger view?
2. **Scorecard default (1.5):** Should the threshold be "≥4 feedback entries" or different?
3. **Tier 3 prioritization:** All deferred until user signal exists. Anything you'd pull forward based on intuition?
4. **Kieran allocation:** branch protection (0.4) and any other org-admin tasks ready to batch into his next session?
