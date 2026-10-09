import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const [individuals, coaches, reviewers] = await Promise.all([
		prisma.user.findMany({
			where: { role: 'INDIVIDUAL' },
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				email: true,
				goals: {
					where: { active: true },
					orderBy: { createdAt: 'desc' },
					take: 1,
					select: {
						title: true,
						journeys: {
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
		prisma.reviewer.findMany({
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
			goalTitle: u.goals[0]?.title ?? null,
			cycleStatus: u.goals[0]?.journeys[0]?.status ?? null,
			cycleLabel: u.goals[0]?.journeys[0]?.label ?? null
		})),
		coaches: coaches.map((u) => ({
			id: u.id,
			name: u.name,
			email: u.email,
			clientCount: u._count.coachClientsManaged
		})),
		reviewers: reviewers.map((s) => {
			// Tokens are hashed now (see src/lib/server/tokenHash.ts); the hash is
			// not a usable URL. Admin should impersonate the reviewer to test
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
