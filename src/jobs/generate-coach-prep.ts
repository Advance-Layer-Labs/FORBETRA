/**
 * Coach Prep Generation Job
 *
 * For each coach, generates COACH_PREP insights for each active client.
 * Runs Monday morning before coaching sessions.
 */

import prisma from '$lib/server/prisma';
import { generateCoachPrep } from '$lib/server/ai/generateInsight';

export async function generateCoachPrepInsights(): Promise<{
	generated: number;
	skipped: number;
	failed: number;
}> {
	console.log('[insights:coach-prep] Starting coach prep generation...');

	const coachClients = await prisma.coachClient.findMany({
		where: { archivedAt: null },
		include: {
			individual: {
				select: {
					id: true,
					objectives: {
						where: { active: true },
						take: 1,
						include: {
							cycles: {
								where: { status: 'ACTIVE' },
								take: 1,
								select: { id: true }
							}
						}
					}
				}
			}
		}
	});

	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
	const candidateCycleIds = coachClients
		.map((r) => r.individual.objectives[0]?.cycles[0]?.id)
		.filter((id): id is string => !!id);

	const recentPreps =
		candidateCycleIds.length > 0
			? await prisma.insight.findMany({
					where: {
						type: 'COACH_PREP',
						cycleId: { in: candidateCycleIds },
						createdAt: { gte: sevenDaysAgo }
					},
					select: { userId: true, cycleId: true }
				})
			: [];
	const recentPrepSet = new Set(recentPreps.map((p) => `${p.userId}:${p.cycleId}`));

	let generated = 0;
	let skipped = 0;
	let failed = 0;

	for (const rel of coachClients) {
		const cycle = rel.individual.objectives[0]?.cycles[0];
		if (!cycle) {
			skipped++;
			continue;
		}

		if (recentPrepSet.has(`${rel.individualId}:${cycle.id}`)) {
			skipped++;
			continue;
		}

		try {
			const insightId = await generateCoachPrep(rel.coachId, rel.individualId, cycle.id);
			if (insightId) {
				generated++;
			} else {
				failed++;
			}
		} catch (error) {
			console.error(
				`[insights:coach-prep] Failed for coach ${rel.coachId} -> individual ${rel.individualId}`,
				error
			);
			failed++;
		}
	}

	console.log(
		`[insights:coach-prep] Done. Generated: ${generated}, Skipped: ${skipped}, Failed: ${failed}`
	);
	return { generated, skipped, failed };
}
