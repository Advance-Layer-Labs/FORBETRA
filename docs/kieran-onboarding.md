# Forbetra — Re-onboarding for Kieran

_Last updated: 2026-05-26_

Welcome back. This doc gets you from "haven't looked at Forbetra in a while" to "can pick up a meaningful piece of work" in about 30 minutes. It's organized so you can skim the parts you already know and stop where you need to.

---

## 1. Where things stand in one paragraph

Forbetra is a real-time 360 coaching platform: structured weekly self-reflection from the Individual, continuous feedback from up to ~10 Stakeholders, AI-synthesized insights, and a Coach dashboard that turns it all into session prep. The product is live at https://app.forbetra.com (production) on SvelteKit + Postgres (Neon) + Prisma + Clerk auth + SendGrid email + Anthropic Claude + Vercel. Tiers 1, 2, and 3 of the roadmap are fully shipped (21 features). Tier 4 (market expansion) is deferred — current strategic posture per Marc is **"real-world testing at scale before any new feature work."** There are two open operational threads — Twilio A2P 10DLC (SMS delivery blocked on a brand-name correction at TCR) and a Vercel auto-deploy hookup — both detailed in §6.

---

## 2. Feature surface (what's live today)

Grouped by role.

### Individual (the client receiving coaching)

- 5-step onboarding wizard with save-as-you-go drafts
- Restructured hub: **Today** / **Progress** / **Scorecard** views
- Weekly reflection check-ins (~90 seconds; nudged by email + SMS)
- "Ask About Your Data" AI chat — natural-language Q&A against their own reflection + feedback history
- Reflection history timeline (browse past weeks)
- Stakeholder management (add/edit/archive, up to 10)
- Insight stream with AI-streaming UX
- Opt-in Reveal of self-scores to stakeholders (default off)
- Milestone celebrations + streak-based email nudges
- Start-New-Cycle flow

### Coach

- Coach dashboard with portfolio view
- **Coach-prefilled invitation** — coach fills objective/subgoals/stakeholders/cycle config, client lands in onboarding pre-populated and just reviews/confirms
- Coach Session View (per-client deep dive with prep + notes + data)
- On-demand Coach Prep generation (used to be Monday-morning batch only)
- Analytics Dashboard: portfolio comparison, outcomes, time-series
- Structured stakeholder prompts (specific behavior + suggestion fields)

### Stakeholder (the reviewer)

- Tokenized link (no signup required)
- Stakeholder Engagement Loop: thank-you emails, monthly impact summaries
- Structured prompts (not a free-text dump)

### Admin

- Admin dashboard, user management
- Preview/impersonation
- Organization model (enterprise-readiness foundation — not exposed to users yet)

### Cross-cutting

- In-app notifications (toast system for insights, feedback, coach notes)
- Email delivery via SendGrid (Postmark as fallback)
- SMS code is complete via Twilio but delivery is gated on the A2P 10DLC campaign approval (see §6)
- Anthropic Claude API powers insights, coach prep, and the "Ask About Your Data" chat
- Webhook verification via Svix (Clerk events)
- Vercel cron jobs (defined in `vercel.json`):
  - Mon–Fri 9am: base reminders
  - Mon–Fri 2pm: overdue reminders
  - Mon–Fri 3pm: stakeholder feedback reminders
  - Sun 8pm: AI insight generation
  - Mon 7am: coach prep
  - Daily 1am: cycle completion
  - 1st of month 10am: stakeholder impact summaries

---

## 3. Jobs to be done (what users are actually trying to accomplish)

### Individual

- "Build self-awareness about my performance habits without spending hours."
- "See whether my self-image matches how others see me — without that being weaponized."
- "Get nudged toward the few things that actually matter, not a wall of advice."

### Coach

- "Walk into a session knowing what to ask without doing 30 minutes of prep per client."
- "Spot which clients are stuck or drifting before they tell me."
- "Show outcomes to my clients (and to whoever's paying for the coaching)."

### Stakeholder

- "Help my colleague/teammate/friend grow without it eating my time or feeling weird."

### Admin / Operator (Marc, you)

- "Run the platform reliably with one operator. No on-call. No surprises."

---

## 4. Tech stack at a glance

| Layer          | Tech                                                   |
| -------------- | ------------------------------------------------------ |
| Frontend       | SvelteKit 2.47, Svelte 5.41, Tailwind CSS 4.1          |
| Backend        | Node.js 22, TypeScript (strict mode)                   |
| ORM            | Prisma 6.19                                            |
| Database       | PostgreSQL (Neon)                                      |
| Auth           | Clerk (email/SSO) via svelte-clerk                     |
| Email          | SendGrid primary, Postmark fallback                    |
| SMS            | Twilio (A2P 10DLC)                                     |
| AI             | Anthropic Claude API                                   |
| Charts         | Chart.js                                               |
| Webhook verify | Svix (Clerk webhook signatures)                        |
| Deploy         | Vercel (`@sveltejs/adapter-vercel`, Node 22.x runtime) |
| Repo           | https://github.com/Advance-Layer-Labs/FORBETRA         |

Full setup steps are in `README.md`. Short version:

