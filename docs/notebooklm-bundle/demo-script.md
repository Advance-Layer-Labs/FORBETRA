# Forbetra Demo Script

**Duration**: 15-20 minutes
**Setup**: Run `npm run seed:comprehensive` before demo. Use admin impersonation to switch roles.

---

## Pre-Demo Setup

1. Open **app.forbetra.com** (or localhost:5173) in two browser windows
2. Log in as **admin** in Window 1
3. Navigate to `/admin/preview` — this is your role-switching cockpit
4. Have a phone or narrow browser ready for the stakeholder view

### Key Demo Users

| Role        | Name                  | Pattern                     | Why them                                     |
| ----------- | --------------------- | --------------------------- | -------------------------------------------- |
| Individual  | **Alex Rivera**       | Improving                   | Best story arc — clear upward trend          |
| Individual  | **Jamie Torres**      | Early stage                 | Active cycle, can do live check-in           |
| Coach       | **Dr. Elena Vasquez** | Manages Alex, Jordan, Casey | Portfolio with diverse patterns              |
| Stakeholder | (use preview)         | —                           | `/stakeholder/feedback/preview?preview=true` |

---

## Act 1: The Problem (1 min)

> "Coaching today runs on conversations and gut feel. Between sessions, coaches have no data. Clients forget what they committed to. And the people who work with them every day — their managers, peers, reports — are never asked what they actually observe."
>
> "Forbetra closes that loop."

---

## Act 2: The Individual Experience (5 min)

### Impersonate Alex Rivera

From `/admin/preview` → Individual lens → Select **Alex Rivera** → Click **Dashboard**

### 2a. The Hub (`/individual`)

**Click path**: You land on the Today tab.

> "This is what Alex sees every day. One question: what should you focus on this week? No clutter — just the next action."

- Point out the **streak badge** (top right) — "Alex has been consistent"
- Point out the **AI insight teaser** — "This was generated automatically from their data"
- Click the **Progress tab** — show the score cards and trend chart
- Click the **Scorecard tab** — show self vs reviewer comparison

> "Three views, one hub. Today for focus, Progress for trends, Scorecard for blind spots."

### 2b. Live Check-In (`/individual/checkin`)

**Click path**: Navigate to `/individual/checkin` (or click the CTA on Today tab)

> "This takes 60 seconds. Two scores — effort and performance — on a 0-10 scale."

- Select effort: **7**
- Select performance: **6**
- Optionally add a note
- **Submit**
- If a milestone toast appears: "See that? Forbetra celebrates consistency. At 3, 7, 14, 21 check-ins, they get a celebration email too."

### 2c. AI Insights (`/individual/insights`)

**Click path**: Navigate to `/individual/insights`

> "Now watch this."

- Click **Generate Report**
- **Pause and let streaming happen** — sections appear one by one

> "This is Claude analyzing 12 weeks of Alex's self-ratings, stakeholder feedback, and behavioral patterns. It's not generic advice — it's grounded in their actual data."

- Point out a specific insight (effort-performance gap, stakeholder perception, etc.)

### 2d. Ask Your Data (`/individual/ask`)

**Click path**: Navigate to `/individual/ask`

- Type: **"Where have I improved the most?"**
- Let it stream

> "This is a conversation with their own data. Not a chatbot — a mirror."

---

## Act 3: The Stakeholder Experience (3 min)

### Open Stakeholder Preview

**Click path**: Open `/stakeholder/feedback/preview?preview=true` in a narrow browser or phone

> "This is what a stakeholder sees. Their manager, a peer, a direct report — anyone the individual has invited."

- Show the **welcome screen** — explains context, sets expectations
- Click **Give Feedback**
- Rate effort: **8**, performance: **6**
- Show the **behavioral observation** field — expand it

> "This is new. Beyond scores, stakeholders can share specific behaviors they've observed and suggestions for improvement. This qualitative data feeds directly into the AI insights."

- Show the **reveal** after submission (if revealScores is on)

> "After submitting, they see how the individual rated themselves. This creates a shared language around growth."

**Key selling point**: "This takes 60 seconds. But it gives the individual a perspective they literally cannot see alone."

---

## Act 4: The Coach Experience (5 min)

