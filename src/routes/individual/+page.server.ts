import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import {
	computeCompletionMetrics,
	computeNextAction,
	computeNextCheckInDay
} from '$lib/server/hubMetrics';
import { checkInEntrySchema } from '$lib/validation/reflection';
import { computeWeekNumber, getDateForWeekday } from '$lib/server/coachUtils';
import { parseCheckInDays } from '$lib/utils/checkInDays';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import type { Actions, PageServerLoad } from './$types';
import type { ReflectionType } from '@prisma/client';

export type MaturityStage = 'new' | 'growing' | 'established';

function getMaturityStage(reflectionCount: number): MaturityStage {
	if (reflectionCount >= 12) return 'established';
	if (reflectionCount >= 4) return 'growing';
	return 'new';
}

function computeTotalWeeks(startDate: Date, endDate: Date | null, currentWeek: number): number {
	if (endDate) {
		return Math.max(
			1,
			Math.ceil((endDate.getTime() - startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
		);
	}
	return currentWeek;
}

function dayNameToNumber(day: string): number {
	const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
	return map[day] ?? 3;
}

function getCheckInAvailability(
	startDate: Date,
	weekNumber: number,
	checkInFrequency: string
): { type: ReflectionType; isAvailable: boolean } {
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const days = parseCheckInDays(checkInFrequency);
	const dayNumbers = days.map(dayNameToNumber);
	const sortedDays = [...dayNumbers].sort((a, b) => a - b);

	for (const day of sortedDays) {
		const dayDate = getDateForWeekday(day, startDate, weekNumber);
		if (today >= dayDate) {
			return { type: 'RATING_A', isAvailable: true };
		}
	}
	return { type: 'RATING_A', isAvailable: false };
}

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const { objective, cycle, currentWeek } = await event.parent();

	const [hasAnyObjective, coachClient, latestInsight, feedbacks] = await Promise.all([
		prisma.objective.findFirst({
			where: { userId: dbUser.id },
			select: { id: true }
		}),
		prisma.coachClient.findFirst({
			where: { individualId: dbUser.id },
			select: { coach: { select: { name: true } } }
		}),
		cycle
			? prisma.insight.findFirst({
					where: {
						userId: dbUser.id,
						cycleId: cycle.id,
						status: 'COMPLETED',
						type: { in: ['CHECK_IN', 'WEEKLY_SYNTHESIS'] }
					},
					orderBy: { createdAt: 'desc' },
					select: { id: true, content: true, type: true, weekNumber: true, createdAt: true }
				})
			: null,
		cycle
			? prisma.feedback.findMany({
					where: { reflection: { cycleId: cycle.id } },
					select: {
						effortScore: true,
						performanceScore: true,
						reflection: { select: { weekNumber: true } }
					}
				})
			: []
	]);

	const isFirstVisit = !hasAnyObjective;
	const isOnboardingComplete = !!(objective && cycle);
	const checkInFrequency = cycle?.checkInFrequency ?? '3x';
	const reflections = cycle?.reflections ?? [];

	// Early return for incomplete onboarding
	if (!cycle || !currentWeek || !isOnboardingComplete) {
		return {
			isFirstVisit,
			isOnboardingComplete: false,
			maturityStage: 'new' as MaturityStage,
			nextCheckInDay: computeNextCheckInDay(checkInFrequency),
			coachName: coachClient?.coach?.name ?? null,
			objective: objective
				? {
						id: objective.id,
						title: objective.title,
						subgoals: objective.subgoals.map((s) => ({ id: s.id, label: s.label }))
					}
				: null,
			summary: null,
			cycle: null,
			currentWeek: null,
			totalWeeks: null,
			nextAction: null,
			latestInsight: null,
			// Check-in fields (null for incomplete onboarding)
			identityAnchor: null,
			isCheckInDue: false,
			lastEffortScore: null,
			lastPerformanceScore: null,
			hasNewFeedback: false,
			newFeedbackRaterName: null,
			coachNudge: null
		};
	}

	const totalWeeks = computeTotalWeeks(cycle.startDate, cycle.endDate ?? null, currentWeek);
	const summary = computeCompletionMetrics(reflections, currentWeek, checkInFrequency);
	const nextAction = computeNextAction(reflections, currentWeek, checkInFrequency);
	const maturityStage = getMaturityStage(reflections.length);

	// Compute the three signals: effort trend, performance trend, perception gap
	const effortScores = reflections
		.filter((r) => r.effortScore != null)
		.sort((a, b) => a.weekNumber - b.weekNumber)
		.map((r) => ({ week: r.weekNumber, score: r.effortScore! }));
	const perfScores = reflections
		.filter((r) => r.performanceScore != null)
		.sort((a, b) => a.weekNumber - b.weekNumber)
		.map((r) => ({ week: r.weekNumber, score: r.performanceScore! }));

	const avg = (arr: number[]) =>
		arr.length > 0 ? +(arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1) : null;
	const trend = (scores: Array<{ week: number; score: number }>) => {
		if (scores.length < 2) return { direction: 'flat' as const, delta: 0 };
		const recent = scores.slice(-3).map((s) => s.score);
		const earlier = scores.slice(0, Math.max(1, scores.length - 3)).map((s) => s.score);
		const recentAvg = avg(recent)!;
		const earlierAvg = avg(earlier)!;
		const d = +(recentAvg - earlierAvg).toFixed(1);
		return {
			direction: d > 0.3 ? ('up' as const) : d < -0.3 ? ('down' as const) : ('flat' as const),
			delta: d
		};
	};

	const selfEffortAvg = avg(effortScores.map((s) => s.score));
	const selfPerfAvg = avg(perfScores.map((s) => s.score));
	const effortTrend = trend(effortScores);
	const perfTrend = trend(perfScores);

	// Perception gap
	const revEffortScores = feedbacks.filter((f) => f.effortScore != null).map((f) => f.effortScore!);
	const revPerfScores = feedbacks
		.filter((f) => f.performanceScore != null)
		.map((f) => f.performanceScore!);
	const revEffortAvg = avg(revEffortScores);
	const revPerfAvg = avg(revPerfScores);
	const effortGap =
		selfEffortAvg != null && revEffortAvg != null
			? +(selfEffortAvg - revEffortAvg).toFixed(1)
			: null;
	const perfGap =
		selfPerfAvg != null && revPerfAvg != null ? +(selfPerfAvg - revPerfAvg).toFixed(1) : null;

	// ═══ Check-in data for inline Today screen ═══

	// Identity anchor: the user's Week 1 notes or objective identity text
	let identityAnchor: string | null = null;
	const firstSubgoal = objective.subgoals[0] ?? null;
	if (firstSubgoal) {
		const week1 = await prisma.reflection.findFirst({
			where: {
				cycleId: cycle.id,
				userId: dbUser.id,
				weekNumber: 1,
				notes: { not: null }
			},
			select: { notes: true },
			orderBy: { submittedAt: 'asc' }
		});
		identityAnchor = week1?.notes?.trim() || null;
	}

	// Determine if check-in is due
	const checkInAvailability = getCheckInAvailability(
		cycle.startDate,
		currentWeek,
		checkInFrequency
	);
	const isCheckInDue = nextAction.state === 'open' && checkInAvailability.isAvailable;

	// Last scores for RatingBar lastValue prop
	let lastEffortScore: number | null = null;
	let lastPerformanceScore: number | null = null;
	if (firstSubgoal) {
		const lastReflection = await prisma.reflection.findFirst({
			where: {
				userId: dbUser.id,
				cycleId: cycle.id,
				subgoalId: firstSubgoal.id,
				weekNumber: { lt: currentWeek },
				OR: [{ effortScore: { not: null } }, { performanceScore: { not: null } }]
			},
			orderBy: { weekNumber: 'desc' },
			select: { effortScore: true, performanceScore: true }
		});
		lastEffortScore = lastReflection?.effortScore ?? null;
		lastPerformanceScore = lastReflection?.performanceScore ?? null;
	}

	// Check for recent feedback (submitted in the last 7 days)
	let hasNewFeedback = false;
	let newFeedbackRaterName: string | null = null;
	try {
		const sevenDaysAgo = new Date();
		sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
		const recentFeedback = await prisma.feedback.findFirst({
			where: {
				reflection: { cycleId: cycle.id },
				submittedAt: { gte: sevenDaysAgo }
			},
			orderBy: { submittedAt: 'desc' },
			select: {
				stakeholder: { select: { name: true } }
			}
		});
		if (recentFeedback) {
			hasNewFeedback = true;
			const name = recentFeedback.stakeholder?.name;
			if (name) {
				const parts = name.split(' ');
				newFeedbackRaterName = parts.length > 1 ? `${parts[0]} ${parts[1][0]}.` : parts[0];
			}
		}
	} catch {
		// Non-critical — skip on error
	}

	// Coach nudge (latest coach note for this individual)
	let coachNudge: { text: string; coachName: string } | null = null;
	if (coachClient?.coach?.name) {
		try {
			const recentNote = await prisma.coachNote.findFirst({
				where: {
					individualId: dbUser.id
				},
				orderBy: { createdAt: 'desc' },
				select: { content: true }
			});
			if (recentNote?.content) {
				coachNudge = {
					text: recentNote.content,
					coachName: coachClient.coach.name
				};
			}
		} catch {
			// Non-critical — skip on error
		}
	}

	return {
		isFirstVisit,
		isOnboardingComplete,
		maturityStage,
		nextCheckInDay: computeNextCheckInDay(checkInFrequency),
		coachName: coachClient?.coach?.name ?? null,
		objective: {
			id: objective.id,
			title: objective.title,
			subgoals: objective.subgoals.map((s) => ({ id: s.id, label: s.label }))
		},
		summary: {
			...summary,
			totalStakeholders: objective.stakeholders.length
		},
		cycle: {
			id: cycle.id,
			startDate: cycle.startDate.toISOString(),
			endDate: cycle.endDate?.toISOString() ?? null,
			isOverdue: currentWeek > totalWeeks,
			isCycleCompleted: cycle.status === 'COMPLETED'
		},
		currentWeek,
		totalWeeks,
		nextAction,
		latestInsight: latestInsight
			? {
					id: latestInsight.id,
					content: latestInsight.content,
					type: latestInsight.type,
					weekNumber: latestInsight.weekNumber,
					createdAt: latestInsight.createdAt.toISOString()
				}
			: null,
		signals: {
			effort: { avg: selfEffortAvg, trend: effortTrend },
			performance: { avg: selfPerfAvg, trend: perfTrend },
			reviewerEffort: { avg: revEffortAvg },
			reviewerPerformance: { avg: revPerfAvg },
			effortGap,
			perfGap,
			hasFeedback: feedbacks.length > 0,
			// Scorecard adaptive default: surface the blind-spot view as a persistent
			// ambient nudge once the user has enough feedback for the gap to be
			// statistically meaningful. 4 entries ≈ 2 weeks × 2 reviewers (or
			// 1 week × 4) — empirically the threshold where the gap stops being noise.
			scorecardReady: feedbacks.length >= 4
		},
		// Inline check-in data
		identityAnchor,
		isCheckInDue,
		lastEffortScore,
		lastPerformanceScore,
		hasNewFeedback,
		newFeedbackRaterName,
		coachNudge
	};
};

// ═══ Check-in form action (mirrors checkin/+page.server.ts) ═══

export const actions: Actions = {
	checkin: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const objective = await prisma.objective.findFirst({
			where: { userId: dbUser.id, active: true },
			orderBy: { createdAt: 'desc' },
			include: {
				cycles: {
					orderBy: { startDate: 'desc' },
					take: 1
				},
				subgoals: {
					where: { active: true },
					orderBy: { createdAt: 'asc' },
					take: 1
				}
			}
		});

		const cycle = objective?.cycles[0];
		if (!cycle) {
			return fail(400, { error: 'No active cycle found. Complete onboarding first.' });
		}

		const firstSubgoal = objective?.subgoals[0];
		if (!firstSubgoal) {
			return fail(400, { error: 'No sub-objectives found. Complete onboarding first.' });
		}

		const weekNumber = computeWeekNumber(cycle.startDate);
		const checkInFrequency = cycle.checkInFrequency ?? '3x';
		const checkInAvailability = getCheckInAvailability(
			cycle.startDate,
			weekNumber,
			checkInFrequency
		);

		if (!checkInAvailability.isAvailable) {
			return fail(400, { error: 'This check-in is not available yet.' });
		}

		const formData = await event.request.formData();
		const submission = Object.fromEntries(formData) as Record<string, string>;
		const parsed = checkInEntrySchema.safeParse(submission);

		if (!parsed.success) {
			const errors = parsed.error.flatten();
			return fail(400, {
				error:
					errors.fieldErrors.effortScore?.[0] ??
					errors.fieldErrors.performanceScore?.[0] ??
					'Invalid input'
			});
		}

		const data = parsed.data;
		const notes = data.notes ?? null;

		try {
			await prisma.reflection.upsert({
				where: {
					cycleId_weekNumber_reflectionType_subgoalId: {
						cycleId: cycle.id,
						weekNumber,
						reflectionType: 'RATING_A',
						subgoalId: firstSubgoal.id
					}
				},
				update: {
					notes,
					effortScore: data.effortScore,
					performanceScore: data.performanceScore,
					submittedAt: new Date(),
					checkInDate: new Date()
				},
				create: {
					cycleId: cycle.id,
					userId: dbUser.id,
					subgoalId: firstSubgoal.id,
					reflectionType: 'RATING_A',
					weekNumber,
					effortScore: data.effortScore,
					performanceScore: data.performanceScore,
					notes,
					checkInDate: new Date()
				}
			});

			// Compute streak
			let streak = 0;
			try {
				const allReflections = await prisma.reflection.findMany({
					where: { cycleId: cycle.id },
					select: { weekNumber: true, reflectionType: true }
				});

				const completedSet = new Set(
					allReflections.map((r) => `${r.weekNumber}-${r.reflectionType}`)
				);

				const streakCheckInDays = parseCheckInDays(checkInFrequency);
				const currentWeek = computeWeekNumber(cycle.startDate);
				const expectedSequence: Array<{ week: number; type: string }> = [];
				for (let w = 1; w <= currentWeek; w++) {
					for (let d = 0; d < streakCheckInDays.length; d++) {
						expectedSequence.push({ week: w, type: 'RATING_A' });
					}
				}

				for (let i = expectedSequence.length - 1; i >= 0; i--) {
					const expected = expectedSequence[i];
					if (completedSet.has(`${expected.week}-${expected.type}`)) {
						streak++;
					} else {
						break;
					}
				}
			} catch {
				// Streak computation is non-critical
			}

			// Send milestone email if applicable
			const milestoneThresholds = [3, 7, 14, 21, 30, 50];
			const milestone = milestoneThresholds.includes(streak) ? streak : null;

			if (milestone) {
				const ref = await prisma.reflection.findFirst({
					where: {
						cycleId: cycle.id,
						weekNumber,
						reflectionType: 'RATING_A',
						userId: dbUser.id
					},
					select: { submittedAt: true, updatedAt: true }
				});
				const isFirstSubmission =
					ref && Math.abs(ref.updatedAt.getTime() - ref.submittedAt.getTime()) < 5000;
				if (isFirstSubmission) {
					const obj = await prisma.objective.findFirst({
						where: { userId: dbUser.id, active: true },
						select: { title: true }
					});
					sendEmail({
						to: dbUser.email,
						...emailTemplates.milestoneCelebration({
							individualName: dbUser.name ?? dbUser.email,
							milestone,
							objectiveTitle: obj?.title
						})
					}).catch((err) => {
						console.warn('[email:warn] Failed to send milestone email', err);
					});
				}
			}

			return { success: true, streak };
		} catch (error) {
			console.error('Failed to record check-in', error);
			return fail(500, { error: 'Could not save your check-in. Please try again.' });
		}
	}
};
