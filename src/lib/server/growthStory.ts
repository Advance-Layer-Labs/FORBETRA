import type { PrismaClient } from '@prisma/client';
import { weekNumberForDate } from '$lib/server/domain/week';

export type GrowthStoryData = {
	goalTitle: string;
	durationWeeks: number;
	checkInCount: number;
	raterCount: number;
	scores: Array<{
		weekNumber: number;
		effort: number | null;
		performance: number | null;
	}>;
	effortStart: number | null;
	effortEnd: number | null;
	performanceStart: number | null;
	performanceEnd: number | null;
	effortChange: number | null;
	performanceChange: number | null;
	keyMoments: Array<{
		weekNumber: number;
		description: string;
	}>;
	topComments: Array<{
		raterName: string;
		weekNumber: number;
		comment: string;
	}>;
	identityAnchor: string | null;
};

/**
 * Calculates score trend data from checkIns.
 * Groups by week number, averages effort and performance per week.
 */
export function buildScoreTrend(
	checkIns: Array<{
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	}>
): Array<{ weekNumber: number; effort: number | null; performance: number | null }> {
	const weekMap = new Map<number, { efforts: number[]; performances: number[] }>();

	for (const r of checkIns) {
		if (!weekMap.has(r.weekNumber)) {
			weekMap.set(r.weekNumber, { efforts: [], performances: [] });
		}
		const w = weekMap.get(r.weekNumber)!;
		if (r.effortScore !== null) w.efforts.push(r.effortScore);
		if (r.performanceScore !== null) w.performances.push(r.performanceScore);
	}

	return Array.from(weekMap.entries())
		.sort(([a], [b]) => a - b)
		.map(([weekNumber, data]) => ({
			weekNumber,
			effort:
				data.efforts.length > 0
					? Number((data.efforts.reduce((a, b) => a + b, 0) / data.efforts.length).toFixed(1))
					: null,
			performance:
				data.performances.length > 0
					? Number(
							(data.performances.reduce((a, b) => a + b, 0) / data.performances.length).toFixed(1)
						)
					: null
		}));
}

/**
 * Selects the top N feedback comments by length (longer = more substantive).
 */
export function selectTopComments(
	feedbacks: Array<{
		comment: string | null;
		reviewerName: string;
		weekNumber: number;
	}>,
	limit = 2
): Array<{ raterName: string; weekNumber: number; comment: string }> {
	return feedbacks
		.filter(
			(f): f is typeof f & { comment: string } => f.comment !== null && f.comment.trim().length > 10
		)
		.sort((a, b) => b.comment.length - a.comment.length)
		.slice(0, limit)
		.map((f) => ({
			raterName: f.reviewerName,
			weekNumber: f.weekNumber,
			comment: f.comment.trim()
		}));
}

/**
 * Identifies key moments in the score trend (biggest week-over-week changes).
 */
