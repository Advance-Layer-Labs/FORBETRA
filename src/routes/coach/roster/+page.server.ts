import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';
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
			return buildClientSummary(relationship, toSummaryInput(individual));
		})
		.filter((value): value is NonNullable<typeof value> => value !== null);

	return {
		coach: {
			name: dbUser.name ?? 'Coach'
		},
		clients: clientSummaries
	};
};

export const actions: Actions = {
	archive: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const individualId = String(formData.get('individualId') ?? '').trim();
		const restore = formData.get('archived') === 'true';

		if (!individualId) {
			return { success: false };
		}

		await prisma.coachClient.updateMany({
			where: { coachId: dbUser.id, individualId },
			data: { archivedAt: restore ? null : new Date() }
		});

		return { success: true };
	}
};
