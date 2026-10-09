import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const goals = await prisma.goal.findMany({
		orderBy: { createdAt: 'desc' },
		include: {
			user: { select: { id: true, name: true, email: true } },
			_count: {
				select: { focusAreas: true, journeys: true, reviewers: true }
			}
		}
	});

	return { goals };
};
