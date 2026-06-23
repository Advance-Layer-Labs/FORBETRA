import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const [bestIndividual, bestCoach] = await Promise.all([
		// Prefer an individual with an ACTIVE cycle for demo
		prisma.user
			.findFirst({
				where: {
					role: 'INDIVIDUAL',
					objectives: { some: { active: true, cycles: { some: { status: 'ACTIVE' } } } }
				},
				select: { id: true }
			})
			.then(
				(u) => u ?? prisma.user.findFirst({ where: { role: 'INDIVIDUAL' }, select: { id: true } })
			),
		prisma.user.findFirst({
			where: { role: 'COACH' },
			orderBy: { coachClientsManaged: { _count: 'desc' } },
			select: { id: true }
		})
	]);

	return {
		defaults: {
			individualId: bestIndividual?.id ?? '',
			coachId: bestCoach?.id ?? ''
		}
	};
};
