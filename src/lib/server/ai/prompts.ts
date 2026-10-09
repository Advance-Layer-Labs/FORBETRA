/**
 * AI Prompt Templates for Forbetra Insights
 *
 * Three prompt builders that inject domain data for meaningful,
 * specific developmental feedback.
 */

const SYSTEM_MESSAGE = `You are a developmental psychology expert embedded in Forbetra, a personal growth platform. Your role is to provide specific, pattern-based observations that help individuals grow.

Core principles:
- Be SPECIFIC. Reference actual scores, trends, and patterns. Never say "great job" without pointing to what was great.
- Be DIRECT but warm. Speak like a trusted advisor, not a cheerleader.
- Focus on PATTERNS, not single data points. Look for trends across weeks.
- Name the GAP between effort and performance when it exists. This is often the most valuable insight.
- Reference reviewer feedback alignment/misalignment when available.
- Never use generic coaching platitudes like "keep going" or "believe in yourself."
- Ground observations in performance psychology: identity, deliberate practice, feedback loops, energy management.

CRITICAL: Every insight you generate MUST end with a specific, behavioral action the person can take THIS WEEK. Not "consider improving delegation" but "this week, identify one decision you currently make alone and ask your team lead to own it instead." The action must be:
1. Specific enough to visualize doing it
2. Small enough to do this week
3. Connected to the data patterns you just described
4. Phrased as an experiment, not a mandate ("Try..." or "This week, experiment with...")

Respond in plain text with markdown formatting. Keep responses concise and actionable.`;

type WeekScore = {
	weekNumber: number;
	effort: number | null;
	performance: number | null;
};

type ReviewerWeekScore = {
	weekNumber: number;
	reviewerName: string;
	effort: number | null;
	performance: number | null;
	behavioralObservation?: string | null;
	suggestion?: string | null;
};

export type CheckInContext = {
	goalTitle: string;
	focusAreas: string[];
	currentWeek: number;
	thisWeekScores: { effort: number | null; performance: number | null };
	last3Weeks: WeekScore[];
	reviewerFeedback: ReviewerWeekScore[];
	weeklyPromptTopic: string;
};

export type WeeklySynthesisContext = {
	goalTitle: string;
	focusAreas: string[];
	currentWeek: number;
	identityAnchor: string | null;
	thisWeekCheckIns: Array<{
		label: string;
		effort: number | null;
		performance: number | null;
		notes: string | null;
	}>;
	last3Weeks: WeekScore[];
	reviewerFeedback: ReviewerWeekScore[];
	coachNotes: string[];
};

export type CoachPrepContext = {
	individualName: string;
	goalTitle: string;
	last4Weeks: WeekScore[];
	reviewerFeedback: ReviewerWeekScore[];
	reviewerGapTrend: Array<{ weekNumber: number; effortGap: number; performanceGap: number }>;
	stabilityScore: number | null;
	coachNotes: string[];
	alerts: string[];
};

export function buildCheckInPrompt(context: CheckInContext): string {
	const trendLines = context.last3Weeks
		.map(
			(w) =>
				`  Week ${w.weekNumber}: Effort ${w.effort ?? '--'}, Performance ${w.performance ?? '--'}`
		)
		.join('\n');

	const reviewerLines =
		context.reviewerFeedback.length > 0
			? context.reviewerFeedback
					.map((s) => {
						let line = `  ${s.reviewerName}: Effort ${s.effort ?? '--'}, Performance ${s.performance ?? '--'}`;
						if (s.behavioralObservation) line += `\n    Observation: "${s.behavioralObservation}"`;
						if (s.suggestion) line += `\n    Suggestion: "${s.suggestion}"`;
						return line;
					})
					.join('\n')
			: '  No reviewer feedback for this week yet.';

	return `## Check-In Insight Request

**Goal**: ${context.goalTitle}
**Focus areas (context only, not scored)**: ${context.focusAreas.join(', ') || 'None'}
**Current Week**: ${context.currentWeek} (Topic: ${context.weeklyPromptTopic})

**This Week's Self-Scores**:
  Effort: ${context.thisWeekScores.effort ?? 'Not submitted'}
  Performance: ${context.thisWeekScores.performance ?? 'Not submitted'}

**Last 3 Weeks Trend**:
${trendLines || '  No prior data.'}

**Reviewer Feedback (this week)**:
${reviewerLines}

---

Provide a 2-3 sentence developmental observation. Be specific about the pattern you see. If there's an effort-performance gap, name it and explain what it might mean at this stage of their journey. Reference the weekly theme (${context.weeklyPromptTopic}) if relevant. End with a specific behavioral experiment they can try this week — something concrete enough to visualize doing it.`;
}

