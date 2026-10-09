import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { computeCompletionMetrics, computeNextAction } from '$lib/server/hubMetrics';
import { submitCheckIn } from '../submitCheckIn.server';
import type { Actions, PageServerLoad } from './$types';

export type MaturityStage = 'new' | 'growing' | 'established';

function getMaturityStage(checkInCount: number): MaturityStage {
	if (checkInCount >= 12) return 'established';
	if (checkInCount >= 4) return 'growing';
	return 'new';
}

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const { goal, journey, currentWeek, checkIns, feedback: feedbacks } = await event.parent();

	const [hasAnyGoal, coachClient, latestInsight] = await Promise.all([
		prisma.goal.findFirst({
			where: { userId: dbUser.id },
			select: { id: true }
		}),
		prisma.coachClient.findFirst({
			where: { individualId: dbUser.id },
			select: { coach: { select: { name: true } } }
		}),
		journey
			? prisma.insight.findFirst({
					where: {
						userId: dbUser.id,
						journeyId: journey.id,
						status: 'COMPLETED',
						type: { in: ['CHECK_IN', 'WEEKLY_SYNTHESIS'] }
					},
					orderBy: { createdAt: 'desc' },
					select: { id: true, content: true, type: true, weekNumber: true, createdAt: true }
				})
			: null
	]);

	const isFirstVisit = !hasAnyGoal;
	const isOnboardingComplete = !!(goal && journey);

	const totalWeeks = journey.lengthWeeks;
	const summary = computeCompletionMetrics(checkIns, currentWeek);
	const nextAction = computeNextAction(checkIns, currentWeek);
	const maturityStage = getMaturityStage(checkIns.length);

	// Compute the three signals: effort trend, performance trend, perception gap
	const effortScores = checkIns
		.filter((r) => r.effortScore != null)
		.sort((a, b) => a.weekNumber - b.weekNumber)
		.map((r) => ({ week: r.weekNumber, score: r.effortScore! }));
	const perfScores = checkIns
		.filter((r) => r.performanceScore != null)
		.sort((a, b) => a.weekNumber - b.weekNumber)
		.map((r) => ({ week: r.weekNumber, score: r.performanceScore! }));

	const avg = (arr: number[]) =>
		arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
	const trend = (scores: Array<{ week: number; score: number }>) => {
		if (scores.length < 2) return { direction: 'flat' as const, delta: 0 };
		const recent = scores.slice(-3).map((s) => s.score);
		const earlier = scores.slice(0, Math.max(1, scores.length - 3)).map((s) => s.score);
		const recentAvg = avg(recent)!;
		const earlierAvg = avg(earlier)!;
		const d = +(recentAvg - earlierAvg).toFixed(1);
		return {
			direction: d > 0.3 ? ('up' as const) : d < -0.3 ? ('down' as const) : ('flat' as const),
			delta: d
		};
	};

	const selfEffortAvg = avg(effortScores.map((s) => s.score));
	const selfPerfAvg = avg(perfScores.map((s) => s.score));
	const effortTrend = trend(effortScores);
	const perfTrend = trend(perfScores);

	// Perception gap
	const revEffortScores = feedbacks.filter((f) => f.effortScore != null).map((f) => f.effortScore!);
	const revPerfScores = feedbacks
		.filter((f) => f.performanceScore != null)
		.map((f) => f.performanceScore!);
	const revEffortAvg = avg(revEffortScores);
	const revPerfAvg = avg(revPerfScores);
	const effortGap =
		selfEffortAvg != null && revEffortAvg != null
			? +(selfEffortAvg - revEffortAvg).toFixed(1)
			: null;
	const perfGap =
		selfPerfAvg != null && revPerfAvg != null ? +(selfPerfAvg - revPerfAvg).toFixed(1) : null;

	// ═══ Check-in data for inline Today screen ═══

	// Identity anchor: the user's first Week 1 note
	const week1WithNotes = checkIns.find((row) => row.weekNumber === 1 && row.notes?.trim());
	const identityAnchor: string | null = week1WithNotes?.notes?.trim() || null;

	const isCheckInDue = nextAction.state === 'open';

	// Last scores for RatingBar lastValue prop
	const lastCheckIn = [...checkIns].reverse().find((row) => row.weekNumber < currentWeek);
	const lastEffortScore: number | null = lastCheckIn?.effortScore ?? null;
	const lastPerformanceScore: number | null = lastCheckIn?.performanceScore ?? null;

	// Check for recent feedback (submitted in the last 7 days)
	let hasNewFeedback = false;
	let newFeedbackRaterName: string | null = null;
	const sevenDaysAgo = new Date();
	sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
	const recentFeedback = [...feedbacks]
		.filter((row) => new Date(row.submittedAt) >= sevenDaysAgo)
		.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())[0];
	if (recentFeedback) {
		hasNewFeedback = true;
		const name = recentFeedback.reviewer?.name;
		if (name) {
			const parts = name.split(' ');
			newFeedbackRaterName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
		}
	}

	// ═══ Journey celebration summary (only when the journey has wrapped) ═══
	// Compares the first half vs second half of the journey on self and reviewer
	// dimensions, surfaces the single biggest movement, and counts the work
	// the individual put in. This is what greets them on the complete hub state.
	let cycleSummary: {
		durationWeeks: number;
		totalCheckIns: number;
		totalFeedbacks: number;
		totalReviewers: number;
		selfEffortStart: number | null;
		selfEffortEnd: number | null;
		selfPerfStart: number | null;
		selfPerfEnd: number | null;
		effortGapStart: number | null;
		effortGapEnd: number | null;
		perfGapStart: number | null;
		perfGapEnd: number | null;
		biggestDelta: {
			label: string;
			direction: 'up' | 'down' | 'flat';
			magnitude: number;
		} | null;
	} | null = null;

	if (journey.status === 'COMPLETED') {
		const ratingReflections = checkIns.filter(
			(r) => r.effortScore != null || r.performanceScore != null
		);
		const weekNumbers = ratingReflections.map((r) => r.weekNumber);
		const minWeek = weekNumbers.length > 0 ? Math.min(...weekNumbers) : 1;
		const maxWeek = weekNumbers.length > 0 ? Math.max(...weekNumbers) : totalWeeks;
		const midpoint = (minWeek + maxWeek) / 2;

		const firstHalfSelf = ratingReflections.filter((r) => r.weekNumber <= midpoint);
		const secondHalfSelf = ratingReflections.filter((r) => r.weekNumber > midpoint);
		const firstHalfRev = feedbacks.filter((f) => f.weekNumber <= midpoint);
		const secondHalfRev = feedbacks.filter((f) => f.weekNumber > midpoint);

		const selfEffortStart = avg(
			firstHalfSelf.filter((r) => r.effortScore != null).map((r) => r.effortScore!)
		);
		const selfEffortEnd = avg(
			secondHalfSelf.filter((r) => r.effortScore != null).map((r) => r.effortScore!)
		);
		const selfPerfStart = avg(
			firstHalfSelf.filter((r) => r.performanceScore != null).map((r) => r.performanceScore!)
		);
		const selfPerfEnd = avg(
			secondHalfSelf.filter((r) => r.performanceScore != null).map((r) => r.performanceScore!)
		);
		const revEffortStart = avg(
			firstHalfRev.filter((f) => f.effortScore != null).map((f) => f.effortScore!)
		);
		const revEffortEnd = avg(
			secondHalfRev.filter((f) => f.effortScore != null).map((f) => f.effortScore!)
		);
		const revPerfStart = avg(
			firstHalfRev.filter((f) => f.performanceScore != null).map((f) => f.performanceScore!)
		);
		const revPerfEnd = avg(
			secondHalfRev.filter((f) => f.performanceScore != null).map((f) => f.performanceScore!)
		);

		const effortGapStart =
			selfEffortStart != null && revEffortStart != null
				? +Math.abs(selfEffortStart - revEffortStart).toFixed(1)
				: null;
		const effortGapEnd =
			selfEffortEnd != null && revEffortEnd != null
				? +Math.abs(selfEffortEnd - revEffortEnd).toFixed(1)
				: null;
		const perfGapStart =
			selfPerfStart != null && revPerfStart != null
				? +Math.abs(selfPerfStart - revPerfStart).toFixed(1)
				: null;
		const perfGapEnd =
			selfPerfEnd != null && revPerfEnd != null
				? +Math.abs(selfPerfEnd - revPerfEnd).toFixed(1)
				: null;

		const candidates: Array<{
			label: string;
			start: number | null;
			end: number | null;
			gapMetric: boolean;
		}> = [
			{ label: 'Your effort', start: selfEffortStart, end: selfEffortEnd, gapMetric: false },
			{ label: 'Your performance', start: selfPerfStart, end: selfPerfEnd, gapMetric: false },
			{ label: 'Effort blind-spot gap', start: effortGapStart, end: effortGapEnd, gapMetric: true },
			{
				label: 'Performance blind-spot gap',
				start: perfGapStart,
				end: perfGapEnd,
				gapMetric: true
			}
		];

		let biggestDelta: {
			label: string;
			direction: 'up' | 'down' | 'flat';
			magnitude: number;
		} | null = null;
		for (const c of candidates) {
			if (c.start == null || c.end == null) continue;
			const delta = +(c.end - c.start).toFixed(1);
			const magnitude = Math.abs(delta);
			if (biggestDelta == null || magnitude > biggestDelta.magnitude) {
				// For gap metrics, "down" (smaller gap) is the win; for self metrics, "up" is.
				const direction = delta > 0.2 ? 'up' : delta < -0.2 ? 'down' : 'flat';
				biggestDelta = { label: c.label, direction, magnitude };
			}
		}

		const durationWeeks = journey.lengthWeeks;

		cycleSummary = {
			durationWeeks,
			totalCheckIns: ratingReflections.length,
			totalFeedbacks: feedbacks.length,
			totalReviewers: goal.reviewers.length,
			selfEffortStart,
			selfEffortEnd,
			selfPerfStart,
			selfPerfEnd,
			effortGapStart,
			effortGapEnd,
			perfGapStart,
			perfGapEnd,
			biggestDelta
		};
	}

	// Coach nudge (latest coach note for this individual)
	let coachNudge: { text: string; coachName: string } | null = null;
	if (coachClient?.coach?.name) {
		try {
			const recentNote = await prisma.coachNote.findFirst({
				where: {
					individualId: dbUser.id
				},
				orderBy: { createdAt: 'desc' },
				select: { content: true }
			});
			if (recentNote?.content) {
				coachNudge = {
					text: recentNote.content,
					coachName: coachClient.coach.name
				};
			}
		} catch {
			// Non-critical — skip on error
		}
	}

	return {
		isFirstVisit,
		isOnboardingComplete,
		maturityStage,
		coachName: coachClient?.coach?.name ?? null,
		goal: {
			id: goal.id,
			title: goal.title,
			focusAreas: goal.focusAreas.map((s) => ({ id: s.id, label: s.label }))
		},
		summary: {
			...summary,
			totalReviewers: goal.reviewers.length
		},
		journey: {
			id: journey.id,
			startDate: journey.startDate.toISOString(),
			endDate: journey.endDate?.toISOString() ?? null,
			isOverdue: currentWeek > totalWeeks,
			isCycleCompleted: journey.status === 'COMPLETED'
		},
		currentWeek,
		totalWeeks,
		nextAction,
		latestInsight: latestInsight
			? {
					id: latestInsight.id,
					content: latestInsight.content,
					type: latestInsight.type,
					weekNumber: latestInsight.weekNumber,
					createdAt: latestInsight.createdAt.toISOString()
				}
			: null,
		signals: {
			effort: { avg: selfEffortAvg, trend: effortTrend },
			performance: { avg: selfPerfAvg, trend: perfTrend },
			reviewerEffort: { avg: revEffortAvg },
			reviewerPerformance: { avg: revPerfAvg },
			effortGap,
			perfGap,
			hasFeedback: feedbacks.length > 0,
			// Scorecard adaptive default: surface the blind-spot view as a persistent
			// ambient nudge once the user has enough feedback for the gap to be
			// statistically meaningful. 4 entries ≈ 2 weeks × 2 reviewers (or
			// 1 week × 4) — empirically the threshold where the gap stops being noise.
			scorecardReady: feedbacks.length >= 4,
			// First reviewer is the gap. Ask for one after the baseline check-in.
			// The "add more" nudge stays secondary until they already have someone.
			needsFirstReviewer: goal.reviewers.length === 0 && checkIns.length >= 1,
			needsMoreReviewers:
				goal.reviewers.length > 0 && goal.reviewers.length < 3 && checkIns.length >= 1
		},
		isBaseline: checkIns.length === 0,
		// Inline check-in data
		identityAnchor,
		isCheckInDue,
		lastEffortScore,
		lastPerformanceScore,
		hasNewFeedback,
		newFeedbackRaterName,
		coachNudge,
		cycleSummary
	};
};

// ═══ Check-in form action (mirrors checkin/+page.server.ts) ═══

export const actions: Actions = {
	checkin: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		return submitCheckIn(event, dbUser);
	}
};
