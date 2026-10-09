import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { LayoutServerLoad } from './$types';
import { buildClientSummary } from '$lib/server/buildClientSummary';
import { clientSelect, toSummaryInput } from './clientData';

export const load: LayoutServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

	const coachClients = await prisma.coachClient.findMany({
		where: { coachId: dbUser.id, archivedAt: null },
		select: { id: true, individualId: true, createdAt: true, archivedAt: true }
	});

	if (coachClients.length === 0) {
		return { totalAlerts: 0 };
	}

	const individuals = await prisma.user.findMany({
		where: { id: { in: coachClients.map((entry) => entry.individualId) } },
		select: clientSelect(dbUser.id, { noteTake: 3 })
	});
	const individualLookup = new Map(individuals.map((individual) => [individual.id, individual]));

	const totalAlerts = coachClients.reduce((sum, relationship) => {
		const individual = individualLookup.get(relationship.individualId);
		if (!individual) return sum;
		const summary = buildClientSummary(
			relationship,
			toSummaryInput(individual, { feedbackTake: 10 })
		);
		return sum + (summary?.alerts.length ?? 0);
	}, 0);

	return { totalAlerts };
};