export function buildWeeklySynthesisPrompt(context: WeeklySynthesisContext): string {
	const checkInLines = context.thisWeekCheckIns
		.map(
			(r) =>
				`  ${r.label}: Effort ${r.effort ?? '--'}, Performance ${r.performance ?? '--'}${r.notes ? ` | Notes: "${r.notes}"` : ''}`
		)
		.join('\n');

	const trendLines = context.last3Weeks
		.map(
			(w) =>
				`  Week ${w.weekNumber}: Effort ${w.effort ?? '--'}, Performance ${w.performance ?? '--'}`
		)
		.join('\n');

	const reviewerLines =
		context.reviewerFeedback.length > 0
			? context.reviewerFeedback
					.map((s) => {
						let line = `  ${s.reviewerName} (Week ${s.weekNumber}): Effort ${s.effort ?? '--'}, Performance ${s.performance ?? '--'}`;
						if (s.behavioralObservation) line += `\n    Observation: "${s.behavioralObservation}"`;
						if (s.suggestion) line += `\n    Suggestion: "${s.suggestion}"`;
						return line;
					})
					.join('\n')
			: '  No reviewer feedback this week.';

	const coachNoteLines =
		context.coachNotes.length > 0
			? context.coachNotes.map((n) => `  - "${n}"`).join('\n')
			: '  No coach notes this week.';

	const identityLine = context.identityAnchor
		? `**Identity Anchor**: "${context.identityAnchor}"`
		: '**Identity Anchor**: Not yet set';

	return `## Weekly Synthesis Request

**Goal**: ${context.goalTitle}
**Focus areas (context only, not scored)**: ${context.focusAreas.join(', ') || 'None'}
**Week**: ${context.currentWeek}
${identityLine}

**This Week's Check-ins**:
${checkInLines || '  No check-ins submitted.'}

**Previous 3 Weeks Trend**:
${trendLines || '  No prior data.'}

**Reviewer Feedback**:
${reviewerLines}

**Coach Notes**:
${coachNoteLines}

---

Begin your synthesis by referencing the person's identity anchor (who they said they are becoming in Week 1). Connect this week's patterns to that identity. Example: "You said you're becoming a leader who trusts their team. This week's data suggests [specific pattern]."

Provide a 3-5 sentence synthesis that includes:
1. **Identity connection** — link this week's data to who they are becoming
2. **Key observation** about this week's data
3. **Effort-performance gap analysis** (if applicable)
4. **Reviewer alignment note** (do others see what the individual sees?)
5. **One specific behavioral experiment** for next week (concrete enough to visualize doing it)

Be concrete. Use numbers. Name patterns.

After your synthesis, add one final line in exactly this format:
ACTION: [A single concrete behavioral action for this week. Start with a verb. Be specific enough to act on today.]`;
}

export type CycleReportContext = {
	goalTitle: string;
	focusAreas: string[];
	cycleStartDate: string;
	currentWeek: number;
	totalWeeks: number;
	identityAnchor: string | null;
	weeklyScores: WeekScore[];
	reviewerFeedback: ReviewerWeekScore[];
	perceptionGaps: Array<{
		reviewerName: string;
		latestEffortGap: number | null;
		latestPerformanceGap: number | null;
		effortGapTrend: 'widening' | 'closing' | 'stable' | null;
		performanceGapTrend: 'widening' | 'closing' | 'stable' | null;
	}>;
	stabilityScore: number | null;
	trajectoryScore: number | null;
	completionRate: number | null;
	alignmentRatio: number | null;
	coachNotes: string[];
};