```bash
git clone https://github.com/Advance-Layer-Labs/FORBETRA.git
cd FORBETRA
cp .env.example .env  # fill in secrets — ask Marc
npm install
npx prisma migrate dev
npm run seed:comprehensive
npm run dev   # http://localhost:5173
```

---

## 5. Project layout

```
src/
├── lib/
│   ├── components/      # Svelte components
│   ├── notifications/   # Email + SMS providers, templates
│   ├── prompts/         # AI prompt templates (versioned .md files)
│   ├── server/          # Server-only utilities (auth, db, coach utils)
│   ├── stores/          # Svelte stores
│   ├── utils/           # Shared utilities
│   └── validation/      # Zod schemas
├── jobs/                # Cron job logic (remind, insights, coach-prep, etc.)
└── routes/
    ├── admin/           # Admin dashboard + settings
    ├── api/             # Endpoints (jobs, debug, webhooks)
    ├── coach/           # Coach dashboard, invitations, session view
    ├── individual/      # Individual hub, dashboard, insights, stakeholders
    ├── onboarding/      # 5-step onboarding wizard
    ├── stakeholder/     # Tokenized stakeholder feedback flow
    └── (public)         # sign-in, sign-up, privacy, sms-terms, sms-consent
prisma/
├── schema.prisma        # Data model
└── migrations/          # Migration history (don't hand-edit)
docs/
├── roadmap.md           # Tier 1–4 feature plan
├── expert-panel-*.md    # External UX/product/growth reviews
├── ux-*.md              # UX scoring framework + baseline assessment
├── a2p-resubmission.md     # A2P playbook (history + post-approval cleanup)
└── (this doc)           # kieran-onboarding.md
```

---

## 6. Outstanding issues (the live threads)

### A. Twilio A2P 10DLC — SMS delivery blocked

**State:** SMS code is complete and tested end-to-end. Carrier delivery is blocked because the TCR (The Campaign Registry) brand record for our 10DLC brand has a punctuation mismatch with our CA legal entity name.

