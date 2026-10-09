import { weekNumberForDate } from '$lib/server/domain/week';

/**
 * Consecutive journey weeks with at least one check-in, counting back from
 * `currentWeek`. An empty current week doesn't break the streak — the user
 * still has time to check in.
 */
export function weeklyCheckInStreak(
	journeyStart: Date,
	checkIns: Array<{ submittedAt: Date }>,
	currentWeek: number,
	timeZone?: string | null
): number {
	const weeks = new Set(
		checkIns.map((c) => weekNumberForDate(journeyStart, c.submittedAt, timeZone))
	);
	let week = weeks.has(currentWeek) ? currentWeek : currentWeek - 1;
	let streak = 0;
	while (week >= 1 && weeks.has(week)) {
		streak++;
		week--;
	}
	return streak;
}

export function hasCheckInForWeek(
	journeyStart: Date,
	checkIns: Array<{ submittedAt: Date }>,
	weekNumber: number,
	timeZone?: string | null
): boolean {
	return checkIns.some(
		(c) => weekNumberForDate(journeyStart, c.submittedAt, timeZone) === weekNumber
	);
}
