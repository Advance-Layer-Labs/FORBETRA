import { redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { weekNumberForDate } from '$lib/server/domain';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');
	const { id } = event.params;

	const goal = await prisma.goal.findUnique({
		where: { id },
		include: {
			user: { select: { id: true, name: true, email: true, role: true, timezone: true } },
			focusAreas: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
			journeys: {
				orderBy: { startDate: 'desc' },
				include: {
					_count: { select: { checkIns: true, coachNotes: true } },
					checkIns: {
						orderBy: { submittedAt: 'desc' },
						take: 30,
						select: {
							id: true,
							effortScore: true,
							performanceScore: true,
							submittedAt: true
						}
					}
				}
			}
		}
	});

	if (!goal) {
		throw redirect(303, '/admin/goals');
	}

	const reviewers = await prisma.reviewer.findMany({
		where: { individualId: goal.userId, OR: [{ goalId: null }, { goalId: goal.id }] },
		orderBy: { createdAt: 'asc' },
		include: {
			_count: { select: { feedback: true } },
			feedback: {
				orderBy: { submittedAt: 'desc' },
				take: 1,
				select: { submittedAt: true }
			}
		}
	});

	return {
		goal: {
			...goal,
			journeys: goal.journeys.map((journey) => ({
				...journey,
				checkIns: journey.checkIns.map((checkIn) => ({
					...checkIn,
					weekNumber: weekNumberForDate(journey.startDate, checkIn.submittedAt, goal.user.timezone)
				}))
			})),
			reviewers
		}
	};
};
