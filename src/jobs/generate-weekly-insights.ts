/**
 * Weekly Insight Generation Job
 *
 * Finds all active journeys and generates WEEKLY_SYNTHESIS insights
 * for the current week. Runs Sunday evening.
 */

import prisma from '$lib/server/prisma';
import { generateWeeklySynthesis } from '$lib/server/ai/generateInsight';
import { currentWeekNumber } from '$lib/server/domain/week';

export async function generateWeeklyInsights(): Promise<{
	generated: number;
	skipped: number;
	failed: number;
}> {
	console.log('[insights:weekly] Starting weekly insight generation...');

	const activeCycles = await prisma.journey.findMany({
		where: { status: 'ACTIVE' },
		select: {
			id: true,
			userId: true,
			startDate: true,
			user: { select: { timezone: true } }
		}
	});

	const cycleTargets = activeCycles.map((c) => ({
		...c,
		weekNumber: currentWeekNumber(c.startDate, new Date(), c.user.timezone)
	}));

	const existingInsights = await prisma.insight.findMany({
		where: {
			type: 'WEEKLY_SYNTHESIS',
			journeyId: { in: cycleTargets.map((c) => c.id) }
		},
		select: { journeyId: true, weekNumber: true }
	});
	const existingKey = (journeyId: string, weekNumber: number) => `${journeyId}:${weekNumber}`;
	const existingSet = new Set(
		existingInsights
			.filter((i) => i.journeyId !== null && i.weekNumber !== null)
			.map((i) => existingKey(i.journeyId as string, i.weekNumber as number))
	);

	let generated = 0;
	let skipped = 0;
	let failed = 0;

	for (const journey of cycleTargets) {
		const { weekNumber } = journey;

		if (existingSet.has(existingKey(journey.id, weekNumber))) {
			skipped++;
			continue;
		}

		try {
			const insightId = await generateWeeklySynthesis(journey.userId, journey.id, weekNumber);
			if (insightId) {
				generated++;
			} else {
				failed++;
			}
		} catch (error) {
			console.error(`[insights:weekly] Failed for journey ${journey.id}`, error);
			failed++;
		}
	}

	console.log(
		`[insights:weekly] Done. Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`
	);
	return { generated, skipped, failed };
}
