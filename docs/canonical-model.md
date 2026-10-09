# Forbetra — Canonical Model & Vocabulary

_Source of truth for what Forbetra is, how the core loop works, and what every
concept is called at every layer. Written to end the "the UI says one thing, the
backend says another" class of confusion (e.g. the measures/subgoals bug) and to
anchor the backend rebuild against a shared target._

Status: **draft for Kieran + Marc to ratify.** Recommendations are marked; open
questions are collected at the end.

---

## 1. First principles — what Forbetra is

Forbetra surfaces the **gap between how you see yourself and how others see you**,
on a repeating rhythm, and helps you close it.

- The moat is **nebulous / ambiguous development goals** — things with no natural
  KPI ("have better executive presence", "be more aggressive on the field").
  Anything with a hard metric doesn't need Forbetra; a spreadsheet does.
- **Perception _is_ the measurement.** For goals that can't be measured
  objectively, Forbetra doesn't pretend to capture ground-truth performance — it
  measures **structured perception**: two subjective 0–10 ratings (Effort +
  Performance) from the individual and from their reviewer(s), tracked over time.
  The delta between the two perspectives, and its movement across a Journey, is
  the product. This is the bridge from "we couldn't measure progress on soft
  goals" to "now we can."
- **It also answers "is the development working?"** Because everything is anchored
  to a baseline and tracked over time, Forbetra doubles as an **accountability /
  ROI layer for development spend** — evidence that coaching, training, or focused
  effort is actually producing change. This is a core reason the coach layer is
  first-class (see Q4) and why the org seam is kept (see Q6).