export function buildCycleReportPrompt(context: CycleReportContext): string {
	const weekLines = context.weeklyScores
		.map(
			(w) =>
				`  Week ${w.weekNumber}: Effort ${w.effort ?? '--'}, Performance ${w.performance ?? '--'}`
		)
		.join('\n');

	const reviewerLines =
		context.reviewerFeedback.length > 0
			? context.reviewerFeedback
					.map(
						(s) =>
							`  ${s.reviewerName} (Week ${s.weekNumber}): Effort ${s.effort ?? '--'}, Performance ${s.performance ?? '--'}`
					)
					.join('\n')
			: '  No reviewer feedback available.';

	const gapLines =
		context.perceptionGaps.length > 0
			? context.perceptionGaps
					.map((g) => {
						const parts = [`  ${g.reviewerName}:`];
						if (g.latestEffortGap !== null)
							parts.push(
								`Effort gap ${g.latestEffortGap > 0 ? '+' : ''}${g.latestEffortGap.toFixed(1)} (${g.effortGapTrend ?? 'unknown'})`
							);
						if (g.latestPerformanceGap !== null)
							parts.push(
								`Performance gap ${g.latestPerformanceGap > 0 ? '+' : ''}${g.latestPerformanceGap.toFixed(1)} (${g.performanceGapTrend ?? 'unknown'})`
							);
						return parts.join(' ');
					})
					.join('\n')
			: '  No perception gap data available.';

	const coachNoteLines =
		context.coachNotes.length > 0
			? context.coachNotes.map((n) => `  - "${n}"`).join('\n')
			: '  No coach notes.';

	const identityLine = context.identityAnchor
		? `**Identity Anchor**: "${context.identityAnchor}"`
		: '**Identity Anchor**: Not set';

	return `## Journey Performance Report Request

**Goal**: ${context.goalTitle}
**Focus areas (context only, not scored)**: ${context.focusAreas.join(', ') || 'None'}
**Journey Start**: ${context.cycleStartDate}
**Current Week**: ${context.currentWeek} of ${context.totalWeeks}
${identityLine}
**Key Metrics**:
  Stability: ${context.stabilityScore !== null ? `${context.stabilityScore}/100` : 'N/A'}
  Trajectory: ${context.trajectoryScore !== null ? `${context.trajectoryScore}` : 'N/A'}
  Completion Rate: ${context.completionRate !== null ? `${context.completionRate}%` : 'N/A'}
  Reviewer Alignment: ${context.alignmentRatio !== null ? `${context.alignmentRatio}%` : 'N/A'}

**Weekly Self-Scores (Full Journey)**:
${weekLines || '  No data.'}

**Reviewer Feedback (Full Journey)**:
${reviewerLines}

**Perception Gaps (Self - Reviewer)**:
${gapLines}

**Coach Notes**:
${coachNoteLines}

---

Write a comprehensive developmental performance report. Use ## markdown headers for each section. Include exactly these six sections:

If an identity anchor is provided, open the report with: "X weeks ago, you said you were becoming [identity anchor]. Here's what the data shows about that journey."

## Executive Summary
2-3 sentences. State where this individual stands relative to their goal and overall trajectory. Reference specific metrics.

## Progress Trajectory
Analyze the evolution of effort and performance scores across the full journey. Identify inflection points, plateaus, or acceleration. Reference specific weeks.

## Perception Analysis
Name each reviewer. Describe the direction and trend of their perception gap (effort and performance). Note where alignment is strong and where it diverges.

## Key Strengths
2-3 data-backed strengths. Each must reference specific patterns, scores, or trends from the data.

## Growth Opportunities
2-3 areas for development. Ground each in specific data patterns — not generic advice.

## Recommendations
Exactly 3 concrete, actionable recommendations. Each must tie directly to a finding from the analysis above. Each recommendation must include a specific behavioral experiment — something concrete enough to visualize doing it this week (e.g. "In your next 1:1, ask your direct report: 'What's one decision I should hand off to you?'").

## Shareable Takeaway
A single sentence under 140 characters that captures the most important insight from this journey. It should be specific to this person's data, not generic. Write it in first person. Example: "I discovered my team sees my delegation as 40% less effective than I thought — and closing that gap changed how I lead."`;
}

export function buildCoachPrepPrompt(context: CoachPrepContext): string {
	const weekLines = context.last4Weeks
		.map(
			(w) =>
				`  Week ${w.weekNumber}: Effort ${w.effort ?? '--'}, Performance ${w.performance ?? '--'}`
		)
		.join('\n');

	const reviewerLines =
		context.reviewerFeedback.length > 0
			? context.reviewerFeedback
					.map(
						(s) =>
							`  ${s.reviewerName} (Week ${s.weekNumber}): Effort ${s.effort ?? '--'}, Performance ${s.performance ?? '--'}`
					)
					.join('\n')
			: '  No recent reviewer feedback.';

	const gapLines =
		context.reviewerGapTrend.length > 0
			? context.reviewerGapTrend
					.map(
						(g) =>
							`  Week ${g.weekNumber}: Effort gap ${g.effortGap > 0 ? '+' : ''}${g.effortGap.toFixed(1)}, Performance gap ${g.performanceGap > 0 ? '+' : ''}${g.performanceGap.toFixed(1)}`
					)
					.join('\n')
			: '  No gap data available.';

	const coachNoteLines =
		context.coachNotes.length > 0
			? context.coachNotes.map((n) => `  - "${n}"`).join('\n')
			: '  No recent coach notes.';

	const alertLines =
		context.alerts.length > 0
			? context.alerts.map((a) => `  - ${a}`).join('\n')
			: '  No active alerts.';

	return `## Coach Prep Briefing Request

**Individual**: ${context.individualName}
**Goal**: ${context.goalTitle}
**Stability Score**: ${context.stabilityScore !== null ? `${context.stabilityScore}/100` : 'N/A'}

**Last 4 Weeks Self-Scores**:
${weekLines || '  No data.'}

**Reviewer Feedback (last 4 weeks)**:
${reviewerLines}

**Self-Other Gap Trend**:
${gapLines}

**Recent Coach Notes**:
${coachNoteLines}

**Active Alerts**:
${alertLines}

---

Provide a structured coach prep briefing:
1. **Headline** (1 sentence summary of where this client is)
2. **Key data points** (3-4 bullet points of notable patterns)
3. **Suggested conversation starters** (2-3 questions the coach could ask)
4. **Behavioral experiments to propose** (2-3 specific, small experiments the coach can suggest to the client for the coming week — each must be concrete enough to visualize doing it, e.g. "In your next team meeting, try waiting 10 seconds after asking a question before filling the silence")
5. **Risk flags** (anything concerning that needs attention)

Be specific and actionable. The coach needs to walk into a session prepared.`;
}

export { SYSTEM_MESSAGE };
