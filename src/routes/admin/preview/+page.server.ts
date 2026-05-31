import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const [individuals, coaches, stakeholders] = await Promise.all([
		prisma.user.findMany({
			where: { role: 'INDIVIDUAL' },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				email: true,
				objectives: {
					where: { active: true },
					orderBy: { createdAt: 'desc' },
					take: 1,
					select: {
						title: true,
						cycles: {
							orderBy: { startDate: 'desc' },
							take: 1,
							select: { status: true, label: true }
						}
					}
				}
			}
		}),
		prisma.user.findMany({
			where: { role: 'COACH' },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				email: true,
				_count: { select: { coachClientsManaged: true } }
			}
		}),
		prisma.stakeholder.findMany({
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				email: true,
				relationship: true,
				individual: { select: { name: true, email: true } },
				tokens: {
					where: { type: 'FEEDBACK_INVITE', usedAt: null, expiresAt: { gt: new Date() } },
					orderBy: { expiresAt: 'desc' },
					take: 1,
					select: { tokenHash: true }
				}
			}
		})
	]);

	return {
		individuals: individuals.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			objectiveTitle: u.objectives[0]?.title ?? null,
			cycleStatus: u.objectives[0]?.cycles[0]?.status ?? null,
			cycleLabel: u.objectives[0]?.cycles[0]?.label ?? null
		})),
		coaches: coaches.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			clientCount: u._count.coachClientsManaged
		})),
		stakeholders: stakeholders.map((s) => {
			// Tokens are hashed now (see src/lib/server/tokenHash.ts); the hash is
			// not a usable URL. Admin should impersonate the stakeholder to test
			// the feedback flow rather than reconstructing a URL.
			const hasActiveToken = s.tokens.length > 0;
			return {
				id: s.id,
				name: s.name,
				email: s.email,
				relationship: s.relationship,
				individualName: s.individual.name ?? s.individual.email,
				hasActiveToken
			};
		})
	};
};
