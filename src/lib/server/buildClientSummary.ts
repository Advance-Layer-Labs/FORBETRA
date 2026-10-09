import { toIsoDate, weeksBetween, stdDev } from './coachUtils';
import { currentWeekNumber, weekNumberForDate } from './domain/week';

/**
 * Check-ins must carry a derived `weekNumber` (see `withCheckInWeeks`).
 * Feedback rows carry their own `weekNumber`; the legacy `reflection.weekNumber`
 * is still read as a fallback. Legacy cadence / kind fields are accepted and ignored.
 */
type IndividualWithRelations = {
	id: string;
	email: string;
	name: string | null;
	timezone?: string | null;
	goals: Array<{
		id: string;
		title: string;
		description: string | null;
		focusAreas: Array<{ id: string; label: string; description: string | null }>;
		journeys: Array<{
			id: string;
			label: string | null;
			startDate: Date;
			endDate: Date | null;
			status: string;
			lengthWeeks?: number;
			checkIns: Array<{
				id: string;
				weekNumber: number;
				submittedAt: Date | null;
				effortScore: number | null;
				performanceScore: number | null;
				notes: string | null;
			}>;
			coachNotes: Array<{
				id: string;
				content: string;
				weekNumber: number | null;
				createdAt: Date;
			}>;
		}>;
		reviewers: Array<{
			id: string;
			name: string;
			email: string;
			cadence?: 'WEEKLY' | 'BIWEEKLY';
			feedbacks: Array<{
				submittedAt: Date | null;
				effortScore: number | null;
				performanceScore: number | null;
				weekNumber?: number;
				reflection?: { weekNumber: number } | null;
			}>;
		}>;
	}>;
};

const feedbackWeek = (f: { weekNumber?: number; reflection?: { weekNumber: number } | null }) =>
	f.weekNumber ?? f.reflection?.weekNumber ?? null;

type CoachClient = {
	id: string;
	individualId: string;
	createdAt: Date;
	archivedAt: Date | null;
};

export type ClientSummary = {
	id: string;
	name: string;
	email: string;
	archived: boolean;
	joinedAt: string;
	archivedAt: string | null;
	goal: {
		id: string;
		title: string;
		description: string;
		journey: {
			id: string;
			label: string;
			startDate: string | null;
			endDate: string | null;
			status: string;
			completion: number;
			weeksElapsed: number;
			currentWeek: number | null;
			lengthWeeks: number | null;
			recentReflections: Array<{
				weekNumber: number;
				effortScore: number | null;
				performanceScore: number | null;
			}>;
		} | null;
		focusAreaCount: number;
		reviewerCount: number;
		respondedReviewers: number;
		insights: {
			avgEffort: number | null;
			avgProgress: number | null;
			stabilityScore: number | null;
			trajectoryScore: number | null;
			alignmentRatio: number | null;
		} | null;
	} | null;
	reviewers: Array<{
		id: string;
		name: string;
		email: string;
		cadence: 'WEEKLY' | 'BIWEEKLY';
		lastFeedback: {
			submittedAt: string | null;
			effortScore: number | null;
			performanceScore: number | null;
			weekNumber: number | null;
		} | null;
	}>;
	alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }>;
	coachNotes: Array<{
		id: string;
		content: string;
		weekNumber: number | null;
		createdAt: string;
	}>;
	visualizationData?: {
		individual: Array<{
			weekNumber: number;
			effortScore: number | null;
			performanceScore: number | null;
		}>;
		reviewers: Array<{
			weekNumber: number;
			reviewerId: string;
			reviewerName: string;
			effortScore: number | null;
			performanceScore: number | null;
		}>;
		reviewerList: Array<{ id: string; name: string }>;
	};
};

