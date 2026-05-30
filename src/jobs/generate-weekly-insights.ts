/**
 * Weekly Insight Generation Job
 *
 * Finds all active cycles and generates WEEKLY_SYNTHESIS insights
 * for the current week. Runs Sunday evening.
 */

import prisma from '$lib/server/prisma';
import { generateWeeklySynthesis } from '$lib/server/ai/generateInsight';
import { computeWeekNumber } from '$lib/server/coachUtils';

export async function generateWeeklyInsights(): Promise<{
	generated: number;
	skipped: number;
	failed: number;
}> {
	console.log('[insights:weekly] Starting weekly insight generation...');

	const activeCycles = await prisma.cycle.findMany({
		where: { status: 'ACTIVE' },
		select: {
			id: true,
			userId: true,
			startDate: true
		}
	});

	const cycleTargets = activeCycles.map((c) => ({
		...c,
		weekNumber: computeWeekNumber(c.startDate)
	}));

	const existingInsights = await prisma.insight.findMany({
		where: {
			type: 'WEEKLY_SYNTHESIS',
			cycleId: { in: cycleTargets.map((c) => c.id) }
		},
		select: { cycleId: true, weekNumber: true }
	});
	const existingKey = (cycleId: string, weekNumber: number) => `${cycleId}:${weekNumber}`;
	const existingSet = new Set(
		existingInsights
			.filter((i) => i.cycleId !== null && i.weekNumber !== null)
			.map((i) => existingKey(i.cycleId as string, i.weekNumber as number))
	);

	let generated = 0;
	let skipped = 0;
	let failed = 0;

	for (const cycle of cycleTargets) {
		const { weekNumber } = cycle;

		if (existingSet.has(existingKey(cycle.id, weekNumber))) {
			skipped++;
			continue;
		}

		try {
			const insightId = await generateWeeklySynthesis(cycle.userId, cycle.id, weekNumber);
			if (insightId) {
				generated++;
			} else {
				failed++;
			}
		} catch (error) {
			console.error(`[insights:weekly] Failed for cycle ${cycle.id}`, error);
			failed++;
		}
	}

	console.log(
		`[insights:weekly] Done. Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`
	);
	return { generated, skipped, failed };
}