- Design philosophy: **streamlined, easy, intuitive by default; complexity is
  hidden and triggered** (surfaced only when a user's behavior calls for it),
  never front-loaded.

### Positioning language — internal vs. marketing

Keep these precise internally even if marketing softens them:

- **Internal (honest) framing:** we measure _perceived_ Effort and Performance,
  and the gap between perspectives — not objective performance.
- **Marketing framing:** "finally measure progress on the goals that matter most —
  and prove your development is working."

### Origin / positioning source (Marc's original site copy)

Preserved as the source of truth for _why_ Forbetra exists:

> Success shouldn't be an accident. We set goals, create plans, and measure
> performance but how can we really know we're improving?
>
> Technology is changing the world of goal-setting, but effectively measuring
> progress is something we still struggle with. Some goals, like target weight or
> total sales, are relatively easy and straightforward to measure, but other
> goals, like executive presence or competitiveness, are not.
>
> What makes matters even more challenging, is that our reputation (i.e., how
> others think we are doing) can be just as important as how we are actually
> performing.
>
> If, as is often the case, perception is reality, how do we find out what others
> are really thinking about us? Given the time and money we invest in coaching and
> development, how do we know we are getting a return on our investment?
>
> Before Forbetra, we couldn't. Now we can.

---

## 2. Ratified decisions

These are the decisions agreed so far. They define the target the backend rebuild
should match (front-end UI stays; backend is rebuilt to fit).

1. **Positioning:** lean into nebulous goals as the core use case.
2. **Focus Areas — Option C:** ratings stay **goal-level** for simplicity. Focus
   Areas are **optional** and act as **"what to look for" hints shown to both the
   individual and the reviewer(s)** — they translate a vague goal into observable
   facets so a reviewer can actually rate it. Focus Areas are **not** a separate
   scoring dimension.
   - _Triggered complexity:_ Focus Areas are not part of onboarding. If someone
     returns after about two weeks away and their active goal still has none,
     prompt them to add Focus Areas so the next check-in is clearer.
3. **Check-ins:** baseline **1× per week** (self), and the individual **may do
   multiple check-ins within the same week** (see Q1 — model as date/event-based
   with the week derived from the date).
4. **Reviewer feedback:** **1× per week** by default, with a **less-frequent
   option** (e.g. biweekly) allowed for low-engagement reviewers; never more than
   weekly (reviewer attention is the scarce resource — survey fatigue).
5. **Reveal scores:** **always ON.** Transparency is core to the product and
   enables organic individual↔reviewer conversations outside the app. The
   per-journey toggle is dropped; an org-level control is a future item (Q9).
6. **Journey length:** **12 weeks, flat, in onboarding** (no picker there). A
   small preset set (6 / 12 / 16) is offered only at **new-journey** time (Q2).
7. **Approach:** rebuild the backend to match the current UI; **reseed synthetic
   data** instead of migrating (no real users to protect).

---

## 3. The canonical loop (the spine)

```
Goal  →  (optional) Focus Areas  →  Journey  →  weekly Check-in (self)
                                              +  weekly Feedback (reviewer)
                                              →  the Gap  →  Insights  →  (optional) Coach
```

- **Goal** is the durable thing a person is working on. One active Goal at a time.
- **Focus Areas** are optional descriptive facets of the Goal, shown as hints to
  the individual and reviewers. Not rated.
- **Journey** is a time-boxed run at the Goal (default 12 weeks), containing a
  baseline rating (week 0) and the weekly beat.
- **Check-in** = the individual's own weekly Effort + Performance rating (+ note).
- **Feedback** = a reviewer's weekly Effort + Performance rating (+ note).
- **The Gap** between self and reviewer ratings, over time, is the core insight.
- **Insights** (AI) narrate the gap and trends. **Coach** is an optional support
  layer over the top.

### Data-model direction (implications of the above)

- A **Check-in** is _only_ the individual's self-rating. Drop the
  `RATING_A` / `RATING_B` type enum — with one weekly self check-in it is not
  needed.
- **Reviewer Feedback links directly to `(journey, week)`**, not to a placeholder
  self-reflection. This removes the current `RATING_B` "anchor" hack and its
  triple-overloading (legacy Friday rating / week-0 baseline / reviewer anchor).
- Because ratings are **goal-level** (Option C), Focus Areas do **not** need to be
  a reference on Check-in/Feedback. They attach to the Goal as descriptive hints.
- Collapse the many scattered schedule fields (`checkInFrequency`,
  `stakeholderCadence`, `reminderDays`, `notificationTime`) toward **one weekly
  cadence + per-user delivery preferences.**

---

## 4. Glossary & rename plan (unify backend + UI)

**Recommendation: unify vocabulary across every layer** — database model, code
identifiers, and all user-facing copy use the **same word**. The current
translation layer (UI word ≠ code word) is a standing source of confusion, and the
rebuild is the moment to erase it. The chosen word is the **UI word**, because
that is the product's language.

| Concept                    | Current DB/code                    | Current UI               | Also leaks as                                               | **Ratified name (all layers)**  |
| -------------------------- | ---------------------------------- | ------------------------ | ----------------------------------------------------------- | ------------------------------- |
| The thing you're improving | `Objective`                        | "Goal"                   | "Objective" (reviewer page, emails)                         | **Goal**                        |
| Optional observable facet  | `Subgoal`                          | "Focus Area"             | "sub-objective" (errors/validation), "measure" (onboarding) | **Focus Area** (`FocusArea`)    |
| A time-boxed run           | `Cycle`                            | "Journey"                | "Cycle" / "Cycle 1" (fallback labels, admin)                | **Journey**                     |
| Individual's weekly rating | `Reflection`                       | "Check-in"               | "reflection(s)" (SMS/email), "rating"                       | **Check-in** (`CheckIn`)        |
| Person who rates you       | `Stakeholder`                      | "Reviewer"               | "stakeholder" (terms page, copy)                            | **Reviewer**                    |
| A reviewer's submission    | `Feedback`                         | "Feedback"               | —                                                           | **Feedback** (keep)             |
| The two score dimensions   | `effortScore` / `performanceScore` | "Effort" / "Performance" | —                                                           | **Effort / Performance** (keep) |
| Check-in type enum         | `RATING_A` / `RATING_B`            | (none)                   | "Wednesday/Friday check-in" (reminders)                     | **eliminate** (single check-in) |

### Why each word was chosen

For most of these the choice was not inventing a word, but picking the **single
winner among names that already exist** in the product. Where there was a genuine
choice, the rule was: **plainest everyday word → best fit for the nebulous-goal,
low-friction philosophy → already present in the UI.** We deliberately avoided
coining new vocabulary, since that would add a fourth name to concepts that already
have too many.

- **Goal** (over `Objective`): plain everyday language vs. corporate/OKR jargon;
  fits nebulous _personal_ development. Already the UI word. ("Objective" only
  paired nicely with "sub-objective," and we're removing that term anyway.)
- **Focus Area** (over `Subgoal` / "measure"): the only honest option under
  Option C — these are not goals-within-goals (so not "subgoal") and not metrics
  (so not "measure," which implies quantification and fights the nebulous moat).
  "Focus Area" = "a facet to pay attention to," exactly what they now are, and it
  reads clearly for reviewers. This is the priority pick because the naming itself
  was the bug.
- **Journey** (over `Cycle`): implies a beginning → progress → end (matches a
  12-week arc with a baseline and finish) and supports the "end feels like a
  milestone" goal; "Cycle" is mechanical and sounds endless. Softest / most
  marketing-flavored pick — `Cycle` is the defensible fallback if preferred, but
  then use it everywhere.
- **Check-in** (over `Reflection`): names the quick action you _do_, not an
  abstract heavy activity — important because we want this behavior to be
  frequent. Pairs cleanly with reviewers' "Feedback" (a role split). Already
  dominant in the newer UI.
- **Reviewer** (over `Stakeholder`): describes what the person actually does, in
  non-corporate language; lower barrier for an outside party doing a 60-second
  favor. Already the UI word. Watch: mild judgment connotation — "Observer" /
  "Feedback partner" are wordier alternatives if "Reviewer" ever feels harsh.
- **Feedback / Effort / Performance** (kept): already consistent across every
  layer and plain English; changing them would be churn for no gain. "Feedback"
  also pairs cleanly with "Reviewer."
- **`RATING_A` / `RATING_B` eliminated:** not a rename but a modeling decision —
  they encode the abandoned twice-weekly split, are meaningless under one weekly
  check-in, and leak to users as "Wednesday/Friday check-in."

**Gut-check flags for ratification:** _Journey_ (softest) and _Reviewer_ (mild
judgment connotation) are the two most worth a second look before locking in.

Notes:

- **Focus Area is the priority fix.** It currently has three names (`Subgoal`,
  "Focus Area", "measure"), and that triple-naming is exactly what let the
  onboarding data-linking bug hide. Collapse to **Focus Area** everywhere.
- Model renames (`Objective→Goal`, `Subgoal→FocusArea`, `Cycle→Journey`,
  `Reflection→CheckIn`, `Stakeholder→Reviewer`) carry refactor cost but are
  low-risk given synthetic-only data, and permanently kill this confusion class.
- **Decide the admin/coach vocabulary on purpose** (open question below): either
  everything speaks the unified vocabulary, or admin/coach may keep raw terms for
  an expert audience. Today it is accidentally mixed.

### Immediate low-risk sweep (independent of the model rename)

Even before any schema work, these **user-facing strings** should be corrected to
the ratified vocabulary:

- "No sub-objectives found…" → "No focus areas…" (`individual/checkin`,
  `individual/+page.server.ts`)
- "Objective, cycle, or sub-objectives not found." → "Goal, journey, or focus
  areas not found." (`onboarding/initial-ratings`)
- "Add a sub-objective before requesting feedback." (`individual/stakeholders`)
- Validation messages in `lib/validation/reflection.ts` and
  `lib/validation/onboarding.ts` ("Sub-objective …").
- "Objective:" label + email copy shown to reviewers → "Goal:"
  (`stakeholder/feedback/[token]`, `lib/notifications/emailTemplates.ts`).
- "overdue reflections" / "first reflection" → "check-ins"
  (`lib/notifications/smsTemplates.ts`, `emailTemplates.ts`).
- Journey label fallbacks: standardize `'Cycle'` / `'Cycle 1'` →
  `'Journey'` / `'Journey 1'` (`individual/checkin`, `initial-ratings`).
- Retire "Wednesday/Friday check-in" + `?type=RATING_A/RATING_B` reminder copy
  (also part of the check-in-model cleanup).

---

## 5. Focus Areas stay out of onboarding

Onboarding is one screen: name the goal, then land on the journey board. Focus
Areas are not collected there.

They remain optional hints on the goal (not a scoring dimension). The product
asks for them only as a fallback: when someone returns after about two weeks
away and the active goal still has none. That prompt can be dismissed. Adding
them persists `FocusArea` rows on the goal and clears the prompt. Check-in and
reviewer screens keep showing them as hints when they exist.

AI suggestions still come from the goal title (`/api/onboarding/suggest-focusAreas`
→ `lib/server/ai/suggestSubgoals.ts`) and are offered on that later form, not
during first-run setup.

---

## 6. Open questions — with recommended direction

Each question now has a **Direction** reflecting Kieran's calls (pending Marc's
final ratification). Where useful, the direction refines the raw answer with an
implementation note.

1. **"More than 1× / week" check-ins:** does "more" mean rating again within the
   same week, or simply optional extra reflection?
   - **Direction:** Yes — the individual can do **multiple check-ins within the
     same week.** Implication: model check-ins as **date/event-based** (each a
     timestamped row) with the week _derived_ from the date, rather than one row
     per week. For the self-vs-reviewer gap, represent the week by the
     individual's **average of their check-ins in that week** (Effort and
     Performance averaged independently), compared against the reviewer's single
     weekly rating. The underlying check-ins can still be shown as individual
     points on the trend, with the weekly average as the value used for the gap.
     Streaks/compliance count as "≥ 1 check-in in the week."
