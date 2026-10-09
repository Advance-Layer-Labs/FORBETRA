import { average, weekNumberForDate } from './domain/week';

export interface CheckInData {
	id: string;
	weekNumber: number;
	effortScore: number | null;
	performanceScore: number | null;
}

export interface FeedbackData {
	reviewerId: string;
	weekNumber: number;
	effortScore: number | null;
	performanceScore: number | null;
}

export interface ReviewerRef {
	id: string;
	name: string;
}

function round1(value: number | null): number | null {
	return value === null ? null : Number(value.toFixed(1));
}

/** Compliance is at least one check-in in the week. */
export function computeCompletionMetrics(checkIns: CheckInData[], currentWeek: number) {
	const totalExpected = Math.max(0, currentWeek);
	const weeksWithCheckIn = new Set(checkIns.map((row) => row.weekNumber));
	const totalCompleted = weeksWithCheckIn.size;
	const completionRate =
		totalExpected > 0 ? Math.min(100, Math.round((totalCompleted / totalExpected) * 100)) : 0;

	let currentStreak = 0;
	for (let week = currentWeek; week >= 1; week--) {
		if (weeksWithCheckIn.has(week)) currentStreak++;
		else break;
	}

	const openExperiences = weeksWithCheckIn.has(currentWeek) ? 0 : 1;
	return { completionRate, currentStreak, totalExpected, totalCompleted, openExperiences };
}

export function computeNextAction(
	checkIns: CheckInData[],
	currentWeek: number
): { label: string; url: string | null; state: 'open' | 'missed' | 'upcoming' } {
	const done = checkIns.some((row) => row.weekNumber === currentWeek);
	if (!done) {
		return { label: 'Complete your check-in', url: '/individual/checkin', state: 'open' };
	}
	return { label: 'Checked in this week', url: null, state: 'upcoming' };
}

export function computeMyLastRatings(checkIns: CheckInData[]) {
	const withRatings = checkIns.filter(
		(row) => row.effortScore !== null || row.performanceScore !== null
	);
	if (withRatings.length === 0) return null;

	const latestWeek = Math.max(...withRatings.map((row) => row.weekNumber));
	const latest = withRatings.filter((row) => row.weekNumber === latestWeek);
	const latestEffort = round1(average(latest.map((row) => row.effortScore)));
	const latestPerformance = round1(average(latest.map((row) => row.performanceScore)));

	let previousEffort: number | null = null;
	let previousPerformance: number | null = null;
	if (latestWeek > 1) {
		const prev = checkIns.filter((row) => row.weekNumber === latestWeek - 1);
		previousEffort = round1(average(prev.map((row) => row.effortScore)));
		previousPerformance = round1(average(prev.map((row) => row.performanceScore)));
	}

	return {
		effort: latestEffort,
		performance: latestPerformance,
		effortChange:
			latestEffort !== null && previousEffort !== null ? latestEffort - previousEffort : null,
		performanceChange:
			latestPerformance !== null && previousPerformance !== null
				? latestPerformance - previousPerformance
				: null,
		weekNumber: latestWeek
	};
}

export function computeReviewersLastRatings(feedbacks: FeedbackData[]) {
	if (feedbacks.length === 0) return null;
	const byWeek = new Map<number, FeedbackData[]>();
	for (const row of feedbacks) {
		const bucket = byWeek.get(row.weekNumber) ?? [];
		bucket.push(row);
		byWeek.set(row.weekNumber, bucket);
	}
	const latestWeek = Math.max(...byWeek.keys());
	const latest = byWeek.get(latestWeek) ?? [];
	const latestEffort = round1(average(latest.map((row) => row.effortScore)));
	const latestPerformance = round1(average(latest.map((row) => row.performanceScore)));
	const prev = byWeek.get(latestWeek - 1) ?? [];
	const previousEffort = prev.length ? round1(average(prev.map((row) => row.effortScore))) : null;
	const previousPerformance = prev.length
		? round1(average(prev.map((row) => row.performanceScore)))
		: null;

	return {
		effort: latestEffort,
		performance: latestPerformance,
		effortChange:
			latestEffort !== null && previousEffort !== null ? latestEffort - previousEffort : null,
		performanceChange:
			latestPerformance !== null && previousPerformance !== null
				? latestPerformance - previousPerformance
				: null,
		weekNumber: latestWeek
	};
}

export function computeHeatMap(checkIns: CheckInData[], currentWeek: number, lengthWeeks: number) {
	const totalWeeks = Math.max(lengthWeeks, currentWeek);
	const weekMap = new Map<number, { efforts: number[]; performances: number[] }>();
	for (const row of checkIns) {
		const bucket = weekMap.get(row.weekNumber) ?? { efforts: [], performances: [] };
		if (row.effortScore !== null) bucket.efforts.push(row.effortScore);
		if (row.performanceScore !== null) bucket.performances.push(row.performanceScore);
		weekMap.set(row.weekNumber, bucket);
	}
	const weeks = [];
	for (let weekNumber = 1; weekNumber <= totalWeeks; weekNumber++) {
		const bucket = weekMap.get(weekNumber);
		weeks.push({
			weekNumber,
			effort: bucket ? round1(average(bucket.efforts)) : null,
			performance: bucket ? round1(average(bucket.performances)) : null
		});
	}
	return { weeks, totalWeeks };
}

