import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const { goal, journey, checkIns, feedback: allFeedbacks } = await event.parent();

	const reflectionTrendMap = new Map<
		number,
		{
			weekNumber: number;
			effortScores: number[];
			performanceScores: number[];
		}
	>();

	checkIns.forEach((checkIn) => {
		const weekEntry = reflectionTrendMap.get(checkIn.weekNumber) ?? {
			weekNumber: checkIn.weekNumber,
			effortScores: [],
			performanceScores: []
		};
		weekEntry.effortScores.push(checkIn.effortScore);
		weekEntry.performanceScores.push(checkIn.performanceScore);
		reflectionTrendMap.set(checkIn.weekNumber, weekEntry);
	});

	// Prepare data for Correlation View and Gap Lens
	let correlationData: {
		individual: Array<{ effort: number; progress: number; weekNumber: number }>;
		reviewers: Array<{
			effort: number;
			progress: number;
			weekNumber: number;
			reviewerName: string;
		}>;
	} | null = null;

	let gapLensData: {
		effort: Array<{ weekNumber: number; difference: number }>;
		performance: Array<{ weekNumber: number; difference: number }>;
		reviewers: Array<{
			id: string;
			name: string;
			effortGaps: Array<{ weekNumber: number; difference: number }>;
			performanceGaps: Array<{ weekNumber: number; difference: number }>;
		}>;
	} | null = null;

	if (journey) {
		// Build individual weekly data
		const allReflectionWeeks = Array.from(reflectionTrendMap.values()).sort(
			(a, b) => a.weekNumber - b.weekNumber
		);

		const individualWeeklyData = allReflectionWeeks.map((week) => {
			const effortAverage =
				week.effortScores.length > 0
					? Number(
							(
								week.effortScores.reduce((sum, score) => sum + score, 0) / week.effortScores.length
							).toFixed(1)
						)
					: null;
			const progressAverage =
				week.performanceScores.length > 0
					? Number(
							(
								week.performanceScores.reduce((sum, score) => sum + score, 0) /
								week.performanceScores.length
							).toFixed(1)
						)
					: null;

			return {
				weekNumber: week.weekNumber,
				effortScore: effortAverage,
				performanceScore: progressAverage
			};
		});

		// Prepare correlation data (only weeks with both effort and progress)
		const individualCorrelation = individualWeeklyData
			.filter((week) => week.effortScore !== null && week.performanceScore !== null)
			.map((week) => ({
				effort: week.effortScore!,
				progress: week.performanceScore!,
				weekNumber: week.weekNumber
			}));

		// Prepare reviewer correlation data (exclude Week 13)
		const reviewerCorrelation: Array<{
			effort: number;
			progress: number;
			weekNumber: number;
			reviewerName: string;
		}> = [];

		allFeedbacks.forEach((feedback) => {
			if (feedback.effortScore !== null && feedback.performanceScore !== null) {
				reviewerCorrelation.push({
					effort: feedback.effortScore,
					progress: feedback.performanceScore,
					weekNumber: feedback.weekNumber,
					reviewerName: feedback.reviewer.name
				});
			}
		});

		correlationData = {
			individual: individualCorrelation,
			reviewers: reviewerCorrelation
		};

		// Prepare Gap Lens data (Self - Reviewer difference)
		// Average gap across all reviewers
		const gapLensEffort: Array<{ weekNumber: number; difference: number }> = [];
		const gapLensPerformance: Array<{ weekNumber: number; difference: number }> = [];

		// Per-reviewer gaps
		const gapLensEffortByReviewer: Map<
			string,
			Array<{ weekNumber: number; difference: number }>
		> = new Map();
		const gapLensPerformanceByReviewer: Map<
			string,
			Array<{ weekNumber: number; difference: number }>
		> = new Map();

		// Group reviewer feedbacks by week and calculate averages
		const reviewerWeeklyMap = new Map<
			number,
			{
				effortScores: number[];
				performanceScores: number[];
			}
		>();

		// Group by reviewer for individual gap calculations
		const reviewerFeedbackMap = new Map<
			string,
			Array<{ weekNumber: number; effortScore: number | null; performanceScore: number | null }>
		>();

		allFeedbacks.forEach((feedback) => {
			{
				const weekNumber = feedback.weekNumber;
				const reviewerId = feedback.reviewer.id;

				// For average calculation
				if (!reviewerWeeklyMap.has(weekNumber)) {
					reviewerWeeklyMap.set(weekNumber, { effortScores: [], performanceScores: [] });
				}
				const weekData = reviewerWeeklyMap.get(weekNumber)!;
				if (feedback.effortScore !== null) {
					weekData.effortScores.push(feedback.effortScore);
				}
				if (feedback.performanceScore !== null) {
					weekData.performanceScores.push(feedback.performanceScore);
				}

				// For per-reviewer calculation
				if (!reviewerFeedbackMap.has(reviewerId)) {
					reviewerFeedbackMap.set(reviewerId, []);
				}
				reviewerFeedbackMap.get(reviewerId)!.push({
					weekNumber,
					effortScore: feedback.effortScore,
					performanceScore: feedback.performanceScore
				});

				// Initialize per-reviewer gap arrays
				if (!gapLensEffortByReviewer.has(reviewerId)) {
					gapLensEffortByReviewer.set(reviewerId, []);
				}
				if (!gapLensPerformanceByReviewer.has(reviewerId)) {
					gapLensPerformanceByReviewer.set(reviewerId, []);
				}
			}
		});

		// Calculate average gaps for each week
		individualWeeklyData.forEach((week) => {
			const reviewerWeekData = reviewerWeeklyMap.get(week.weekNumber);
			if (reviewerWeekData) {
				if (week.effortScore !== null && reviewerWeekData.effortScores.length > 0) {
					const reviewerAvg =
						reviewerWeekData.effortScores.reduce((sum, score) => sum + score, 0) /
						reviewerWeekData.effortScores.length;
					gapLensEffort.push({
						weekNumber: week.weekNumber,
						difference: Number((week.effortScore - reviewerAvg).toFixed(1))
					});
				}
				if (week.performanceScore !== null && reviewerWeekData.performanceScores.length > 0) {
					const reviewerAvg =
						reviewerWeekData.performanceScores.reduce((sum, score) => sum + score, 0) /
						reviewerWeekData.performanceScores.length;
					gapLensPerformance.push({
						weekNumber: week.weekNumber,
						difference: Number((week.performanceScore - reviewerAvg).toFixed(1))
					});
				}
			}

			// Calculate per-reviewer gaps
			reviewerFeedbackMap.forEach((feedbacks, reviewerId) => {
				const weekFeedback = feedbacks.find((f) => f.weekNumber === week.weekNumber);
				if (weekFeedback) {
					// Effort gap for this reviewer
					if (week.effortScore !== null && weekFeedback.effortScore !== null) {
						const gapArray = gapLensEffortByReviewer.get(reviewerId)!;
						gapArray.push({
							weekNumber: week.weekNumber,
							difference: Number((week.effortScore - weekFeedback.effortScore).toFixed(1))
						});
					}
					// Performance gap for this reviewer
					if (week.performanceScore !== null && weekFeedback.performanceScore !== null) {
						const gapArray = gapLensPerformanceByReviewer.get(reviewerId)!;
						gapArray.push({
							weekNumber: week.weekNumber,
							difference: Number((week.performanceScore - weekFeedback.performanceScore).toFixed(1))
						});
					}
				}
			});
		});

		// Sort by week number
		gapLensEffort.sort((a, b) => a.weekNumber - b.weekNumber);
		gapLensPerformance.sort((a, b) => a.weekNumber - b.weekNumber);

		// Sort per-reviewer gaps
		gapLensEffortByReviewer.forEach((gaps) => gaps.sort((a, b) => a.weekNumber - b.weekNumber));
		gapLensPerformanceByReviewer.forEach((gaps) =>
			gaps.sort((a, b) => a.weekNumber - b.weekNumber)
		);

		// Build reviewer list with their gap data
		const reviewersWithGaps = goal.reviewers.map((reviewer) => {
			const effortGaps = gapLensEffortByReviewer.get(reviewer.id) ?? [];
			const performanceGaps = gapLensPerformanceByReviewer.get(reviewer.id) ?? [];
			return {
				id: reviewer.id,
				name: reviewer.name,
				effortGaps,
				performanceGaps
			};
		});

		gapLensData = {
			effort: gapLensEffort,
			performance: gapLensPerformance,
			reviewers: reviewersWithGaps
		};
	}

	let cycleReport: {
		id: string;
		content: string | null;
		createdAt: Date;
		thumbs: number | null;
	} | null = null;
	let weeklyInsight: { id: string; content: string | null; weekNumber: number | null } | null =
		null;
	if (journey) {
		[cycleReport, weeklyInsight] = await Promise.all([
			prisma.insight.findFirst({
				where: {
					userId: dbUser.id,
					journeyId: journey.id,
					status: 'COMPLETED',
					type: 'JOURNEY_REPORT'
				},
				orderBy: { createdAt: 'desc' },
				select: { id: true, content: true, createdAt: true, thumbs: true }
			}),
			prisma.insight.findFirst({
				where: {
					userId: dbUser.id,
					journeyId: journey.id,
					status: 'COMPLETED',
					type: { in: ['CHECK_IN', 'WEEKLY_SYNTHESIS'] }
				},
				orderBy: { createdAt: 'desc' },
				select: { id: true, content: true, weekNumber: true }
			})
		]);
	}

	// History data: checkIns grouped by week (merged from history page)
	type HistoryWeek = {
		weekNumber: number;
		checkIns: Array<{
			id: string;
			effortScore: number | null;
			performanceScore: number | null;
			notes: string | null;
			checkInDate: string;
		}>;
	};
	let historyWeeks: HistoryWeek[] = [];

	{
		const historyWeekMap = new Map<number, HistoryWeek['checkIns']>();
		for (const r of checkIns) {
			if (!historyWeekMap.has(r.weekNumber)) {
				historyWeekMap.set(r.weekNumber, []);
			}
			historyWeekMap.get(r.weekNumber)!.push({
				id: r.id,
				effortScore: r.effortScore,
				performanceScore: r.performanceScore,
				notes: r.notes,
				checkInDate: r.submittedAt.toISOString()
			});
		}
		historyWeeks = Array.from(historyWeekMap.entries())
			.map(([weekNumber, checkIns]) => ({ weekNumber, checkIns }))
			.sort((a, b) => b.weekNumber - a.weekNumber);
	}

	return {
		goal: {
			id: goal.id,
			title: goal.title
		},
		correlationData,
		gapLensData,
		cycleReport,
		weeklyInsight,
		historyWeeks
	};
};
