/** Number of days before a feedback token expires */
export const FEEDBACK_TOKEN_EXPIRY_DAYS = 10;

export const toIsoDate = (value: Date | null | undefined) => (value ? value.toISOString() : null);

export const weeksBetween = (start: Date, end: Date) =>
	Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (7 * 24 * 60 * 60 * 1000)));

// Helper to compute week number from start date (normalized to midnight)
export const computeWeekNumber = (startDate: Date): number => {
	const now = new Date();
	now.setHours(0, 0, 0, 0);
	const start = new Date(startDate);
	start.setHours(0, 0, 0, 0);

	const diffMs = now.getTime() - start.getTime();
	const msPerWeek = 7 * 24 * 60 * 60 * 1000;
	const fullWeeks = Math.floor(diffMs / msPerWeek);
	return Math.max(1, fullWeeks + 1);
};

export const weekNumberForDate = (startDate: Date, target: Date) => {
	const diff = target.getTime() - startDate.getTime();
	const msPerWeek = 7 * 24 * 60 * 60 * 1000;
	return Math.max(1, Math.floor(diff / msPerWeek) + 1);
};

export const stdDev = (values: number[]) => {
	if (values.length === 0) return null;
	const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
	const variance =
		values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
	return Math.sqrt(variance);
};

// Get the date for a specific weekday in a given week (1 = Monday, 3 = Wednesday, 5 = Friday)
export const getDateForWeekday = (weekday: number, startDate: Date, weekNumber: number): Date => {
	// Normalize startDate to local midnight
	const start = new Date(startDate);
	start.setHours(0, 0, 0, 0);

	// Find the Monday of the week that contains startDate
	const startDayOfWeek = start.getDay();
	const mondayOffset = startDayOfWeek === 0 ? 1 : 1 - startDayOfWeek;
	const cycleMonday = new Date(start);
	cycleMonday.setDate(start.getDate() + mondayOffset);
	cycleMonday.setHours(0, 0, 0, 0);

	// Calculate the Monday of the target week
	const targetMonday = new Date(cycleMonday);
	targetMonday.setDate(cycleMonday.getDate() + (weekNumber - 1) * 7);
	targetMonday.setHours(0, 0, 0, 0);

	// Add days to get to the target weekday
	const targetDate = new Date(targetMonday);
	targetDate.setDate(targetMonday.getDate() + (weekday - 1));
	targetDate.setHours(0, 0, 0, 0);

	return targetDate;
};
