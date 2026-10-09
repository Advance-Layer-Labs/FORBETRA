import { redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import { currentWeekNumber } from '$lib/server/domain';
import { withCheckInWeeks } from '$lib/server/hubMetrics';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const result = await getActiveGoalWithJourney(dbUser.id);

	if (!result || !result.journey) {
		throw redirect(303, '/onboarding');
	}

	const { goal, journey } = result;
	const timeZone = dbUser.timezone;
	const currentWeek =
		result.currentWeek ?? currentWeekNumber(journey.startDate, new Date(), timeZone);

	const [rawCheckIns, feedback] = await Promise.all([
		prisma.checkIn.findMany({
			where: { journeyId: journey.id },
			orderBy: { submittedAt: 'asc' }
		}),
		prisma.feedback.findMany({
			where: { journeyId: journey.id },
			orderBy: { submittedAt: 'asc' },
			include: {
				reviewer: {
					select: { id: true, name: true, relationship: true, attribution: true, cadence: true }
				}
			}
		})
	]);

	const checkIns = withCheckInWeeks(journey.startDate, rawCheckIns, timeZone);

	return {
		dbUserId: dbUser.id,
		dbUserName: dbUser.name,
		goal,
		journey,
		currentWeek,
		checkIns,
		feedback
	};
};