export function computeVisualizationData(
	heatMapWeeks: Array<{ weekNumber: number; effort: number | null; performance: number | null }>,
	feedbacks: FeedbackData[],
	reviewers: ReviewerRef[]
) {
	const nameMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name]));
	return {
		individual: heatMapWeeks.map((week) => ({
			weekNumber: week.weekNumber,
			effortScore: week.effort,
			performanceScore: week.performance
		})),
		reviewers: feedbacks.map((row) => ({
			weekNumber: row.weekNumber,
			reviewerId: row.reviewerId,
			reviewerName: nameMap.get(row.reviewerId) ?? 'Unknown',
			effortScore: row.effortScore,
			performanceScore: row.performanceScore
		})),
		reviewerList: reviewers.map((reviewer) => ({ id: reviewer.id, name: reviewer.name }))
	};
}

export function computePerceptionGaps(
	feedbacks: FeedbackData[],
	checkIns: CheckInData[],
	reviewers: ReviewerRef[]
) {
	const nameMap = new Map(reviewers.map((reviewer) => [reviewer.id, reviewer.name]));
	const byReviewer = new Map<string, Map<number, { efforts: number[]; performances: number[] }>>();
	for (const row of feedbacks) {
		const weeks = byReviewer.get(row.reviewerId) ?? new Map();
		const bucket = weeks.get(row.weekNumber) ?? { efforts: [], performances: [] };
		if (row.effortScore !== null) bucket.efforts.push(row.effortScore);
		if (row.performanceScore !== null) bucket.performances.push(row.performanceScore);
		weeks.set(row.weekNumber, bucket);
		byReviewer.set(row.reviewerId, weeks);
	}

	const selfWeekMap = new Map<number, { efforts: number[]; performances: number[] }>();
	for (const row of checkIns) {
		const bucket = selfWeekMap.get(row.weekNumber) ?? { efforts: [], performances: [] };
		if (row.effortScore !== null) bucket.efforts.push(row.effortScore);
		if (row.performanceScore !== null) bucket.performances.push(row.performanceScore);
		selfWeekMap.set(row.weekNumber, bucket);
	}

	return Array.from(byReviewer.entries())
		.map(([reviewerId, weeks]) => {
			const paired = [];
			for (const [weekNumber, scores] of weeks) {
				const self = selfWeekMap.get(weekNumber);
				if (!self) continue;
				const selfEffort = average(self.efforts);
				const selfPerformance = average(self.performances);
				const reviewerEffort = average(scores.efforts);
				const reviewerPerformance = average(scores.performances);
				if (
					selfEffort === null ||
					selfPerformance === null ||
					reviewerEffort === null ||
					reviewerPerformance === null
				) {
					continue;
				}
				paired.push({
					weekNumber,
					selfEffort,
					selfPerformance,
					reviewerEffort,
					reviewerPerformance
				});
			}
			paired.sort((a, b) => a.weekNumber - b.weekNumber);
			if (paired.length === 0) {
				return {
					reviewerId,
					reviewerName: nameMap.get(reviewerId) ?? 'Unknown',
					effortGap: null as number | null,
					performanceGap: null as number | null,
					effortGapTrend: null as 'widening' | 'closing' | 'stable' | null,
					performanceGapTrend: null as 'widening' | 'closing' | 'stable' | null,
					maxAbsGap: 0
				};
			}
			const latest = paired[paired.length - 1];
			const effortGap = Number((latest.selfEffort - latest.reviewerEffort).toFixed(1));
			const performanceGap = Number(
				(latest.selfPerformance - latest.reviewerPerformance).toFixed(1)
			);
			return {
				reviewerId,
				reviewerName: nameMap.get(reviewerId) ?? 'Unknown',
				effortGap,
				performanceGap,
				effortGapTrend: gapTrend(
					paired.map((row) => Math.abs(row.selfEffort - row.reviewerEffort))
				),
				performanceGapTrend: gapTrend(
					paired.map((row) => Math.abs(row.selfPerformance - row.reviewerPerformance))
				),
				maxAbsGap: Math.max(Math.abs(effortGap), Math.abs(performanceGap))
			};
		})
		.filter((row) => row.effortGap !== null || row.performanceGap !== null);
}

function gapTrend(gaps: number[]): 'widening' | 'closing' | 'stable' | null {
	if (gaps.length < 2) return null;
	const recent = gaps.slice(-3);
	let totalDelta = 0;
	for (let i = 1; i < recent.length; i++) totalDelta += recent[i] - recent[i - 1];
	const avgDelta = totalDelta / (recent.length - 1);
	if (avgDelta > 0.5) return 'widening';
	if (avgDelta < -0.5) return 'closing';
	return 'stable';
}

export function withCheckInWeeks<T extends { submittedAt: Date }>(
	journeyStart: Date,
	checkIns: T[],
	timeZone?: string | null
): Array<T & { weekNumber: number }> {
	return checkIns.map((checkIn) => ({
		...checkIn,
		weekNumber: weekNumberForDate(journeyStart, checkIn.submittedAt, timeZone)
	}));
}
