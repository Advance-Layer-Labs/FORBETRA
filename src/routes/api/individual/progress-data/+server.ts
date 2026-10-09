import { json, error } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import {
	computeMyLastRatings,
	computeReviewersLastRatings,
	computeHeatMap,
	computeVisualizationData,
	computeCompletionMetrics,
	withCheckInWeeks
} from '$lib/server/hubMetrics';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const result = await getActiveGoalWithJourney(dbUser.id);
	if (!result?.journey) {
		throw error(404, 'No active journey');
	}

	const { goal, journey, currentWeek } = result;
	if (!currentWeek) {
		throw error(404, 'No active week');
	}

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
	const summary = computeCompletionMetrics(checkIns, currentWeek);
	const { weeks: heatMapWeeks, totalWeeks } = computeHeatMap(
		checkIns,
		currentWeek,
		journey.lengthWeeks
	);
	const visualizationData =
		heatMapWeeks.length > 0
			? computeVisualizationData(heatMapWeeks, allFeedbacks, reviewers)
			: null;

	return json({
		myLastRatings,
		reviewersLastRatings,
		summary: { ...summary, totalReviewers: reviewers.length },
		heatMapWeeks,
		totalWeeks,
		visualizationData
	});
};
