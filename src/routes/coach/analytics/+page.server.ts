import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';
import { buildClientSummary } from '$lib/server/buildClientSummary';
import { clientSelect, toSummaryInput } from '../clientData';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

	const coachClients = await prisma.coachClient.findMany({
		where: { coachId: dbUser.id },
		orderBy: [{ archivedAt: 'asc' }, { createdAt: 'asc' }],
		select: {
			id: true,
			individualId: true,
			createdAt: true,
			archivedAt: true
		}
	});

	const individualIds = coachClients.map((entry) => entry.individualId);

	const individuals = individualIds.length
		? await prisma.user.findMany({
				where: { id: { in: individualIds } },
				select: clientSelect(dbUser.id, { noteTake: 3 })
			})
		: [];

	const individualLookup = new Map(individuals.map((individual) => [individual.id, individual]));

	const clientSummaries = coachClients
		.map((relationship) => {
			const individual = individualLookup.get(relationship.individualId);
			if (!individual) return null;
			return buildClientSummary(relationship, toSummaryInput(individual, { feedbackTake: 10 }));
		})
		.filter((value): value is NonNullable<typeof value> => value !== null);

	// Calculate analytics
	const totalAlerts = clientSummaries.reduce((sum, client) => sum + client.alerts.length, 0);
	const highPriorityAlerts = clientSummaries.reduce(
		(sum, client) => sum + client.alerts.filter((a) => a.severity === 'high').length,
		0
	);
	const mediumPriorityAlerts = clientSummaries.reduce(
		(sum, client) => sum + client.alerts.filter((a) => a.severity === 'medium').length,
		0
	);
	const lowPriorityAlerts = clientSummaries.reduce(
		(sum, client) => sum + client.alerts.filter((a) => a.severity === 'low').length,
		0
	);

	const stabilityScores = clientSummaries
		.map((c) => c.goal?.insights?.stabilityScore)
		.filter((s): s is number => s !== null);
	const avgStability =
		stabilityScores.length > 0
			? Math.round(stabilityScores.reduce((sum, s) => sum + s, 0) / stabilityScores.length)
			: null;

	const alignmentRatios = clientSummaries
		.map((c) => c.goal?.insights?.alignmentRatio)
		.filter((r): r is number => r !== null);
	const avgAlignment =
		alignmentRatios.length > 0
			? Math.round((alignmentRatios.reduce((sum, r) => sum + r, 0) / alignmentRatios.length) * 100)
			: null;

	const avgEffortScores = clientSummaries
		.map((c) => c.goal?.insights?.avgEffort)
		.filter((e): e is number => e !== null);
	const overallAvgEffort =
		avgEffortScores.length > 0
			? Number((avgEffortScores.reduce((sum, e) => sum + e, 0) / avgEffortScores.length).toFixed(1))
			: null;

	const avgProgressScores = clientSummaries
		.map((c) => c.goal?.insights?.avgProgress)
		.filter((p): p is number => p !== null);
	const overallAvgProgress =
		avgProgressScores.length > 0
			? Number(
					(avgProgressScores.reduce((sum, p) => sum + p, 0) / avgProgressScores.length).toFixed(1)
				)
			: null;

	// --- Client Comparison Table ---
	const clientComparison = clientSummaries
		.filter((c) => c.goal && !c.archived)
		.map((c) => ({
			clientId: c.id,
			name: c.name,
			goal: c.goal?.title ?? '',
			avgEffort: c.goal?.insights?.avgEffort ?? null,
			avgProgress: c.goal?.insights?.avgProgress ?? null,
			stability: c.goal?.insights?.stabilityScore ?? null,
			trajectory: c.goal?.insights?.trajectoryScore ?? null,
			alignment: c.goal?.insights?.alignmentRatio ?? null,
			completionRate: c.goal?.journey?.completion ?? null,
			alertCount: c.alerts.length,
			currentWeek: c.goal?.journey?.currentWeek ?? null
		}));

	// --- Portfolio Time Series: weekly averages across all active clients ---
	const weeklyBuckets = new Map<
		number,
		{ efforts: number[]; performances: number[]; clientIds: Set<string> }
	>();
	for (const client of clientSummaries) {
		if (client.archived || !client.goal || !client.visualizationData) continue;
		const weeklyData = client.visualizationData.individual ?? [];
		for (const week of weeklyData) {
			if (!weeklyBuckets.has(week.weekNumber)) {
				weeklyBuckets.set(week.weekNumber, { efforts: [], performances: [], clientIds: new Set() });
			}
			const bucket = weeklyBuckets.get(week.weekNumber)!;
			if (week.effortScore !== null) {
				bucket.efforts.push(week.effortScore);
				bucket.clientIds.add(client.id);
			}
			if (week.performanceScore !== null) {
				bucket.performances.push(week.performanceScore);
				bucket.clientIds.add(client.id);
			}
		}
	}

	const portfolioTimeSeries = Array.from(weeklyBuckets.entries())
		.map(([weekNumber, bucket]) => ({
			weekNumber,
			avgEffort:
				bucket.efforts.length > 0
					? Number((bucket.efforts.reduce((a, b) => a + b, 0) / bucket.efforts.length).toFixed(1))
					: null,
			avgPerformance:
				bucket.performances.length > 0
					? Number(
							(bucket.performances.reduce((a, b) => a + b, 0) / bucket.performances.length).toFixed(
								1
							)
						)
					: null,
			clientCount: bucket.clientIds.size
		}))
		.sort((a, b) => a.weekNumber - b.weekNumber);

	return {
		coach: {
			name: dbUser.name ?? 'Coach'
		},
		clients: clientSummaries,
		analytics: {
			totalAlerts,
			highPriorityAlerts,
			mediumPriorityAlerts,
			lowPriorityAlerts,
			avgStability,
			avgAlignment,
			overallAvgEffort,
			overallAvgProgress
		},
		clientComparison,
		portfolioTimeSeries
	};
};
