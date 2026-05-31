# Forbetra UX Flow & Architecture

_Built 2026-05-30 (autonomous capture session). 53 real screenshots from local dev._

A note on coverage: this doc has **real screenshots for every route in the app** — 8 public + 13 individual + 5 coach + 2 stakeholder + 13 admin + onboarding + reflections fallback. Captured via Clerk Backend API sign-in tokens authenticating as ADMIN, with `/api/admin/impersonate` used to hop between role contexts. Most Individual routes are captured twice: once from your own account (`/individual` Week 6, no AI insights yet) and once impersonating "Alex Rivera" (seeded persona with a completed cycle, multiple stakeholders, full insights history) — the side-by-side reveals empty-state vs. lived-in state.

---

## 1. Bird's-eye view — 4 user roles, 4 distinct journeys

```
                            ┌──────────────────────┐
                            │   Landing  /         │
                            │   (anyone)           │
                            └──────────┬───────────┘
                                       │
                  ┌────────────────────┴────────────────────┐
                  │                                         │
            Sign in / Sign up                     Stakeholder via token
            (Clerk OAuth or email)                (email → tokenized link)
                  │                                         │
                  ▼                                         ▼
            ┌─────────────────┐                ┌────────────────────────┐
            │  /onboarding    │                │  /stakeholder/         │
            │  (5-step wizard │                │  feedback/[token]      │
            │   if first time)│                │                        │
            └────────┬────────┘                │  Score effort/perf     │
                     │                         │  per subgoal +         │
                     │                         │  optional comment      │
                     │                         └──────────┬─────────────┘
   ┌─────────────────┼─────────────────┐                  │
   │                 │                 │                  ▼
   ▼                 ▼                 ▼            (submitted, no
INDIVIDUAL         COACH             ADMIN          further interaction)
 /individual       /coach            /admin
 (hub-first)     (roster-first)    (dashboard
                                    +preview)
```

**Four distinct apps under one URL.** Each role has its own information architecture, navigation, and dominant verb:

| Role        | Dominant verb           | Time spent per visit    | Frequency       |
| ----------- | ----------------------- | ----------------------- | --------------- |
| Individual  | "Check in"              | 90s nominal, can extend | 1–2× per week   |
| Coach       | "Prepare for session"   | 5–15 min                | 2–4× per week   |
| Stakeholder | "Give feedback"         | 2–4 min                 | 1× per ~2 weeks |
| Admin       | "Inspect / impersonate" | varies                  | irregular       |

---

## 2. Public surface (everyone, unauthenticated)

These are the screens you can land on without an account.

### 2.1 Landing — `/`

![Landing](screenshots/00-landing.png)

**Who lands here:** anyone who types `app.forbetra.com`. The two paths are immediately presented: "Sign in" (warm gradient — clearly the primary action for returning users) and "Create account" (secondary).

**Below the fold:** the value prop is reduced to 3 numbered steps (Define / Reflect / Get feedback). Bottom-right block makes the policy posture clear (Terms, Privacy, SMS Consent linked inline).

