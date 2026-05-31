# Forbetra — Product Overview for Audio Generation

## What is Forbetra?

Forbetra is a real-time 360 coaching platform. It combines structured weekly self-reflection with continuous stakeholder feedback, AI-synthesized insights, and coach-facing intelligence. The name comes from the Icelandic word "forbetra" meaning "to improve."

The platform serves four user roles: individuals (the person being coached), coaches (who guide development), stakeholders (peers, managers, and reports who provide 360 feedback), and organizations (enterprise administrators).

## The Problem Forbetra Solves

Executive coaching today runs on conversations and gut feel. Between sessions, coaches have no real-time data about their clients. The individuals being coached forget what they committed to within days. And the people who work with them every day — their managers, their peers, their direct reports — are never systematically asked what they observe.

This creates three problems. First, coaching sessions start cold. The coach spends the first fifteen minutes just getting caught up on what happened since last time. Second, individuals lose accountability between sessions. There's no daily or weekly mechanism to keep their development goal front-of-mind. Third, the most valuable perspective — how others experience you — is gathered once a year in a formal 360 review, if at all.

Forbetra closes these gaps by creating a continuous feedback loop that runs itself.

## How It Works — The Core Loop

The system is built around a simple weekly rhythm.

### Step 1: The Individual Checks In

Every week, the individual opens Forbetra and rates two things on a zero to ten scale: their effort (how hard they worked toward their goal) and their performance (how well they executed). This takes sixty seconds. They can optionally add notes about what happened that week.

Over time, these check-ins create a rich dataset of self-perception. The individual can see their effort trending up while performance stays flat — a signal they might be working hard on the wrong things. Or they can see both metrics climbing together, which validates their approach.

### Step 2: Stakeholders Give Feedback

The people around the individual — typically three to five of them — receive a feedback request via email. They click a link (no login required), rate the individual's effort and performance from their perspective, and optionally share a specific behavioral observation or suggestion. This also takes about sixty seconds.

The feedback is anonymous in aggregate but attributed to individual stakeholders so the coach can see patterns. For example, a manager might consistently rate performance higher than a peer does, which tells the coach something about how the individual shows up differently in different contexts.

### Step 3: AI Synthesizes Patterns

Every week, Forbetra's AI engine (powered by Anthropic's Claude) analyzes the accumulated data and generates insights. It looks at the trend in self-ratings, compares them to stakeholder ratings, identifies perception gaps, and writes a narrative synthesis.

The key insight the AI provides is the perception gap — the difference between how you see yourself and how others see you. If you rate your effort at eight out of ten but your stakeholders average five, that's a significant blind spot. If your stakeholders rate your performance higher than you do, that might mean you're too hard on yourself and your coach can help you calibrate.

The AI also generates a weekly behavioral experiment — one specific, small thing the individual can try in the coming week. Not abstract advice like "be a better communicator" but concrete experiments like "in your next team meeting, ask a question before sharing your opinion and notice how the conversation changes."

### Step 4: The Coach Prepares

Before every coaching session, the coach opens their session prep view. Forbetra generates an AI briefing that includes the client's recent trends, stakeholder feedback patterns, stability scores (how consistent the client has been), perception gaps, and suggested conversation topics.

The coach walks into every session with data. They know if the client's effort dropped this week, if a stakeholder flagged a specific behavior, or if the perception gap is closing. This transforms coaching from reactive conversation to data-informed guidance.

### The Flywheel

This creates a self-reinforcing loop. The individual checks in, which gives stakeholders context for their feedback, which gives the AI data to analyze, which gives the coach intelligence for the session, which helps the individual grow, which the stakeholders notice, which makes them more likely to keep giving feedback.

Every participant in the loop gets value. The individual gets accountability and self-awareness. The stakeholder feels heard and sees their feedback making a difference. The coach gets intelligence that makes them better at their job. And the AI gets smarter with every data point.

## What the Individual Sees

When an individual opens Forbetra, they see one screen with three clear signals.

The first signal is their effort trend. A large number shows their average effort score, with an indicator showing whether it's trending up, down, or holding steady. Below that, a single line tells them how their reviewers rate their effort compared to how they rate themselves. For example: "Reviewers rate your effort 1.2 points lower than you."

The second signal is their performance trend, structured identically. Average score, trend direction, and reviewer comparison.

The third signal is the perception gap — a summary card titled "How Others See You" that shows the effort gap and performance gap as simple numbers. If the gaps are small (less than half a point), it says "Aligned" in green. If there's a significant gap, it's highlighted in amber with a contextual interpretation. For example: "You rate your performance higher than your reviewers do. Dig deeper in your next session."

