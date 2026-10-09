import { error, fail } from '@sveltejs/kit';
import { dev } from '$app/environment';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

const SEED_EMAIL_PATTERN = '+seed@test.forbetra.com';

export const load: PageServerLoad = async (event) => {
	if (!dev) throw error(404, 'Not found');
	requireRole(event, 'ADMIN');

	const seedUsers = await prisma.user.findMany({
		where: { email: { contains: SEED_EMAIL_PATTERN } },
		select: { id: true, email: true, name: true, role: true }
	});

	const seedCount = {
		users: seedUsers.length,
		coaches: seedUsers.filter((u) => u.role === 'COACH').length,
		individuals: seedUsers.filter((u) => u.role === 'INDIVIDUAL').length
	};

	return { seedUsers, seedCount };
};

export const actions: Actions = {
	clean: async (event) => {
		if (!dev) throw error(404, 'Not found');
		requireRole(event, 'ADMIN');

		try {
			const seedUsers = await prisma.user.findMany({
				where: { email: { contains: SEED_EMAIL_PATTERN } },
				include: {
					goals: {
						include: {
							journeys: {
								select: { id: true }
							},
							reviewers: { select: { id: true } },
							focusAreas: { select: { id: true } }
						}
					}
				}
			});

			if (seedUsers.length === 0) {
				return { cleanSuccess: true, message: 'No seed data to clean.' };
			}

			await prisma.$transaction(async (tx) => {
				for (const user of seedUsers) {
					for (const goal of user.goals) {
						for (const journey of goal.journeys) {
							await tx.coachNote.deleteMany({ where: { journeyId: journey.id } });
						}
						// Journeys cascade to their check-ins, feedback, and tokens
						await tx.journey.deleteMany({ where: { goalId: goal.id } });
						await tx.focusArea.deleteMany({ where: { goalId: goal.id } });
						await tx.reviewer.deleteMany({ where: { goalId: goal.id } });
					}
					await tx.reviewer.deleteMany({ where: { individualId: user.id } });
					await tx.goal.deleteMany({ where: { userId: user.id } });
					await tx.coachClient.deleteMany({
						where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
					});
					await tx.coachNote.deleteMany({
						where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
					});
					await tx.coachInvite.deleteMany({
						where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
					});
					await tx.insight.deleteMany({ where: { userId: user.id } });
					await tx.token.deleteMany({ where: { userId: user.id } });
					await tx.user.delete({ where: { id: user.id } });
				}
			});

			return {
				cleanSuccess: true,
				message: `Cleaned ${seedUsers.length} seed users and all related data.`
			};
		} catch (error) {
			console.error('Failed to clean seed data', error);
			return fail(500, { error: 'Failed to clean seed data. Check server logs.' });
		}
	}
};