export function buildClientSummary(
	relationship: CoachClient,
	individual: IndividualWithRelations | null
): ClientSummary | null {
	if (!individual) {
		return null;
	}

	const goal = individual.goals[0] ?? null;
	const journey = goal?.journeys[0] ?? null;
	const cycleEnd = journey?.endDate ?? null;
	const totalWeeks = journey
		? cycleEnd
			? weeksBetween(journey.startDate, cycleEnd)
			: (journey.lengthWeeks ?? 0)
		: 0;
	const currentTime = new Date();
	const weeksElapsed = journey
		? Math.max(
				0,
				Math.floor(
					(currentTime.getTime() - journey.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
				)
			)
		: 0;
	const completion =
		totalWeeks > 0 ? Math.min(100, Math.round((weeksElapsed / totalWeeks) * 100)) : 0;
	const currentWeek = journey
		? currentWeekNumber(journey.startDate, new Date(), individual.timezone)
		: null;

	const reflectionTrendMap = new Map<
		number,
		{
			weekNumber: number;
			effortScores: number[];
			performanceScores: number[];
		}
	>();

	journey?.checkIns.forEach((reflection) => {
		const weekEntry = reflectionTrendMap.get(reflection.weekNumber) ?? {
			weekNumber: reflection.weekNumber,
			effortScores: [],
			performanceScores: []
		};

		if (reflection.effortScore !== null && reflection.effortScore !== undefined) {
			weekEntry.effortScores.push(reflection.effortScore);
		}
		if (reflection.performanceScore !== null && reflection.performanceScore !== undefined) {
			weekEntry.performanceScores.push(reflection.performanceScore);
		}

		reflectionTrendMap.set(reflection.weekNumber, weekEntry);
	});

	const trendWeeks = Array.from(reflectionTrendMap.values())
		.sort((a, b) => b.weekNumber - a.weekNumber)
		.slice(0, 4);

	const effortSeries: number[] = [];
	const progressSeries: number[] = [];

	const reflectionTrend = trendWeeks.map((week) => {
		const effortAverage =
			week.effortScores.length > 0
				? Number(
						(
							week.effortScores.reduce((sum, score) => sum + score, 0) / week.effortScores.length
						).toFixed(1)
					)
				: null;
		if (effortAverage !== null) effortSeries.push(effortAverage);

		const progressAverage =
			week.performanceScores.length > 0
				? Number(
						(
							week.performanceScores.reduce((sum, score) => sum + score, 0) /
							week.performanceScores.length
						).toFixed(1)
					)
				: null;
		if (progressAverage !== null) progressSeries.push(progressAverage);

		return {
			weekNumber: week.weekNumber,
			effortScore: effortAverage,
			performanceScore: progressAverage
		};
	});

	const effortStd = stdDev(effortSeries);
	const progressStd = stdDev(progressSeries);
	const stdValues = [effortStd, progressStd].filter((value): value is number => value !== null);
	const combinedStd =
		stdValues.length > 0
			? stdValues.reduce((sum, value) => sum + value, 0) / stdValues.length
			: null;
	const stabilityScore =
		combinedStd !== null ? Math.max(0, Math.round(100 - combinedStd * 10)) : null;

	// Trajectory: linear regression slope of last 4 weeks combined effort+performance
	let trajectoryScore: number | null = null;
	if (trendWeeks.length >= 2) {
		const points: { x: number; y: number }[] = [];
		for (const week of trendWeeks) {
			const effortAvg =
				week.effortScores.length > 0
					? week.effortScores.reduce((s, v) => s + v, 0) / week.effortScores.length
					: null;
			const perfAvg =
				week.performanceScores.length > 0
					? week.performanceScores.reduce((s, v) => s + v, 0) / week.performanceScores.length
					: null;
			const vals = [effortAvg, perfAvg].filter((v): v is number => v !== null);
			if (vals.length > 0) {
				points.push({ x: week.weekNumber, y: vals.reduce((a, b) => a + b, 0) / vals.length });
			}
		}
		if (points.length >= 2) {
			const n = points.length;
			const sumX = points.reduce((s, p) => s + p.x, 0);
			const sumY = points.reduce((s, p) => s + p.y, 0);
			const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
			const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
			const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
			trajectoryScore = Math.max(-100, Math.min(100, Math.round(slope * 25)));
		}
	}

	let respondedReviewers = 0;
	const reviewers =
		goal?.reviewers.map((reviewer) => {
			const lastFeedback = reviewer.feedbacks[0] ?? null;
			let lastWeek: number | null = null;
			if (lastFeedback && journey) {
				lastWeek =
					feedbackWeek(lastFeedback) ??
					(lastFeedback.submittedAt
						? weekNumberForDate(journey.startDate, lastFeedback.submittedAt, individual.timezone)
						: null);
				if (currentWeek !== null && lastWeek === currentWeek) {
					respondedReviewers += 1;
				}
			}
			return {
				id: reviewer.id,
				name: reviewer.name,
				email: reviewer.email,
				cadence: reviewer.cadence ?? 'WEEKLY',
				lastFeedback: lastFeedback
					? {
							submittedAt: lastFeedback.submittedAt?.toISOString() ?? null,
							effortScore: lastFeedback.effortScore,
							performanceScore: lastFeedback.performanceScore,
							weekNumber: lastWeek
						}
					: null
			};
		}) ?? [];

	const alignmentRatio = goal?.reviewers.length ? respondedReviewers / goal.reviewers.length : null;

	const avgEffort =
		effortSeries.length > 0
			? Number(
					(effortSeries.reduce((sum, value) => sum + value, 0) / effortSeries.length).toFixed(1)
				)
			: null;
	const avgProgress =
		progressSeries.length > 0
			? Number(
					(progressSeries.reduce((sum, value) => sum + value, 0) / progressSeries.length).toFixed(1)
				)
			: null;

	// Calculate alerts
	const alerts: Array<{ type: string; message: string; severity: 'low' | 'medium' | 'high' }> = [];

	if (journey && currentWeek) {
		const weeksWithCheckIn = new Set(journey.checkIns.map((r) => r.weekNumber));

		if (!weeksWithCheckIn.has(currentWeek)) {
			const missedLastWeek = currentWeek > 1 && !weeksWithCheckIn.has(currentWeek - 1);
			alerts.push({
				type: 'overdue',
				message: missedLastWeek
					? 'Missing: this week and last week check-ins'
					: 'Missing: this week check-in',
				severity: missedLastWeek ? 'high' : 'medium'
			});
		}

		// Engagement check (share of elapsed weeks with a check-in)
		const completedWeeks = [...weeksWithCheckIn].filter((w) => w <= currentWeek).length;
		const completionRate = currentWeek > 0 ? completedWeeks / currentWeek : 0;

		if (completionRate < 0.7 && currentWeek >= 2) {
			alerts.push({
				type: 'low_engagement',
				message: `Check-in completion: ${Math.round(completionRate * 100)}% (below 70%)`,
				severity: completionRate < 0.5 ? 'high' : 'medium'
			});
		}

		// Alignment check (self-other gap)
		if (goal?.reviewers.length && journey.checkIns.length > 0) {
			const recentReflections = journey.checkIns
				.filter((r) => r.weekNumber >= currentWeek - 3 && r.weekNumber <= currentWeek)
				.filter((r) => r.effortScore !== null || r.performanceScore !== null);

			if (recentReflections.length > 0) {
				const alignmentIssues: number[] = [];
				for (const reflection of recentReflections) {
					const reflectionFeedbacks = goal.reviewers
						.flatMap((s) => s.feedbacks)
						.filter((f) => feedbackWeek(f) === reflection.weekNumber);

					if (reflectionFeedbacks.length > 0) {
						const avgReviewerEffort =
							reflectionFeedbacks
								.map((f) => f.effortScore)
								.filter((s): s is number => s !== null)
								.reduce((sum, s) => sum + s, 0) / reflectionFeedbacks.length;

						const avgReviewerProgress =
							reflectionFeedbacks
								.map((f) => f.performanceScore)
								.filter((s): s is number => s !== null)
								.reduce((sum, s) => sum + s, 0) / reflectionFeedbacks.length;

						if (reflection.effortScore !== null) {
							const effortGap = Math.abs(reflection.effortScore - avgReviewerEffort);
							if (effortGap > 1.5) alignmentIssues.push(reflection.weekNumber);
						}
						if (reflection.performanceScore !== null) {
							const progressGap = Math.abs(reflection.performanceScore - avgReviewerProgress);
							if (progressGap > 1.5) alignmentIssues.push(reflection.weekNumber);
						}
					}
				}

				const uniqueWeeksWithIssues = new Set(alignmentIssues).size;
				if (uniqueWeeksWithIssues >= 3) {
					alerts.push({
						type: 'low_alignment',
						message: `Self-other gap detected in ${uniqueWeeksWithIssues} recent weeks`,
						severity: uniqueWeeksWithIssues >= 4 ? 'high' : 'medium'
					});
				}
			}
		}
	}

	// Get coach notes for this client
	const coachNotes = journey?.coachNotes ?? [];

	// Prepare visualization data (all weeks, not just last 4)
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

	// Prepare reviewer feedback data by week for visualization
	const reviewerWeeklyData: Array<{
		weekNumber: number;
		reviewerId: string;
		reviewerName: string;
		effortScore: number | null;
		performanceScore: number | null;
	}> = [];

	goal?.reviewers.forEach((reviewer) => {
		reviewer.feedbacks.forEach((feedback) => {
			const weekNumber = feedbackWeek(feedback);
			if (weekNumber !== null) {
				reviewerWeeklyData.push({
					weekNumber,
					reviewerId: reviewer.id,
					reviewerName: reviewer.name,
					effortScore: feedback.effortScore,
					performanceScore: feedback.performanceScore
				});
			}
		});
	});

	return {
		id: individual.id,
		name: individual.name ?? individual.email,
		email: individual.email,
		goal: goal
			? {
					id: goal.id,
					title: goal.title,
					description: goal.description ?? '',
					journey: journey
						? {
								id: journey.id,
								label: journey.label ?? 'Journey',
								startDate: toIsoDate(journey.startDate),
								endDate: toIsoDate(journey.endDate ?? null),
								status: journey.status,
								completion,
								weeksElapsed,
								currentWeek: currentWeek ?? null,
								lengthWeeks: journey.lengthWeeks ?? null,
								recentReflections: reflectionTrend
							}
						: null,
					focusAreaCount: goal.focusAreas.length,
					reviewerCount: reviewers.length,
					respondedReviewers,
					insights: journey
						? {
								avgEffort,
								avgProgress,
								stabilityScore,
								trajectoryScore,
								alignmentRatio
							}
						: null
				}
			: null,
		reviewers,
		alerts,
		coachNotes: coachNotes.map((note) => ({
			id: note.id,
			content: note.content,
			weekNumber: note.weekNumber,
			createdAt: note.createdAt.toISOString()
		})),
		archived: relationship.archivedAt !== null,
		joinedAt: relationship.createdAt.toISOString(),
		archivedAt: relationship.archivedAt?.toISOString() ?? null,
		visualizationData: journey
			? {
					individual: individualWeeklyData,
					reviewers: reviewerWeeklyData,
					reviewerList: reviewers.map((s) => ({ id: s.id, name: s.name }))
				}
			: undefined
	};
}