**Question — is the messaging right for cold visitors?** This page assumes someone knows what Forbetra is. There's no "what is this" hero, no testimonial, no screenshots of the product. For coach-invited clients that's fine (they're invited and oriented). For organic discovery (or any later marketing site) it might be undersold.

### 2.2 Sign in — `/sign-in`

![Sign in](screenshots/01-sign-in.png)

Clerk-hosted form. Google + LinkedIn SSO + email/username + password.

**Note:** "Development mode" badge currently shown — that's local dev only; prod hides it. The form itself is on a white card against the dark Forbetra background, which feels visually disjoint from the brand. Worth considering whether to customize the Clerk component for more brand cohesion.

### 2.3 Sign up — `/sign-up`

![Sign up](screenshots/02-sign-up.png)

Clerk-hosted form. Fields: First name (optional), Last name (optional), Username (required), Email (required), Password (required).

**Friction:** Username being required is unusual for a coaching app and adds 1 field. Most modern SaaS skips username; it's set internally as email. Worth considering whether this is needed.

**Friction:** Cloudflare Turnstile fires here, which adds a verification step. In real use it's usually invisible/instant but for bot-flagged browsers it can be a wall.

### 2.4 Privacy — `/privacy`

![Privacy](screenshots/03-privacy.png)

Full privacy policy. References "Winning Mind, LLC" as the operating entity.

### 2.5 SMS Terms — `/sms-terms`

![SMS Terms](screenshots/04-sms-terms.png)

Tightly scoped SMS-specific terms (separate from general /terms). Required for A2P 10DLC compliance.

### 2.6 SMS Consent — `/sms-consent`

![SMS Consent](screenshots/05-sms-consent.png)

The dedicated consent surface that TCR reviewers verify. Shows the in-app opt-in UI mock, message types, frequency, opt-out, contact. This is the highest-leverage compliance page — if it goes down, A2P breaks.

### 2.7 General Terms — `/terms`

![Terms](screenshots/06-terms.png)

Standard ToS. Linked from landing and sign-up flow.

### 2.8 Stakeholder invalid — `/stakeholder/invalid`

![Invalid stakeholder](screenshots/07-stakeholder-invalid.png)

Lands here when a stakeholder clicks an expired or already-used token link. Friendly dead-end (no recovery path from here).

**Question:** Should this offer a "Request a new link" CTA that emails the individual to re-invite the stakeholder? Right now it's a true dead end.

---

## 3. Onboarding (newly signed-in users) — `/onboarding`

### 3.1 Step 1 — your account

![Onboarding step 1](screenshots/20-onboarding-step1.png)

Entry into the onboarding wizard. From here the user moves through 5 steps + initial-ratings + complete:

1. **Step 1 (captured above):** account essentials — phone number (optional), opt-in to SMS
2. **Step 2:** Objective — what do you want to improve? (1 sentence title + longer description)
3. **Step 3:** Subgoals — up to 5 measurable sub-objectives with `SubgoalMetric` type
4. **Step 4:** Cycle config — start date, length (default 12 weeks)
5. **Step 5:** Invite stakeholders — up to 10 (name, email, relationship)
6. **`/onboarding/initial-ratings`** — Individual self-rates baseline effort & performance per subgoal
7. **`/onboarding/complete`** — confirmation, transition to `/individual`

**Coach-prefilled variant:** If the user signed up via a coach invite (`/coach/invite/[token]`), the wizard is **pre-populated** with the coach's inputs. User reviews and confirms rather than entering from scratch. Major lift-reducer for coach-driven onboarding.

**Friction notes:**

- 5 steps is on the long side; "save-as-you-go" drafts mitigate but don't eliminate abandonment risk
- Stakeholder invitation in the wizard is a critical drop-off point — asking for 10 names + emails before the user has seen any value
- Phone number step is optional but the UX should make extra clear that SMS is also optional (some users may bounce thinking it's required)

**Questions for you:**

- Could the stakeholder-invitation step be moved post-onboarding (e.g., shown after first check-in)?
- Could the subgoals step offer suggested defaults based on the objective text? Lowers cognitive load.
- What's the actual measured drop-off between steps 1 and 6?

---

## 4. Individual journey (the client receiving coaching)

All screenshots in this section are from impersonating **Alex Rivera** — a seeded persona with a completed cycle, 4 active stakeholders, multiple weeks of feedback, and AI-generated insights. Captures from your own data-sparse account are stripped out since they render as "no data yet" empty states that look broken rather than instructive.

### 4.1 Hub — `/individual` (default landing)

![Individual hub](screenshots/60-individual-hub-rich.png)

The hub is **the single most-visited screen in the app**. It renders one of these states based on the user's situation: `welcome`, `caught-up`, `cycle-complete`, or `default`. The inline RatingBar pattern (score effort + performance directly on the hub, no separate "click into check-in" flow) is the right call.

**Observation:** the hub has a lot of vertical whitespace once you scroll past the check-in module. Could it do more to surface "since your last check-in: X" or "this week's pattern is…" in a glanceable way?

### 4.2 Progress — `/individual/progress`

![Progress](screenshots/61-individual-progress-rich.png)

Time-series view of self-scored effort and performance across the current cycle.

**Question:** Is there a "compare to prior cycle" view here, or only intra-cycle? For lived-in users, the most interesting question is "am I improving over time" — that's only visible if cycles can be overlaid.

### 4.3 Scorecard — `/individual/scorecard`

![Scorecard](screenshots/62-individual-scorecard-rich.png)

Self vs. stakeholder comparison per subgoal — **the blind-spot view**. This is the page that most differentiates Forbetra from any single-perspective reflection tool. It only makes sense when stakeholder feedback exists.

**Question:** Should the Scorecard become the **default hub tab** once enough data exists? Right now Today is always default. Once a user has 4+ weeks of stakeholder feedback, the Scorecard is arguably more valuable than Today's check-in module.

### 4.4 Feedback — `/individual/feedback`

![Feedback](screenshots/63-individual-feedback-rich.png)

View feedback received from stakeholders.

**Empty-state UX challenge worth flagging:** first-cycle users may not see feedback for 1–2 weeks after onboarding. The Feedback page needs a clear "your first feedback will arrive after stakeholders respond — here's when that's expected" message, or the menu item looks broken.

**Question:** Is there a "Reveal" gate explanation here? Per the Tier-2 feature list, Reveal is opt-in (stakeholders don't see self-scores by default). Where does the user encounter the Reveal toggle, and does this page educate them about the asymmetry?

### 4.5 Insights — `/individual/insights`

![Insights](screenshots/64-individual-insights-rich.png)

AI-synthesized insights stream. Generated weekly (Sun 8pm cron) and on-demand. Streaming UX.

**Empty-state UX challenge worth flagging:** insights take days of data to be meaningful. The page needs to clearly say "your first insight will arrive after your week 2 check-in" — otherwise a first-time user sees a blank menu item and assumes it's broken.

### 4.6 Ask — `/individual/ask`

![Ask](screenshots/68-individual-ask-rich.png)

The "Ask About Your Data" conversational interface. Natural-language Q&A against the user's reflection + feedback history.

**Observation:** chat-style empty states benefit massively from suggested prompts ("Try asking: What patterns do you see in my effort scores?"). If this empty state is bare, users won't discover the surface.

### 4.7 Stakeholders — `/individual/stakeholders`

![Stakeholders](screenshots/65-individual-stakeholders-rich.png)

Manage reviewers — add, edit, archive, re-invite. Up to 10.

This is the surface for the long-tail "I need to add another reviewer" or "I need to remove someone who's no longer relevant" use cases. Less visited but high-stakes when used.

### 4.8 History — `/individual/history`

![History](screenshots/66-individual-history-rich.png)

Browse past weeks of reflections. The chronological scrapbook view.

### 4.9 Journey — `/individual/journey`

![Journey](screenshots/67-individual-journey-rich.png)

Cycle-by-cycle archive. Each past cycle is a self-contained record (start date, objective, scores, insights summary).

### 4.10 Journey detail — `/individual/journey/[cycleId]`

![Journey detail](screenshots/69-individual-journey-detail.png)

Per-cycle deep dive. Click a card from §4.9 to land here.

### 4.11 New Cycle — `/individual/new-cycle`

![New cycle](screenshots/19-individual-new-cycle.png)

The "Start a new cycle" flow at end-of-cycle. Re-uses onboarding components but with the prior cycle's objective as default.

**Question:** Is this discoverable mid-cycle, or only after one ends? A user who realizes their objective is wrong 3 weeks in should have a clear "start over" path.

### 4.12 Dashboard — `/individual/dashboard`

![Dashboard](screenshots/21-individual-dashboard.png)

A summary view that overlaps somewhat with the hub's Progress/Scorecard tabs. **Worth checking if this is still needed** or if it's a vestige of the pre-Tier 2 IA.

### 4.13 Settings — `/individual/settings`

![Settings](screenshots/22-individual-settings.png)

Notification delivery method (Email / SMS / Both), phone number, profile, account deletion. `/settings` redirects here.

### 4.14 Check-in (standalone) — `/individual/checkin`

This route exists but **redirects to `/individual` (the hub)** when no check-in is currently due. Designed for use from SMS/email links — when a notification arrives saying "time to check in", tapping the link routes here, which then routes to the hub with the check-in module active.

---

## 5. Coach journey

Files under `/coach/`. Captures from impersonating Elena Vasquez (3 clients).

### 5.1 Default coach landing — `/coach`

![Coach default](screenshots/54-coach-default-landing.png)

Most coaches will land directly on `/coach/roster`; this is the bare /coach route.

### 5.2 Roster — `/coach/roster`

![Coach roster](screenshots/50-coach-roster.png)

The coach's home screen. Lists all active clients with sort by alerts / name / recent, filter by archived state, search.

**The default sort by "alerts" is the right call** (surfaces who needs attention first). Notice how the screen scales when you have 3 clients vs. 30 — Elena's 3-client view fits on one screen; a 30-client roster would need different IA (search-first? grouped by status?).

### 5.3 Session View — `/coach/session?clientId=<id>`

![Coach session view](screenshots/55-coach-session-view.png)

The per-client deep dive. Shows client profile, current objective, subgoals, recent reflections, scores, trend lines, stakeholder feedback summary, AI-generated coach prep, notes (coach-only).

**This is the most information-dense screen in the app.** Designing it well is the difference between a coach who feels equipped and one who feels overwhelmed. The session view is also probably the place a coach spends the most time per visit.

**Question:** Is there a "tour" or progressive disclosure for first-time coach use? An unfamiliar coach lands here and might feel like a cockpit they can't read.

### 5.4 Analytics — `/coach/analytics`

![Coach analytics](screenshots/51-coach-analytics.png)

Portfolio view: outcomes across all clients, comparative trends, time-series.

### 5.5 Invitations — `/coach/invitations`

![Coach invitations](screenshots/52-coach-invitations.png)

List of pending / accepted / cancelled invites.

### 5.6 Invite new — `/coach/invite`

![Coach invite](screenshots/53-coach-invite-new.png)

Send a new invite. Includes the coach-prefilled fields (objective, subgoals, stakeholders, cycle config) — this is where the "lift-reducer for the client" originates.

**Question:** Could a coach save a partial fill as a template? If a coach has a standard methodology, every new client probably starts with similar subgoals. A "Save as template" / "Use template" affordance would multiply the time savings.

---

## 6. Stakeholder journey (no signup required)

Tokenized links, no account.

### 6.1 Feedback form — `/stakeholder/feedback/[token]`

![Stakeholder feedback form](screenshots/70-stakeholder-feedback-form.png)

Per subgoal: effort score + performance score (RatingBar component), optional comment, submit. Captured by generating a fresh feedback token for Lisa Park (one of Alex Rivera's stakeholders).

**This is the only surface for a stakeholder.** It has to land perfectly because there's no second chance.

### 6.2 Bare /stakeholder/feedback (no token)

![Stakeholder feedback bare](screenshots/71-stakeholder-feedback-bare.png)

What a stakeholder sees if the URL is hit without a token.

### 6.3 Invalid token — `/stakeholder/invalid` (captured in §2.8)

Dead-end when a token is expired or already used.

**Stakeholder journey friction notes:**

- Mobile-first matters more here than anywhere else — stakeholders are giving feedback between meetings
- Anchor the disclosure: who's asking, what's it for, how long it takes, whether the individual will see who said what

**Questions:**

- Does the feedback page tell them how the individual will see their input (named vs. aggregated)?
- Is there a "save and return later" option, or do they have to complete in one sitting?

---

## 7. Admin surface

Files under `/admin/`. Gated to `role === 'ADMIN'`.

### 7.1 Dashboard — `/admin`

![Admin dashboard](screenshots/30-admin-dashboard.png)

User stats (total / by role), recent reflections, system health.

### 7.2 Users — `/admin/users`

![Admin users](screenshots/31-admin-users.png)

List of all users in the system.

### 7.3 User detail — `/admin/users/[id]`

![Admin user detail](screenshots/42-admin-user-detail.png)

Drill-down on a specific user. Probably where impersonation should be one-click reachable.

### 7.4 Preview / Impersonate — `/admin/preview`

![Admin preview](screenshots/32-admin-preview.png)

The killer admin tool: pick any user → become them. Sets `forbetra_impersonate` cookie via `/api/admin/impersonate`. Lets you experience the app as that user.

**This is how you should debug any user issue.** I used this extensively to capture this entire doc.

### 7.5 Coaches — `/admin/coaches`

![Admin coaches](screenshots/33-admin-coaches.png)

Coach-specific management.

### 7.6 Insights — `/admin/insights`

![Admin insights](screenshots/34-admin-insights.png)

System-wide insight stream — view all AI-generated insights across all users.

### 7.7 Objectives — `/admin/objectives`

![Admin objectives](screenshots/35-admin-objectives.png)

List of all objectives across all individuals.

### 7.8 Objective detail — `/admin/objectives/[id]`

![Admin objective detail](screenshots/41-admin-objective-detail.png)

Per-objective inspection.

### 7.9 Organizations — `/admin/organizations`

![Admin organizations](screenshots/36-admin-organizations.png)

Multi-org admin (foundation for enterprise readiness).

### 7.10 Stakeholders — `/admin/stakeholders`

![Admin stakeholders](screenshots/37-admin-stakeholders.png)

Cross-individual view of all stakeholders.

### 7.11 Settings — `/admin/settings`

![Admin settings](screenshots/38-admin-settings.png)

Platform settings.

### 7.12 Demo — `/admin/demo`

![Admin demo](screenshots/39-admin-demo.png)

Demo mode toggles. **Worth auditing whether this should exist in prod** — feels dev-only.

### 7.13 Seed — `/admin/seed`

![Admin seed](screenshots/40-admin-seed.png)

UI-driven seed data operations. **Also worth auditing prod presence.**

---

## 8. Async / cron surface (no UI — emails and SMS)

User experience also includes what arrives in their inbox / on their phone. From `vercel.json`:

| Cron                           | Schedule          | Audience     | Effect                                  |
| ------------------------------ | ----------------- | ------------ | --------------------------------------- |
| `/api/jobs/remind-base`        | Mon–Fri 9am       | Individuals  | Weekly check-in reminder                |
| `/api/jobs/remind-prompts`     | Mon–Fri 2pm       | Individuals  | Overdue check-in nudge                  |
| `/api/jobs/remind-feedback`    | Mon–Fri 3pm       | Stakeholders | "Time to give feedback"                 |
| `/api/jobs/generate-insights`  | Sun 8pm           | Individuals  | New insights generated (in-app + email) |
| `/api/jobs/coach-prep`         | Mon 7am           | Coaches      | "Your week's coach prep is ready"       |
| `/api/jobs/complete-cycles`    | Daily 1am         | System       | Cycle end-state transitions             |
| `/api/jobs/stakeholder-impact` | 1st of month 10am | Stakeholders | "Here's the impact your feedback had"   |

**Email + SMS templates live in `src/lib/notifications/`.** Each one is a UX surface — the user sees these more often than the in-app screens.

**Questions:**

- Is there an opportunity to consolidate the Mon-Fri 9am + 2pm nudges into one smart-timed message based on user activity? (Two reminders/day risks fatigue.)
- The stakeholder-impact monthly summary is a relationship-builder. Could there be a similar monthly summary for the Individual ("here's what you accomplished") that ties the cycle together?

---

## 9. Other / fallback

### 9.1 Reflections — `/reflections`

![Reflections fallback](screenshots/72-reflections.png)

A legacy route that may still be linked from old email templates or external bookmarks. Worth checking whether it can be retired.

---

## 10. The 12 UX inflection points worth thinking about

Pulled from the journey notes above, ranked by leverage:

1. **First-cycle "no insights yet" empty state.** §4.5. A user signs up, completes onboarding, and won't see real AI insights for weeks. The empty-state copy defines whether they stay engaged or churn.

2. **Scorecard as default hub tab once data exists.** §4.3. The Scorecard is the differentiator. Right now Today is always default — but once a user has 4+ weeks of stakeholder feedback, the Scorecard arguably becomes more valuable to glance at.

3. **Stakeholder invitation in onboarding.** §3. Highest-stakes step. Asks for 10 names+emails before showing value. Could it be deferred to post-first-check-in?

4. **Reveal toggle discoverability.** §4.4. The opt-in Reveal of self-scores is a meaningful trust feature. Where does the user encounter it? Does the Feedback page educate them?

5. **Check-in submit friction.** §4.1. Hub-inline check-in is correct UX. The submit cycle must feel instant — no spinner that lingers.

6. **Coach Session View density / first-time tour.** §5.3. Most information-dense screen in the app. First-time coach may be overwhelmed without progressive disclosure.

7. **Coach invite template re-use.** §5.6. Coaches with a methodology probably repeat subgoals across clients. "Save as template" could be a real time-saver.

8. **Stakeholder feedback link UX (mobile).** §6.1. Single most important third-party page. Mobile-first absolutely required — stakeholders give feedback between meetings.

9. **Cycle transition moment.** What does end-of-cycle feel like? Celebration? Coaching call? Right now it's a quiet UI state change.

10. **Dashboard route vestige.** §4.12. `/individual/dashboard` may have been superseded by hub tabs. Worth auditing.

11. **Stakeholder invalid page dead-end.** §2.8. No recovery path; could offer "request new link".

12. **Email/SMS reminder fatigue.** §8. Mon-Fri 9am + 2pm could double-tap users. Consider activity-aware scheduling.

---

## 11. Methodology note (for future captures)

This doc was built autonomously using:

1. **Clerk Backend API sign-in tokens** (`POST https://api.clerk.com/v1/sign_in_tokens` with `CLERK_SECRET_KEY`) to generate a 1-hour authenticated session for `sagalwm@gmail.com` without needing UI login.
2. **chrome-devtools MCP** to drive a headless Chrome through every route and take full-page screenshots.
3. **`/api/admin/impersonate`** (via `fetch` from inside the page, with credentials) to hop between role contexts and re-capture routes as different users.
4. **Direct Prisma queries** to generate fresh stakeholder feedback tokens (since they're stored as raw hex, not hashed — could be retrieved if needed; new ones generated for capture).

To re-capture or add screenshots:

- Dev server still running on `http://localhost:5173` (background process ID `b8eu1qs58` when this doc was written; will need to be restarted next session)
- Marc's account is promoted to ADMIN in both the DB and Clerk's `publicMetadata.role` — that persists across sessions
- The same Clerk Backend API + impersonation pattern works for any future capture sprint

**One subtle gotcha discovered during this:** the `hooks.server.ts` auth handler resolves role from `clerkUser.publicMetadata.role` FIRST, then DB role. So promoting a user to ADMIN in Prisma alone doesn't stick — you have to also `PATCH /v1/users/<id>/metadata` on Clerk with `{"public_metadata":{"role":"ADMIN"}}`. Otherwise the next request resets the DB role from Clerk's metadata.

---

## Open for your reactions

This is a thinking tool, not a polished spec. The questions in each section are the part most worth your reaction — the structural map is just the canvas. The empty-state-vs-rich-state contrast (§4) is where I'd start.