Below these three signals, there's a teaser of the latest AI insight and links to dig deeper into full insights, charts, reviewer feedback, and the AI chat feature.

The design philosophy is: answer the three questions that matter first, and let everything else be one tap away for people who want it.

## What the Coach Sees

The coach dashboard shows their full client roster at a glance. Each client card shows their current objective, cycle progress, completion rate, and any alerts (overdue check-ins, declining trends, large perception gaps).

The most powerful feature is the session prep view. The coach clicks into a client and sees their trend chart (effort and performance over time, with reviewer averages overlaid), recent check-in data, stakeholder feedback trends, and coach notes from previous sessions. They can hit "Generate Prep" and watch AI-generated coaching preparation stream in real time — it takes about thirty seconds and produces a comprehensive briefing.

The analytics view shows cross-portfolio trends. The coach can see which clients are consistent, who's improving fastest, who has the highest alert count, and export everything to CSV for reporting.

When onboarding a new client, the coach can pre-fill the client's development goal, focus areas, and suggested reviewers. The client signs up and finds their onboarding already populated — they just review and confirm.

## What Makes It Different

Three things distinguish Forbetra from traditional coaching tools and 360 feedback platforms.

First, it's continuous, not episodic. Traditional 360 reviews happen once or twice a year. Forbetra collects stakeholder feedback every week. This means the individual can see their perception gap closing in real time, not waiting six months to find out if anything changed.

Second, the AI layer turns raw data into actionable intelligence. Most coaching platforms are data collection tools — they show you charts and let you draw your own conclusions. Forbetra interprets the patterns and tells you what they mean, what to focus on, and what to try next.

Third, it's designed for the sixty-second attention span. Every interaction in the platform — checking in, giving feedback, reviewing insights — is designed to take sixty seconds or less. This isn't a tool that requires training or onboarding workshops. It's simple enough that a busy executive can use it between meetings.

## The Technology

Forbetra is built with SvelteKit and TypeScript on the frontend, Prisma and PostgreSQL (hosted on Neon) for the database, Clerk for authentication, and Anthropic's Claude for AI insights. It's deployed on Vercel with seven automated cron jobs that handle reminders, insight generation, and stakeholder engagement.

The AI uses Claude's latest model to generate check-in insights, weekly synthesis reports, coach preparation briefings, and an "Ask Your Data" chat feature where individuals can have a conversation grounded in their actual coaching data. All AI outputs stream in real time so the user sees sections appearing as they're generated.

## Who It's For

Forbetra works for any context where someone is trying to improve and has people around them who can observe their progress.

For executive coaches, it transforms their practice from conversation-based to data-informed. They spend less time gathering context and more time coaching.

For individual leaders, it creates a weekly rhythm of self-reflection that compounds over time. The effort-performance framework is simple enough to use consistently but rich enough to reveal real patterns.

For athletes and sport coaches, the effort-performance gap is directly applicable. High effort with flat performance often signals overtraining. Rising performance with steady effort signals a peak. The coach can use the data to adjust training load and timing.

For HR leaders and corporate sponsors, it provides visibility into coaching program effectiveness across the organization. Are participants engaging? Are they improving? Which coaches are getting the best outcomes? All sortable, all exportable.

## Current Status

Forbetra is live at app.forbetra.com and currently in use with coaching clients. The platform has completed three tiers of its product roadmap:

Tier 1 (ship-blocking fundamentals) is complete — including the core coaching flow, onboarding, and cycle management.

Tier 2 (competitive differentiation) is complete — including the restructured individual hub, streaming AI insights, coach session prep, stakeholder engagement loop, milestone celebrations, and organization management.

Tier 3 (best-in-class features) is complete — including the AI chat feature, coach analytics dashboard, structured stakeholder prompts, reflection history, and enterprise readiness.

A fourth tier focused on market expansion (stakeholder-to-user conversion, shareable LinkedIn reports, coach referral program, and cohort management) is planned but not yet started.

## The Vision

The long-term vision for Forbetra is to become the operating system for human development. Not just coaching, but any context where people are trying to grow and the people around them can help. The continuous feedback loop — self-reflection, stakeholder input, AI synthesis, expert guidance — is a pattern that scales across coaching, mentoring, performance management, team development, and education.

The product grows itself through the people it serves. Every stakeholder who gives feedback is a potential user. Every shared cycle report is a brand impression. Every coach who uses it tells other coaches. The flywheel that works inside the product also works for growing the business.