- **Brand record (TCR / Twilio):** `Winning Mind LLC` (no comma)
- **CA SOS legal entity:** `Winning Mind, LLC` (with comma; entity #200106910149, filed 03/07/2001, Active and Good Standing)
- **Campaign:** `QE2c6890da8086d771620e9b13fadeba0b` — rejected twice with error 30927 (brand/operator mismatch)
- **Open Twilio ticket:** #27161301 — transferred to Trust & Safety on 2026-05-24 by Nicole Chong; awaiting T&S engagement to push a one-time TCR brand-name correction (add the comma)
- **Once T&S corrects the brand:** resubmit script is staged with the corrected `message_flow` text; about 30 seconds to fire and then 1–3 business days for TCR review

**Doc:** `docs/a2p-resubmission.md` has the playbook.

### B. Vercel auto-deploy not firing

**State:** Vercel project link is correctly configured to `Advance-Layer-Labs/FORBETRA`, but the Vercel GitHub App on the org is set to "Only select repositories" without FORBETRA in the list. Every merge to `main` requires a manual `vercel deploy --prod --scope forbetra`.

- **30-second fix Kieran can do** (since you're the only Owner of Advance-Layer-Labs):
  1. https://github.com/organizations/Advance-Layer-Labs/settings/installations
  2. Click "Configure" next to Vercel
  3. Under "Repository access" → add FORBETRA (or flip to "All repositories")
  4. Save
- **Once that's saved:** the next push to `main` auto-deploys; we can verify in 10 seconds via the Vercel API.

### C. Post-Twilio-approval cleanup (queued)

When the A2P campaign approves:

1. Send a test SMS to verify error 30034 is gone
2. Drop the unused number `+16196481113` and the unused "Forbetra" messaging service `MG2127570fa05c2ce1cb3c67e4ebddcb78`
3. Decide whether to delete the legacy failed campaign on `MG1f82c53f...` (the original March rejection)

### D. Org-level ask (lower priority but recurring)

Making Marc an Owner of `Advance-Layer-Labs` would head off the next round of "Kieran has to click a button for me" — Vercel installs, Apps, integrations, secrets. Mention this whenever the pen's in your hand.

---

## 7. Strategic posture (don't skip this)

Per Marc's product strategy (locked in `CLAUDE.md`):

> Tier 1–3 (21 features) complete. Tier 4 (market expansion) deferred.
> **Next focus: Real-world testing at scale before any new feature work.**

What this means practically:

- We're not building features right now. We're hardening, observing, and getting real users on it.
- If you have feature ideas, capture them in `docs/roadmap.md` under Tier 4 or a new tier — don't ship them.
- Highest-leverage contributions right now are in the next section.

---

## 8. Where Kieran could plug in (pick what fits)

These are real, useful, scoped pieces of work, not busywork.

### Operational

- **Org admin / DevOps hygiene** — the Vercel App install fix above is the immediate one. After that: review GitHub org settings, ensure 2FA enforcement (deadline 2026-06-26), audit installed apps, set up branch protection on `main` if not already.
- **Vercel project hygiene** — once auto-deploy is wired, audit env vars for staleness, set up a preview-branch policy, configure Vercel's deployment notifications channel.

### Real-world testing

- **Synthetic user testing** — pick a JTBD from §3 and walk through it end-to-end as a real user. Report any friction. The `qa-engineer` agent has a framework for this — Marc can spin one up for you.
- **Persona-based scenario runs** — e.g., "I'm a new coach onboarding my first client" or "I'm a stakeholder who just got the feedback link." Look for confusing UI, stale copy, dead ends.
- **Cron-job verification** — confirm each of the 7 cron jobs in §2 fires correctly with realistic data over a 1-2 week window.

### Code (if you want hands-on)

- **CI hardening** — current CI runs Lint & Type Check + Tests + Build. Could add: a Prisma migration sanity check, a Lighthouse perf gate on preview deploys, a bundle-size check.
- **Error monitoring** — Sentry SDK is partially wired (referenced in the build warnings). Finishing the integration end-to-end (frontend + server + cron) would close a real observability gap.
- **Cleanup PRs** — there are 2 untracked files in the repo (`docs/forbetra-video-source.md`, `docs/notebooklm-bundle/`) that should either be committed or `.gitignore`'d. Low-stakes warm-up PR if you want one.

### Strategy / business

- **Pricing model exploration** — once SMS unblocks, we need a thoughtful approach to paid tiers. Coach SaaS vs. individual subscription vs. enterprise. Marc has notes; happy to compare.
- **Initial customer outreach** — Tier-4-deferred reality means real users matter more than features. If you have a network of coaches or HR/L&D people who'd pilot this, that's gold.

---

## 9. How we'll work together (remote)

### Branching & PRs

- **`main` is production.** Never push directly.
- Feature branches: `feature/<name>`, fixes: `fix/<name>`, docs: `docs/<name>`.
- All work lands via a PR. CI must be green before merge (Lint & Type Check, Tests, Build).
- Squash-merge is the default.
- Pre-commit hooks (Husky) run Prettier + ESLint on staged files — they'll fix most formatting automatically.

### Prisma coordination

- **Schema changes are the one thing we have to coordinate manually.** Two devs running `prisma migrate dev` in parallel will produce conflicting migration files.
- Announce schema changes before starting. One person at a time. Commit the migration immediately so the other can pull.
- After pulling someone else's migration: `npx prisma migrate dev` to apply locally.

### Vercel env vars

- **Never use `echo` to pipe into `vercel env add` — it adds a trailing newline and corrupts the value.** Use `printf '%s' 'value' | vercel env add NAME env`. (This bit us once already; documented in `CONTRIBUTING.md`.)
- Whenever you add an env var: add to `.env.example` + your local `.env` + Vercel (printf) + tell the other person.

### Communication

- **Slack/iMessage for synchronous** (timeline questions, urgent issues, "is this thing on")
- **GitHub PR comments for code review** (so it's durable and discoverable)
- **GitHub Issues for bugs and feature requests** (currently zero open — let's keep it tidy)
- **`docs/` folder for any non-trivial decision** (roadmap, design specs, expert reviews, this doc)

### Marc's working setup

- Marc is doing a lot of dev with Claude Code (the CLI) as his daily-driver coding partner. There's a `_session.md` file at the project root that tracks active multi-step work — feel free to read it for context but don't edit (it's overwritten frequently).
- There's a `CLAUDE.md` at the project root that gives Claude project-specific context. It's also useful for humans as a quick-reference.

### Test data & secrets

- `npm run seed:comprehensive` gives you realistic test data.
- Secrets live in `.env` (local) and Vercel project env vars (prod). Ask Marc for the current values; not in git.
- Test users can be cleaned with `npm run delete:test-users`.

### Code review norms

- **Substantive over stylistic** — pre-commit hooks already handle formatting; reviewers should focus on logic, security, UX, edge cases.
- **Squash + clean commit message** at merge time. The merge message is what shows up in `main`'s history.
- **Migration PRs reviewed faster** — they're harder to revert.

---

## 10. Open questions for you, Kieran

1. **Time commitment** — what's a realistic weekly hour expectation from your side? Drives what we plan together.
2. **Areas of interest** — anything in §8 jump out, or is there something else you'd rather own?
3. **Org-level perms** — willing to make Marc an Owner of `Advance-Layer-Labs`? (See §6.D.)
4. **Decision style** — for non-trivial calls (new features, schema changes, vendor swaps), do you want sign-off, async update, or full delegation to Marc?
5. **Customer pipeline** — do you have anyone in your network we should be pitching for the real-world testing phase?

---

## 11. Quick-start checklist

If you want to jump in this week:

- [ ] Clone the repo, get the dev server running locally (§4)
- [ ] Read `docs/roadmap.md` to see what's shipped vs. what's deferred
- [ ] Fix the Vercel auto-deploy install (§6.B) — fastest win, takes 30 seconds
- [ ] Walk through one Individual JTBD (§3) end-to-end on `app.forbetra.com` as a synthetic user; share friction notes
- [ ] Reply to this doc with answers to §10

Welcome back. Looking forward to it.

— Marc
