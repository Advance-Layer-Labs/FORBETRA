# Forbetra — Path to 9+/10

_Built 2026-05-31. Concrete plan to take Forbetra from "shipped, all tiers complete, real-world-testing posture" to a 9+/10 product that's uber simple, sticky, and incredibly useful._

The improvement plan covered safety + hygiene + a long backlog. **This doc is the curated "if we want to actually feel like a 9/10 in 2–3 weeks" subset.** Smaller list, deeper bar.

---

## Defining 9+/10 — what each word means concretely

### Uber simple

- A first-time user reaches "I see my first useful insight" in ≤ 14 days with zero confusion moments
- Every screen has one clear primary action; secondary actions don't compete for attention
- No menu item ever renders empty or broken
- Onboarding asks for the minimum needed to start producing value (not the maximum)
- A reviewer (stakeholder) finishes their feedback in ≤ 2 minutes without thinking

### Sticky

- Users who complete week 1 reach week 4 at ≥ 70%
- The Scorecard "blind-spot" delta becomes a moment users _anticipate_ (push them toward it)
- End-of-cycle feels like a milestone, not a UI state change
- Streaks visible enough to motivate but not so visible they punish a missed week
- Stakeholders get a feedback loop showing their impact (already partially there via monthly summary)

### Incredibly useful

- AI insights are personally relevant — "your effort score is dropping when Lisa scores you lower" not "you did effort 7 this week"
- Coach prep saves a coach 30 min per session
- A stakeholder closing their feedback form feels like they helped, not interrupted
- One concrete behavior change is visible per cycle (quantified delta from baseline)

---

## The 12 interventions ranked

| #   | Theme  | Item                                                                          | Effort | Blast radius | Plan ref  |
| --- | ------ | ----------------------------------------------------------------------------- | ------ | ------------ | --------- |
| 1   | Simple | Stakeholder invitation in onboarding: defer to 1–2, expand post-first-checkin | 1 day  | High         | §1.2      |
| 2   | Useful | Suggested subgoals via Claude (from objective text)                           | 6 hr   | High         | §1.6      |
| 3   | Sticky | Scorecard becomes adaptive default tab once feedback exists                   | 3 hr   | Medium       | §1.5      |
| 4   | Sticky | Cycle transition celebration page (delta, top insight, share-with-coach)      | 1.5 d  | High         | §1.3      |
| 5   | Useful | Coach session view: 3-step first-time tour                                    | 4 hr   | Medium       | §1.4      |
| 6   | Simple | Mid-cycle objective edit affordance (don't make users wait for cycle end)     | 4 hr   | Medium       | Tier 3 #6 |
| 7   | Sticky | Push-style insight notification when Scorecard delta shifts meaningfully      | 4 hr   | Medium       | New       |
| 8   | Simple | Activity-aware reminder skip (don't double-tap users who just checked in)     | 1 day  | Medium       | §1.7      |
| 9   | Useful | "What changed this month" Individual monthly summary                          | 4 hr   | Medium       | §3.4      |
| 10  | Sticky | Compare-to-prior-cycle overlay in Progress view                               | 6 hr   | Low          | §3.2      |
| 11  | Useful | Reveal toggle prominence — surface it in Feedback page header with clear copy | 2 hr   | Low          | §1 #4     |
| 12  | Simple | First-cycle hub "what to expect" banner that decays after 2 weeks             | 2 hr   | Low          | New       |

---

## Sequencing — three themed bursts

Each burst = a few related PRs shipped together. After each, real prod soak time + Marc reactions before the next.

### Burst 1 — "Lower the activation cost" (this session focus)

Items 1, 2, 3, 11, 12. The work that determines whether week-1 users come back for week 2.

- Stakeholder invitation deferred to 1–2 in onboarding (#1)
- Suggested subgoals via Claude when user types an objective (#2)
- Scorecard adaptive default once data exists (#3)
- Reveal toggle prominence (#11)
- First-cycle hub orientation banner (#12)

**Why this burst first:** the highest-leverage interventions are at the entrance. A user who hits friction in week 1 never sees the polish in week 6.

### Burst 2 — "Reward the loop" (~1 week)

Items 4, 7, 9, 10. The work that converts "I'm using this" into "I'm getting something back."

- Cycle transition celebration (#4)
- Push-style insight notifications when scorecard delta shifts (#7)
- Individual monthly summary (#9)
- Compare-to-prior-cycle overlay (#10)

### Burst 3 — "Coach polish + small smooth-outs" (~3-5 days)

Items 5, 6, 8. The work for the coach-facing side and rough edges.

- Coach session view first-time tour (#5)
- Mid-cycle objective edit affordance (#6)
- Activity-aware reminder skip (#8)

---

## Definition of "we're at 9/10"

Concrete launch criteria for declaring success — measurable, not vibes:

- [ ] A new user can complete onboarding in ≤ 4 minutes (down from ~7)
- [ ] First-week retention (week 0 → week 2 active check-in) ≥ 70% in real-user testing
- [ ] Cycle completion rate (week 1 → week 12) ≥ 50% in real-user testing
- [ ] Every menu item has a non-broken empty state at first paint
- [ ] Coach NPS ≥ 8 from at least 3 real-world coach users
- [ ] Stakeholder feedback completion ≥ 75% (current unknown; instrument it)

---

## What's NOT in this plan

- Marketing site / org SEO work (defer until real users validate first)
- Tier 4 features per the existing roadmap (defer per CLAUDE.md posture)
- New role types or org-level features (foundation exists; surface it when needed)
- Mobile native app (responsive web is sufficient through this phase)

---

## Tonight's execution (Burst 1 first cuts)

Starting in this order:

1. **Item 3 (Scorecard adaptive default)** — fastest first win (~3 hrs). One PR.
2. **Item 11 (Reveal toggle prominence)** — quick polish (~2 hrs). One PR. May fold into #3 if it's a small enough patch.
3. **Item 12 (First-cycle hub banner)** — small UX additive (~2 hrs). One PR.
4. **Item 1 (Stakeholder invitation deferral)** — bigger lift (~1 day) but huge leverage. Multi-commit single PR.

Items 2 (suggested subgoals) and the rest of Burst 1 next session — they're either bigger (need product judgment) or external (Sentry/Upstash).

Ship cadence: each PR through CI → merge → soak. Stop the burst if anything looks risky.
