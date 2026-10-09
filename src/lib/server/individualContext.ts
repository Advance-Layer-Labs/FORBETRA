import prisma from '$lib/server/prisma';
import { currentWeekNumber } from '$lib/server/domain/week';

export async function listJourneysForBoard(userId: string) {
	const user = await prisma.user.findUnique({
		where: { id: userId },
		select: { timezone: true }
	});
	const journeys = await prisma.journey.findMany({
		where: { userId },
		orderBy: { startDate: 'desc' },
		include: {
			goal: {
				select: {
					id: true,
					title: true,
					description: true,
					active: true,
					reviewers: { select: { id: true } },
					focusAreas: { where: { active: true }, select: { id: true } }
				}
			},
			_count: { select: { checkIns: true } }
		}
	});

	return journeys.map((journey) => ({
		id: journey.id,
		label: journey.label,
		status: journey.status,
		startDate: journey.startDate.toISOString(),
		endDate: journey.endDate?.toISOString() ?? null,
		lengthWeeks: journey.lengthWeeks,
		goalId: journey.goal.id,
		goalTitle: journey.goal.title,
		goalDescription: journey.goal.description,
		goalActive: journey.goal.active,
		checkInCount: journey._count.checkIns,
		reviewerCount: journey.goal.reviewers.length,
		focusAreaCount: journey.goal.focusAreas.length,
		currentWeek: currentWeekNumber(journey.startDate, new Date(), user?.timezone)
	}));
}

/** Active journey first, then the newest by start date. A newer completed journey must not hide it. */
export function pickCurrentJourney<T extends { status: string; startDate: Date }>(
	journeys: T[]
): T | null {
	const byStart = (a: T, b: T) => b.startDate.getTime() - a.startDate.getTime();
	const active = journeys.filter((journey) => journey.status === 'ACTIVE').sort(byStart);
	if (active.length > 0) return active[0];
	const rest = [...journeys].sort(byStart);
	return rest[0] ?? null;
}

export async function getActiveGoalWithJourney(userId: string) {
	const [goal, user] = await Promise.all([
		prisma.goal.findFirst({
			where: { userId, active: true },
			orderBy: { createdAt: 'desc' },
			include: {
				focusAreas: { where: { active: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
				journeys: { orderBy: { startDate: 'desc' }, take: 8 },
				reviewers: { orderBy: { createdAt: 'asc' } }
			}
		}),
		prisma.user.findUnique({
			where: { id: userId },
			select: { timezone: true }
		})
	]);

	if (!goal) return null;
	const journey = pickCurrentJourney(goal.journeys);
	const timeZone = user?.timezone ?? null;
	const currentWeek = journey ? currentWeekNumber(journey.startDate, new Date(), timeZone) : null;
	return { goal, journey, currentWeek, timeZone };
}
