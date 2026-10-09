import { daysBetweenInTimeZone } from '$lib/notifications/preferences';

export type ReviewerCadenceName = 'WEEKLY' | 'BIWEEKLY';

/**
 * Week 1 is the journey's start calendar day. Later weeks follow that calendar
 * in the individual's timezone. Missing timezone stays on UTC.
 */
export function weekNumberForDate(journeyStart: Date, at: Date, timeZone?: string | null): number {
	const days = daysBetweenInTimeZone(journeyStart, at, timeZone);
	return Math.max(1, Math.floor(days / 7) + 1);
}

export function currentWeekNumber(
	journeyStart: Date,
	now = new Date(),
	timeZone?: string | null
): number {
	return weekNumberForDate(journeyStart, now, timeZone);
}

/** Biweekly reviewers are due on weeks 1, 3, 5… Weekly reviewers are due every week. */
export function isReviewerDue(cadence: ReviewerCadenceName, weekNumber: number): boolean {
	if (cadence === 'WEEKLY') return true;
	return weekNumber % 2 === 1;
}

export function average(values: Array<number | null | undefined>): number | null {
	const nums = values.filter((value): value is number => typeof value === 'number');
	if (nums.length === 0) return null;
	return nums.reduce((sum, value) => sum + value, 0) / nums.length;
}