2. **Journey length exposure:** expose a preset picker in onboarding, or keep
   onboarding flat?
   - **Direction:** **Do not expose a length picker in onboarding — onboarding is
     a flat 12 weeks.** Keep the preset picker (6 / 12 / 16) available only at
     **new-journey** time, for users starting a subsequent journey.
3. **Reviewer cadence:** allow a _less_ frequent option, or keep strictly weekly?
   - **Direction:** **Allow a less-frequent option** (e.g. weekly / biweekly) for
     low-engagement reviewers — "take what we can get." Default weekly; never more
     than weekly.
4. **Coaching scope:** core to v1 or add-on?
   - **Direction:** **Core to v1 — rebuild the coach layer fully now.**
5. **Can a Coach also be a Reviewer for an Individual?**
   - **Direction:** **Yes.** Recommendation for the sub-decision: record the
     coach's submission as a normal Reviewer **Feedback**, but **attributed to the
     coach role** so it (a) contributes to the gap like any reviewer and (b) stays
     visually distinguishable, letting the scorecard optionally separate "coach
     view" from "peer/manager view." Count the coach **once** as a reviewer (no
     double-counting). Role-model implication: a single person may hold **both** a
     Coach and a Reviewer relationship to the same individual — the rebuilt
     identity model must allow that.
6. **Org tier:** keep the seam or cut it?
   - **Direction:** **Keep the seam.** Leave `Organization` /
     `OrganizationMember` in place (dormant) for a future team/org offering; don't
     build org features now, but don't rip out the models.
7. **Model rename timing:** rename now or defer?
   - **Direction:** **Rename now**, as part of the rebuild — unify DB/code/UI to
     the ratified vocabulary in §4. Higher upfront effort, but the right moment
     given synthetic-only data.
8. **Admin/coach vocabulary:** unify everywhere or keep raw terms for experts?
   - **Direction:** **Unify everywhere** — admin and coach surfaces speak the
     product vocabulary too. (Admin may still surface raw IDs/enums where needed
     for debugging, but the nouns match the glossary.)
9. **Reveal as constant vs. setting:** drop the toggle or keep a dormant column?
   - **Direction:** **Drop the per-journey toggle now** — reveal is always on.
     Park an **org-level reveal control** as a **future** item (ties to the org
     seam in #6), so organizations could one day set reveal policy for their
     members.