export function findKeyMoments(
	scores: Array<{ weekNumber: number; effort: number | null; performance: number | null }>,
	limit = 2
): Array<{ weekNumber: number; description: string }> {
	if (scores.length < 2) return [];

	const changes: Array<{ weekNumber: number; description: string; magnitude: number }> = [];

	for (let i = 1; i < scores.length; i++) {
		const prev = scores[i - 1];
		const curr = scores[i];

		if (prev.effort !== null && curr.effort !== null) {
			const delta = curr.effort - prev.effort;
			if (Math.abs(delta) >= 1.5) {
				changes.push({
					weekNumber: curr.weekNumber,
					description:
						delta > 0
							? `Effort jumped ${delta.toFixed(1)} points`
							: `Effort dropped ${Math.abs(delta).toFixed(1)} points`,
					magnitude: Math.abs(delta)
				});
			}
		}

		if (prev.performance !== null && curr.performance !== null) {
			const delta = curr.performance - prev.performance;
			if (Math.abs(delta) >= 1.5) {
				changes.push({
					weekNumber: curr.weekNumber,
					description:
						delta > 0
							? `Performance jumped ${delta.toFixed(1)} points`
							: `Performance dropped ${Math.abs(delta).toFixed(1)} points`,
					magnitude: Math.abs(delta)
				});
			}
		}
	}

	return changes
		.sort((a, b) => b.magnitude - a.magnitude)
		.slice(0, limit)
		.sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * Loads all growth story data for a completed journey.
 */
export async function loadGrowthStory(
	prisma: PrismaClient,
	journeyId: string,
	userId: string
): Promise<GrowthStoryData | null> {
	const journey = await prisma.journey.findFirst({
		where: { id: journeyId, userId, status: 'COMPLETED' },
		include: {
			goal: {
				select: { title: true, reviewers: { select: { id: true } } }
			},
			user: { select: { timezone: true } },
			checkIns: {
				where: { userId },
				select: {
					submittedAt: true,
					effortScore: true,
					performanceScore: true,
					notes: true
				},
				orderBy: { submittedAt: 'asc' }
			}
		}
	});

	if (!journey) return null;

	const durationWeeks = journey.endDate
		? Math.max(
				1,
				Math.ceil(
					(journey.endDate.getTime() - journey.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
				)
			)
		: journey.lengthWeeks;

	const checkIns = journey.checkIns.map((c) => ({
		...c,
		weekNumber: weekNumberForDate(journey.startDate, c.submittedAt, journey.user.timezone)
	}));

	const scores = buildScoreTrend(checkIns);
	const filledScores = scores.filter((s) => s.effort !== null || s.performance !== null);
	const first = filledScores[0] ?? null;
	const last = filledScores.length > 1 ? filledScores[filledScores.length - 1] : null;

	// Fetch rater comments
	const feedbacks = await prisma.feedback.findMany({
		where: {
			journeyId,
			comment: { not: null }
		},
		select: {
			comment: true,
			weekNumber: true,
			reviewer: { select: { name: true } }
		},
		orderBy: { submittedAt: 'desc' }
	});

	const topComments = selectTopComments(
		feedbacks.map((f) => ({
			comment: f.comment,
			reviewerName: f.reviewer.name,
			weekNumber: f.weekNumber
		}))
	);

	// Find identity anchor from journey insights
	const anchorInsight = await prisma.insight.findFirst({
		where: {
			journeyId,
			userId,
			status: 'COMPLETED',
			type: { in: ['WEEKLY_SYNTHESIS', 'CHECK_IN'] },
			weekNumber: 1
		},
		select: { content: true },
		orderBy: { createdAt: 'asc' }
	});

	// Also check week 1 check-in notes as fallback
	const week1CheckIn = checkIns.find((c) => c.weekNumber === 1 && c.notes);

	let identityAnchor: string | null = null;
	if (anchorInsight?.content) {
		const match = anchorInsight.content.match(/identity[^:]*:\s*"?([^"\n]+)"?/i);
		if (match) identityAnchor = match[1].trim();
	}
	if (!identityAnchor && week1CheckIn?.notes) {
		identityAnchor = week1CheckIn.notes.trim();
	}

	const keyMoments = findKeyMoments(scores);

	return {
		goalTitle: journey.goal.title,
		durationWeeks,
		checkInCount: checkIns.length,
		raterCount: journey.goal.reviewers.length,
		scores,
		effortStart: first?.effort ?? null,
		effortEnd: last?.effort ?? first?.effort ?? null,
		performanceStart: first?.performance ?? null,
		performanceEnd: last?.performance ?? first?.performance ?? null,
		effortChange:
			first?.effort !== null && last?.effort !== null && first !== null && last !== null
				? Number((last.effort! - first.effort!).toFixed(1))
				: null,
		performanceChange:
			first?.performance !== null && last?.performance !== null && first !== null && last !== null
				? Number((last.performance! - first.performance!).toFixed(1))
				: null,
		keyMoments,
		topComments,
		identityAnchor
	};
}
