import { json, error } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import {
	computeMyLastRatings,
	computeReviewersLastRatings,
	computePerceptionGaps,
	withCheckInWeeks
} from '$lib/server/hubMetrics';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const result = await getActiveGoalWithJourney(dbUser.id);
	if (!result?.journey) {
		throw error(404, 'No active journey');
	}

	const { goal, journey } = result;

	const [checkInRows, allFeedbacks, reviewers] = await Promise.all([
		prisma.checkIn.findMany({
			where: { journeyId: journey.id },
			orderBy: { submittedAt: 'asc' },
			select: { id: true, effortScore: true, performanceScore: true, submittedAt: true }
		}),
		prisma.feedback.findMany({
			where: { journeyId: journey.id },
			select: {
				reviewerId: true,
				weekNumber: true,
				effortScore: true,
				performanceScore: true,
				submittedAt: true
			},
			orderBy: { submittedAt: 'desc' }
		}),
		prisma.reviewer.findMany({
			where: { individualId: dbUser.id, OR: [{ goalId: null }, { goalId: goal.id }] },
			orderBy: { createdAt: 'asc' },
			select: { id: true, name: true }
		})
	]);

	const checkIns = withCheckInWeeks(journey.startDate, checkInRows, result.timeZone);
	const myLastRatings = computeMyLastRatings(checkIns);
	const reviewersLastRatings = computeReviewersLastRatings(allFeedbacks);
	const perceptionGaps =
		allFeedbacks.length > 0 ? computePerceptionGaps(allFeedbacks, checkIns, reviewers) : null;

	const uniqueRatedReviewers = new Set(allFeedbacks.map((f) => f.reviewerId)).size;

	return json({
		myLastRatings,
		reviewersLastRatings,
		perceptionGaps,
		hasMultipleReviewerRatings: uniqueRatedReviewers >= 2,
		totalReviewers: reviewers.length
	});
};
