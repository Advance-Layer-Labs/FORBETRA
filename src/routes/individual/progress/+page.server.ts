import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { withCheckInWeeks } from '$lib/server/hubMetrics';
import type { PageServerLoad } from './$types';

type WeeklyScores = { effortScores: number[]; performanceScores: number[] };

const avg1 = (values: number[]) =>
	values.length > 0 ? Number((values.reduce((s, v) => s + v, 0) / values.length).toFixed(1)) : null;

function weeklyAverages(
	rows: Array<{ weekNumber: number; effortScore: number; performanceScore: number }>
) {
	const map = new Map<number, WeeklyScores>();
	for (const row of rows) {
		const entry = map.get(row.weekNumber) ?? { effortScores: [], performanceScores: [] };
		entry.effortScores.push(row.effortScore);
		entry.performanceScores.push(row.performanceScore);
		map.set(row.weekNumber, entry);
	}
	return Array.from(map.entries())
		.sort(([a], [b]) => a - b)
		.map(([weekNumber, scores]) => ({
			weekNumber,
			effortScore: avg1(scores.effortScores),
			performanceScore: avg1(scores.performanceScores)
		}));
}

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const { goal, journey, checkIns, feedback } = await event.parent();

	// Prior-journey individual weekly averages, rendered as a dimmed dashed line
	// in PerformanceEffortChart so the user can compare against last time.
	const priorCycle = await prisma.journey.findFirst({
		where: { goalId: goal.id, id: { not: journey.id }, startDate: { lt: journey.startDate } },
		orderBy: { startDate: 'desc' },
		include: { checkIns: { orderBy: { submittedAt: 'asc' } } }
	});

	const priorIndividualData = priorCycle
		? weeklyAverages(withCheckInWeeks(priorCycle.startDate, priorCycle.checkIns, dbUser.timezone))
		: [];

	const cycleReport = await prisma.insight.findFirst({
		where: {
			userId: dbUser.id,
			journeyId: journey.id,
			status: 'COMPLETED',
			type: 'JOURNEY_REPORT'
		},
		orderBy: { createdAt: 'desc' },
		select: { id: true, content: true, createdAt: true, thumbs: true }
	});

	const individualWeeklyData = weeklyAverages(checkIns);

	const reviewerWeeklyData = feedback.map((row) => ({
		weekNumber: row.weekNumber,
		reviewerId: row.reviewer.id,
		reviewerName: row.reviewer.name,
		effortScore: row.effortScore,
		performanceScore: row.performanceScore
	}));

	type HistoryCheckIn = {
		id: string;
		effortScore: number;
		performanceScore: number;
		notes: string | null;
		checkInDate: string;
	};
	type HistoryFeedback = {
		id: string;
		reviewerName: string;
		effortScore: number | null;
		performanceScore: number | null;
		comment: string | null;
		behavioralObservation: string | null;
		suggestion: string | null;
	};

	const weekMap = new Map<number, { checkIns: HistoryCheckIn[]; feedbacks: HistoryFeedback[] }>();
	const bucketFor = (weekNumber: number) => {
		let bucket = weekMap.get(weekNumber);
		if (!bucket) {
			bucket = { checkIns: [], feedbacks: [] };
			weekMap.set(weekNumber, bucket);
		}
		return bucket;
	};
	for (const row of [...checkIns].reverse()) {
		bucketFor(row.weekNumber).checkIns.push({
			id: row.id,
			effortScore: row.effortScore,
			performanceScore: row.performanceScore,
			notes: row.notes,
			checkInDate: row.submittedAt.toISOString()
		});
	}
	for (const row of feedback) {
		bucketFor(row.weekNumber).feedbacks.push({
			id: row.id,
			reviewerName: row.reviewer.name,
			effortScore: row.effortScore,
			performanceScore: row.performanceScore,
			comment: row.comment,
			behavioralObservation: row.behavioralObservation,
			suggestion: row.suggestion
		});
	}

	const weeks = Array.from(weekMap.entries())
		.map(([weekNumber, data]) => ({ weekNumber, ...data }))
		.sort((a, b) => b.weekNumber - a.weekNumber);

	return {
		goal: { id: goal.id, title: goal.title },
		cycleReport,
		visualizationData: {
			individual: individualWeeklyData,
			reviewers: reviewerWeeklyData,
			reviewerList: goal.reviewers.map((s) => ({ id: s.id, name: s.name })),
			priorIndividual: priorIndividualData,
			priorCycleLabel: priorCycle?.label ?? null
		},
		weeks
	};
};
