import { average, weekNumberForDate } from './week';

export type CheckInPoint = {
	submittedAt: Date;
	effortScore: number;
	performanceScore: number;
};

export type FeedbackPoint = {
	reviewerId: string;
	attribution: 'REVIEWER' | 'COACH';
	weekNumber: number;
	effortScore: number | null;
	performanceScore: number | null;
};

export type WeekGap = {
	weekNumber: number;
	selfEffort: number | null;
	selfPerformance: number | null;
	checkInCount: number;
	reviewerEffort: number | null;
	reviewerPerformance: number | null;
	reviewerCount: number;
	effortGap: number | null;
	performanceGap: number | null;
};

/**
 * One row per reviewer per week. A coach who also reviews is a single reviewer
 * and contributes one score, even if a duplicate row is passed in.
 */
export function dedupeFeedback(feedback: FeedbackPoint[]): FeedbackPoint[] {
	const seen = new Set<string>();
	const result: FeedbackPoint[] = [];
	for (const row of feedback) {
		const key = `${row.reviewerId}:${row.weekNumber}`;
		if (seen.has(key)) continue;
		seen.add(key);
		result.push(row);
	}
	return result;
}

export function hasDuplicateFeedback(
	existing: Array<{ reviewerId: string; weekNumber: number }>,
	reviewerId: string,
	weekNumber: number
): boolean {
	return existing.some((row) => row.reviewerId === reviewerId && row.weekNumber === weekNumber);
}

/**
 * Focus areas are hints. They are intentionally absent from this input:
 * ratings stay on the goal, and the gap is self weekly average vs reviewers.
 */
export function weeklyGap(input: {
	journeyStart: Date;
	checkIns: CheckInPoint[];
	feedback: FeedbackPoint[];
	timeZone?: string | null;
}): WeekGap[] {
	const selfByWeek = new Map<number, CheckInPoint[]>();
	for (const checkIn of input.checkIns) {
		const weekNumber = weekNumberForDate(input.journeyStart, checkIn.submittedAt, input.timeZone);
		const bucket = selfByWeek.get(weekNumber) ?? [];
		bucket.push(checkIn);
		selfByWeek.set(weekNumber, bucket);
	}

	const feedbackByWeek = new Map<number, FeedbackPoint[]>();
	for (const row of dedupeFeedback(input.feedback)) {
		const bucket = feedbackByWeek.get(row.weekNumber) ?? [];
		bucket.push(row);
		feedbackByWeek.set(row.weekNumber, bucket);
	}

	const weeks = new Set<number>([...selfByWeek.keys(), ...feedbackByWeek.keys()]);
	return [...weeks]
		.sort((a, b) => a - b)
		.map((weekNumber) => {
			const checkIns = selfByWeek.get(weekNumber) ?? [];
			const feedback = feedbackByWeek.get(weekNumber) ?? [];
			const selfEffort = average(checkIns.map((row) => row.effortScore));
			const selfPerformance = average(checkIns.map((row) => row.performanceScore));
			const reviewerEffort = average(feedback.map((row) => row.effortScore));
			const reviewerPerformance = average(feedback.map((row) => row.performanceScore));
			return {
				weekNumber,
				selfEffort,
				selfPerformance,
				checkInCount: checkIns.length,
				reviewerEffort,
				reviewerPerformance,
				reviewerCount: feedback.length,
				effortGap:
					selfEffort !== null && reviewerEffort !== null ? selfEffort - reviewerEffort : null,
				performanceGap:
					selfPerformance !== null && reviewerPerformance !== null
						? selfPerformance - reviewerPerformance
						: null
			};
		});
}
