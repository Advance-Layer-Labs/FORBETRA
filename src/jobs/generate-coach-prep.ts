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
					goals: {
						where: { active: true },
						take: 1,
						include: {
							journeys: {
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
		.map((r) => r.individual.goals[0]?.journeys[0]?.id)
		.filter((id): id is string => !!id);

	const recentPreps =
		candidateCycleIds.length > 0
			? await prisma.insight.findMany({
					where: {
						type: 'COACH_PREP',
						journeyId: { in: candidateCycleIds },
						createdAt: { gte: sevenDaysAgo }
					},
					select: { userId: true, journeyId: true }
				})
			: [];
	const recentPrepSet = new Set(recentPreps.map((p) => `${p.userId}:${p.journeyId}`));

	let generated = 0;
	let skipped = 0;
	let failed = 0;

	for (const rel of coachClients) {
		const journey = rel.individual.goals[0]?.journeys[0];
		if (!journey) {
			skipped++;
			continue;
		}

		if (recentPrepSet.has(`${rel.individualId}:${journey.id}`)) {
			skipped++;
			continue;
		}

		try {
			const insightId = await generateCoachPrep(rel.coachId, rel.individualId, journey.id);
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