### Impersonate Dr. Elena Vasquez

From `/admin/preview` → Coach lens → Select **Dr. Elena Vasquez** → Click **Dashboard**

### 4a. Coach Dashboard (`/coach`)

> "Elena manages three clients. At a glance she can see who needs attention."

- Point out **alerts** (overdue check-ins, declining trends)
- Point out **quick stats** (active clients, completion rates)

### 4b. Session Prep (`/coach/session/[Alex's ID]`)

**Click path**: Click into **Alex Rivera** from the roster or dashboard

> "Before every coaching session, Elena opens this view."

- Show the **trend chart** — effort vs performance over time
- Show **stakeholder feedback trends** — who's rating what
- Show **coach notes** — notes from past sessions
- Click **Generate Prep** — let it stream live

> "This is AI-generated session prep. It analyzes the last 4 weeks of data, identifies patterns, flags risks, and suggests conversation topics. Elena walks into every session with this."

- Point out specific prep content (stability score, gap trends, alerts)

### 4c. Analytics (`/coach/analytics`)

**Click path**: Navigate to `/coach/analytics`

> "Across her entire portfolio — who's consistent, who's improving, who needs intervention."

- Show the **client comparison table** (sortable by consistency, trajectory, alerts)
- Show **portfolio trends** (weekly averages across all clients)
- Mention **CSV export** for reporting

### 4d. Invitations (`/coach/invitations`)

**Click path**: Navigate to `/coach/invitations`

> "When Elena onboards a new client, she doesn't just send a link."

- Click into the invite form
- Expand **Pre-fill their setup**
- Fill in a goal title, a focus area, a suggested reviewer

> "The client signs up, and their onboarding is already pre-populated. They review, confirm, and they're off. Zero friction."

---

## Act 5: The System (2 min)

> "Behind the scenes, the system runs itself."

Tick these off verbally (don't demo each one):

- **Automated reminders** — Mon-Fri, adapts to each individual's check-in cadence
- **Stakeholder feedback requests** — automatic, weekly or biweekly
- **AI insights** — generated every Sunday night, coach prep every Monday morning
- **Milestone celebrations** — streak emails at 3, 7, 14, 21, 30, 50 check-ins
- **Monthly impact summaries** — stakeholders get a report showing their contribution
- **Organization model** — enterprise-ready with member management and domain-based assignment

---

## Act 6: The Flywheel (1 min)

> "Here's why this works."

Draw or describe the loop:

```
Individual checks in
    → Stakeholders give feedback
        → AI synthesizes patterns
            → Coach prepares with real data
                → Better coaching sessions
                    → Individual grows
                        → Stakeholders see change
                            → They keep giving feedback
```

> "Every participant in the loop gets value. The individual gets accountability. The stakeholder feels heard. The coach gets intelligence. And the AI gets smarter with every data point."
>
> "The loop closes itself."

---

## Troubleshooting

| Issue                     | Fix                                                         |
| ------------------------- | ----------------------------------------------------------- |
| No data showing           | Run `npm run seed:comprehensive`                            |
| Can't switch users        | Use `/admin/preview` impersonation                          |
| AI generation fails       | Check `ANTHROPIC_API_KEY` in env                            |
| Streaming doesn't work    | Ensure you're not behind a buffering proxy                  |
| Stakeholder preview blank | Use exact URL: `/stakeholder/feedback/preview?preview=true` |

---

## Audience-Specific Additions

### For Coaches

After Act 4, add: "Elena didn't build any of this. She invited her clients, and the platform handles the rest. Her job is to coach — the data comes to her."

### For Enterprise Buyers

After Act 5, add: "Organizations can manage all their coaches and clients under one umbrella. Domain-based auto-assignment, role management, and aggregate reporting across the entire coaching program."

### For Investors

After Act 6, add: "Every stakeholder who gives feedback is a potential user. Every shared cycle report is a brand impression. The product grows itself through the people it serves." Then reference Tier 4 growth plays.

### For Technical Reviewers

Add a quick architecture slide: "SvelteKit, Prisma on Neon Postgres, Clerk auth, Anthropic Claude for AI, Vercel for deployment. 7 automated cron jobs, streaming SSE for AI responses, rate-limited APIs with Redis."
