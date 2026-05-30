import { redirect, fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';
import { randomBytes } from 'node:crypto';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { Prisma } from '@prisma/client';
import {
	stdDev,
	computeWeekNumber,
	getDateForWeekday,
	toIsoDate,
	weeksBetween,
	FEEDBACK_TOKEN_EXPIRY_DAYS
} from '$lib/server/coachUtils';
import { parseCheckInDays } from '$lib/utils/checkInDays';

function dayNameToNumber(day: string): number {
	const map: Record<string, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
	return map[day] ?? 3;
}

const getNextPrompt = (
	startDate: Date,
	currentWeek: number,
	weeklyExperiences: WeeklyExperience[]
): { type: 'RATING_A'; date: Date } | null => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Find the next open or upcoming experience from current week
	const nextExperience = weeklyExperiences.find(
		(exp) => exp.state === 'open' || exp.state === 'upcoming'
	);

	if (nextExperience && nextExperience.availableDate) {
		// If it's the available day and the experience is open, use today's date
		if (nextExperience.state === 'open' && nextExperience.availableDate <= today) {
			return {
				type: nextExperience.type,
				date: today
			};
		}
		return {
			type: nextExperience.type,
			date: nextExperience.availableDate
		};
	}

	// If no open/upcoming experiences in current week, point to next week's first check-in day
	const nextWeekFirstDay = getDateForWeekday(1, startDate, currentWeek + 1);
	if (nextWeekFirstDay >= today) {
		return {
			type: 'RATING_A',
			date: nextWeekFirstDay
		};
	}

	return null;
};

// Get the state of a weekly experience
type ExperienceState = 'open' | 'completed' | 'missed' | 'upcoming' | 'catchup';

type WeeklyExperience = {
	type: 'RATING_A';
	label: string;
	state: ExperienceState;
	availableDate: Date | null;
	deadlineDate: Date | null;
	reflectionId: string | null;
	url: string | null;
	catchupDeadline: Date | null;
};

const getWeeklyExperiences = async (
	cycle: {
		id: string;
		startDate: Date;
		checkInFrequency: string;
		reflections: Array<{ id: string; reflectionType: string; weekNumber: number }>;
	},
	userId: string,
	currentWeek: number,
	prismaClient: typeof prisma
): Promise<WeeklyExperience[]> => {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	// Ensure startDate is normalized to local midnight
	const normalizedStartDate = new Date(cycle.startDate);
	normalizedStartDate.setHours(0, 0, 0, 0);

	const checkInDays = parseCheckInDays(cycle.checkInFrequency ?? '3x');

	// Check if next week's first check-in is submitted (locks current week after 48h grace)
	const nextWeekFirstReflection = await prismaClient.reflection.findFirst({
		where: {
			cycleId: cycle.id,
			userId,
			weekNumber: currentWeek + 1
		},
		orderBy: { submittedAt: 'asc' },
		select: { submittedAt: true }
	});

	let isLocked = false;
	let catchupDeadline: Date | null = null;
	if (nextWeekFirstReflection) {
		const gracePeriodMs = 48 * 60 * 60 * 1000;
		const lockTime = new Date(nextWeekFirstReflection.submittedAt.getTime() + gracePeriodMs);
		catchupDeadline = lockTime;
		isLocked = new Date() >= lockTime;
	}

	// Get submitted reflections for current week
	const submittedReflections = cycle.reflections.filter((r) => r.weekNumber === currentWeek);
	// Count RATING_A reflections submitted this week (each check-in day = one RATING_A)
	const ratingAReflections = submittedReflections.filter((r) => r.reflectionType === 'RATING_A');
	const ratingACount = ratingAReflections.length;

	const experiences: WeeklyExperience[] = [];
	const dayLabels: Record<string, string> = {
		sun: 'Sunday',
		mon: 'Monday',
		tue: 'Tuesday',
		wed: 'Wednesday',
		thu: 'Thursday',
		fri: 'Friday',
		sat: 'Saturday'
	};

	let slotIndex = 0;

	for (const dayName of checkInDays) {
		const dayNumber = dayNameToNumber(dayName);
		const dayDate = getDateForWeekday(dayNumber, normalizedStartDate, currentWeek);
		const dayLabel = dayLabels[dayName] ?? dayName;

		// RATING_A experience
		const isCompleted = slotIndex < ratingACount;
		const matchingReflection = isCompleted ? ratingAReflections[slotIndex] : null;

		// Calculate the next check-in day's date for deadline (or end of week)
		const nextDayIndex = checkInDays.indexOf(dayName) + 1;
		const nextDayDate =
			nextDayIndex < checkInDays.length
				? getDateForWeekday(
						dayNameToNumber(checkInDays[nextDayIndex]),
						normalizedStartDate,
						currentWeek
					)
				: null;

		let ratingState: ExperienceState;
		if (isCompleted) {
			ratingState = 'completed';
		} else if (today < dayDate) {
			ratingState = 'upcoming';
		} else if (isLocked) {
			ratingState = 'missed';
		} else if (nextWeekFirstReflection && !isLocked) {
			ratingState = 'catchup';
		} else {
			ratingState = 'open';
		}

		experiences.push({
			type: 'RATING_A',
			label: `${dayLabel} check-in`,
			state: ratingState,
			availableDate: dayDate,
			deadlineDate: nextDayDate,
			reflectionId: matchingReflection?.id ?? null,
			url:
				ratingState === 'open' || ratingState === 'completed'
					? '/individual/checkin?type=RATING_A'
					: ratingState === 'catchup'
						? `/individual/checkin?type=RATING_A&week=${currentWeek}`
						: null,
			catchupDeadline: ratingState === 'catchup' ? catchupDeadline : null
		});

		slotIndex++;
	}

	return experiences;
};

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');
	const baseUrl = event.url.origin;

	const objective = await prisma.objective.findFirst({
		where: { userId: dbUser.id, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			subgoals: { where: { active: true }, orderBy: { createdAt: 'asc' } },
			stakeholders: {
				orderBy: { createdAt: 'asc' },
				include: {
					feedbacks: {
						orderBy: { submittedAt: 'desc' },
						include: {
							reflection: {
								select: {
									weekNumber: true,
									effortScore: true,
									performanceScore: true
								}
							}
						}
					},
					tokens: {
						where: { type: 'FEEDBACK_INVITE' },
						orderBy: { createdAt: 'desc' },
						take: 3
					}
				}
			},
			cycles: {
				orderBy: { startDate: 'desc' },
				take: 1,
				include: {
					reflections: {
						select: {
							id: true,
							reflectionType: true,
							weekNumber: true,
							submittedAt: true,
							effortScore: true,
							performanceScore: true,
							notes: true
						}
					}
				}
			}
		}
	});

	if (!objective) {
		throw redirect(303, '/onboarding');
	}

	const cycle = objective.cycles[0] ?? null;
	const cycleEnd = cycle?.endDate ?? null;
	const totalWeeks = cycle && cycleEnd ? weeksBetween(cycle.startDate, cycleEnd) : 0;
	const weeksElapsed = cycle
		? Math.max(
				0,
				Math.floor((new Date().getTime() - cycle.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
			)
		: 0;
	const completion =
		totalWeeks > 0 ? Math.min(100, Math.round((weeksElapsed / totalWeeks) * 100)) : 0;
	const now = new Date(); // For token expiration comparison
	now.setHours(0, 0, 0, 0);
	const currentWeek = cycle ? computeWeekNumber(cycle.startDate) : null;

	let respondedThisWeek = 0;
	const reflectionTrendMap = new Map<
		number,
		{
			weekNumber: number;
			effortScores: number[];
			performanceScores: number[];
		}
	>();

	if (cycle) {
		cycle.reflections.forEach((reflection) => {
			const weekEntry = reflectionTrendMap.get(reflection.weekNumber) ?? {
				weekNumber: reflection.weekNumber,
				effortScores: [],
				performanceScores: []
			};
			// RATING_A check-ins capture both scores (RATING_B kept for legacy data)
			if (reflection.reflectionType === 'RATING_A' || reflection.reflectionType === 'RATING_B') {
				if (reflection.effortScore !== null) {
					weekEntry.effortScores.push(reflection.effortScore);
				}
				if (reflection.performanceScore !== null) {
					weekEntry.performanceScores.push(reflection.performanceScore);
				}
			}
			reflectionTrendMap.set(reflection.weekNumber, weekEntry);
		});
	}

	const weeklyExperiencesRaw =
		cycle && currentWeek ? await getWeeklyExperiences(cycle, dbUser.id, currentWeek, prisma) : [];

	const weeklyExperiences: Array<{
		type: 'RATING_A';
		label: string;
		state: 'open' | 'completed' | 'missed' | 'upcoming' | 'catchup';
		availableDate: string | null;
		deadlineDate: string | null;
		reflectionId: string | null;
		url: string | null;
		catchupDeadline: string | null;
	}> = weeklyExperiencesRaw.map((exp) => ({
		...exp,
		availableDate: exp.availableDate ? exp.availableDate.toISOString() : null,
		deadlineDate: exp.deadlineDate ? exp.deadlineDate.toISOString() : null,
		catchupDeadline: exp.catchupDeadline ? exp.catchupDeadline.toISOString() : null
	}));

	// Calculate nextPrompt based on current week's experiences
	const nextPrompt =
		cycle && currentWeek ? getNextPrompt(cycle.startDate, currentWeek, weeklyExperiencesRaw) : null;

	let effortSum = 0;
	let effortCount = 0;
	let progressSum = 0;
	let progressCount = 0;

	const stakeholders = objective.stakeholders.map((stakeholder) => {
		const pendingToken = stakeholder.tokens.find((token) => !token.usedAt && token.expiresAt > now);
		const latestFeedback = stakeholder.feedbacks[0] ?? null;
		const latestReflectionWeek = latestFeedback?.reflection?.weekNumber ?? null;
		const isCurrentWeekResponse =
			currentWeek !== null && latestReflectionWeek === currentWeek && !!latestFeedback?.submittedAt;

		if (isCurrentWeekResponse) {
			respondedThisWeek += 1;
			if (latestFeedback?.effortScore !== null && latestFeedback?.effortScore !== undefined) {
				effortSum += latestFeedback.effortScore;
				effortCount += 1;
			}
			if (
				latestFeedback?.performanceScore !== null &&
				latestFeedback?.performanceScore !== undefined
			) {
				progressSum += latestFeedback.performanceScore;
				progressCount += 1;
			}
		}

		return {
			id: stakeholder.id,
			name: stakeholder.name,
			email: stakeholder.email,
			relationship: stakeholder.relationship,
			pendingFeedbackLink: pendingToken
				? `${baseUrl}/stakeholder/feedback/${pendingToken.tokenHash}`
				: null,
			pendingFeedbackExpiresAt: pendingToken?.expiresAt?.toISOString() ?? null,
			lastFeedback: latestFeedback
				? {
						submittedAt: latestFeedback.submittedAt?.toISOString() ?? null,
						effortScore: latestFeedback.effortScore,
						performanceScore: latestFeedback.performanceScore,
						weekNumber: latestReflectionWeek,
						isCurrentWeek: isCurrentWeekResponse
					}
				: null
		};
	});

	const feedbackSummary = currentWeek
		? {
				weekNumber: currentWeek,
				totalStakeholders: objective.stakeholders.length,
				responded: respondedThisWeek,
				avgEffort: effortCount > 0 ? Number((effortSum / effortCount).toFixed(1)) : null,
				avgProgress: progressCount > 0 ? Number((progressSum / progressCount).toFixed(1)) : null
			}
		: null;

	const trendWeeks = Array.from(reflectionTrendMap.values())
		.sort((a, b) => b.weekNumber - a.weekNumber)
		.slice(0, 4);

	let trendEffortSum = 0;
	let trendEffortCount = 0;
	let trendProgressSum = 0;
	let trendProgressCount = 0;

	const reflectionTrend = trendWeeks.map((week) => {
		const effortAverage =
			week.effortScores.length > 0
				? Number(
						(
							week.effortScores.reduce((sum, score) => sum + score, 0) / week.effortScores.length
						).toFixed(1)
					)
				: null;
		if (effortAverage !== null) {
			trendEffortSum += effortAverage;
			trendEffortCount += 1;
		}

		const progressAverage =
			week.performanceScores.length > 0
				? Number(
						(
							week.performanceScores.reduce((sum, score) => sum + score, 0) /
							week.performanceScores.length
						).toFixed(1)
					)
				: null;
		if (progressAverage !== null) {
			trendProgressSum += progressAverage;
			trendProgressCount += 1;
		}

		return {
			weekNumber: week.weekNumber,
			effortScore: effortAverage,
			performanceScore: progressAverage
		};
	});

	const reflectionTrendSummary = {
		weeks: reflectionTrend,
		avgEffort: trendEffortCount > 0 ? Number((trendEffortSum / trendEffortCount).toFixed(1)) : null,
		avgProgress:
			trendProgressCount > 0 ? Number((trendProgressSum / trendProgressCount).toFixed(1)) : null
	};

	const normalizedReflectionTrend = cycle
		? reflectionTrendSummary
		: { weeks: [], avgEffort: null, avgProgress: null };

	// Prepare data for Performance/Effort visualization (all weeks, not just last 4)
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

	// Prepare stakeholder feedback data by week for visualization
	const stakeholderWeeklyData: Array<{
		weekNumber: number;
		stakeholderId: string;
		stakeholderName: string;
		effortScore: number | null;
		performanceScore: number | null;
	}> = [];

	if (cycle) {
		// Load all feedbacks for all stakeholders in this cycle
		const allFeedbacks = await prisma.feedback.findMany({
			where: {
				reflection: {
					cycleId: cycle.id
				}
			},
			include: {
				reflection: {
					select: {
						weekNumber: true
					}
				},
				stakeholder: {
					select: {
						id: true,
						name: true
					}
				}
			}
		});

		allFeedbacks.forEach((feedback) => {
			if (feedback.reflection) {
				stakeholderWeeklyData.push({
					weekNumber: feedback.reflection.weekNumber,
					stakeholderId: feedback.stakeholder.id,
					stakeholderName: feedback.stakeholder.name,
					effortScore: feedback.effortScore,
					performanceScore: feedback.performanceScore
				});
			}
		});
	}

	const effortSeries = reflectionTrend
		.map((week) => week.effortScore)
		.filter((value): value is number => value !== null);
	const progressSeries = reflectionTrend
		.map((week) => week.performanceScore)
		.filter((value): value is number => value !== null);

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

	const alignmentRatio =
		objective.stakeholders.length > 0 ? respondedThisWeek / objective.stakeholders.length : null;

	// Calculate engagement metrics (completion rate, streaks) - positive framing
	let completionRate: number | null = null;
	let currentStreak: number = 0;
	let bestStreak: number = 0;
	let totalExpected: number = 0;
	let totalCompleted: number = 0;

	if (cycle && currentWeek) {
		// Dynamic check-in days from cycle frequency
		const engagementDays = parseCheckInDays(cycle.checkInFrequency ?? '3x');
		const checkInsPerWeek = engagementDays.length;

		// Each check-in day = one RATING_A slot
		totalExpected = checkInsPerWeek * currentWeek;
		totalCompleted = cycle.reflections.length;
		completionRate = totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0;

		// Calculate streaks based on dynamic check-in slots
		// Build expected sequence: each check-in day = one RATING_A slot
		const expectedSequence: Array<{ week: number; slotIndex: number }> = [];
		for (let week = 1; week <= currentWeek; week++) {
			for (let slot = 0; slot < checkInsPerWeek; slot++) {
				expectedSequence.push({ week, slotIndex: slot });
			}
		}

		// Count actual reflections per week to compare against expected slots
		const reflectionCountByWeek = new Map<number, number>();
		cycle.reflections.forEach((r) => {
			const count = reflectionCountByWeek.get(r.weekNumber) ?? 0;
			reflectionCountByWeek.set(r.weekNumber, count + 1);
		});

		// A slot is "completed" if the number of reflections for that week >= slotIndex + 1
		const isSlotCompleted = (week: number, slotIndex: number): boolean => {
			const count = reflectionCountByWeek.get(week) ?? 0;
			return count > slotIndex;
		};

		// Count consecutive completed slots from the end
		let streak = 0;
		for (let i = expectedSequence.length - 1; i >= 0; i--) {
			const { week, slotIndex } = expectedSequence[i];
			if (isSlotCompleted(week, slotIndex)) {
				streak++;
			} else {
				break;
			}
		}
		currentStreak = streak;

		// Calculate best streak (longest consecutive sequence)
		let maxStreak = 0;
		let runningStreak = 0;

		for (const { week, slotIndex } of expectedSequence) {
			if (isSlotCompleted(week, slotIndex)) {
				runningStreak++;
				maxStreak = Math.max(maxStreak, runningStreak);
			} else {
				runningStreak = 0;
			}
		}
		bestStreak = maxStreak;
	}

	return {
		objective: {
			id: objective.id,
			title: objective.title,
			description: objective.description
		},
		subgoals: objective.subgoals.map((subgoal) => ({
			id: subgoal.id,
			label: subgoal.label,
			description: subgoal.description
		})),
		stakeholders,
		feedbackSummary,
		reflectionTrend: normalizedReflectionTrend,
		insights: {
			avgEffort: normalizedReflectionTrend.avgEffort,
			avgProgress: normalizedReflectionTrend.avgProgress,
			stabilityScore,
			trajectoryScore,
			alignmentRatio
		},
		engagement: {
			completionRate,
			currentStreak,
			bestStreak,
			totalCompleted,
			totalExpected
		},
		weeklyExperiences,
		cycle: cycle
			? {
					id: cycle.id,
					label: cycle.label ?? 'Cycle',
					startDate: toIsoDate(cycle.startDate),
					endDate: toIsoDate(cycleEnd),
					status: cycle.status,
					weeksElapsed,
					totalWeeks,
					completion,
					reflectionsRecorded: cycle.reflections.length
				}
			: null,
		nextPrompt: nextPrompt
			? {
					type: nextPrompt.type,
					date: nextPrompt.date.toISOString()
				}
			: null,
		visualizationData: {
			individual: individualWeeklyData,
			stakeholders: stakeholderWeeklyData,
			stakeholderList: objective.stakeholders.map((s) => ({ id: s.id, name: s.name }))
		}
	};
};

export const actions: Actions = {
	generateFeedback: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const stakeholderId = formData.get('stakeholderId');

		if (typeof stakeholderId !== 'string' || stakeholderId.length === 0) {
			return fail(400, { action: 'feedback', error: 'Missing stakeholder selection.' });
		}

		const stakeholder = await prisma.stakeholder.findFirst({
			where: {
				id: stakeholderId,
				individualId: dbUser.id
			}
		});

		if (!stakeholder) {
			return fail(404, { action: 'feedback', error: 'Stakeholder not found.' });
		}

		const objective = await prisma.objective.findFirst({
			where: { userId: dbUser.id, active: true },
			orderBy: { createdAt: 'desc' },
			include: {
				subgoals: { where: { active: true }, orderBy: { createdAt: 'asc' } },
				cycles: { orderBy: { startDate: 'desc' }, take: 1 }
			}
		});

		if (!objective) {
			return fail(400, { action: 'feedback', error: 'No active objective available.' });
		}

		const primarySubgoal = objective.subgoals[0];

		if (!primarySubgoal) {
			return fail(400, {
				action: 'feedback',
				error: 'Add a sub-objective before requesting feedback.'
			});
		}

		const cycle = objective.cycles[0];

		if (!cycle) {
			return fail(400, { action: 'feedback', error: 'No active cycle found.' });
		}

		const weekNumber = computeWeekNumber(cycle.startDate);

		// Cadence gating: check if feedback request is allowed this period
		const cadence = cycle.stakeholderCadence ?? 'weekly';
		if (cadence !== 'every_checkin') {
			let windowStart: Date;
			if (cadence === 'monthly') {
				windowStart = new Date();
				windowStart.setDate(1);
				windowStart.setHours(0, 0, 0, 0);
			} else {
				// weekly: start of current week (Monday)
				windowStart = new Date();
				const dayOfWeek = windowStart.getDay();
				const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
				windowStart.setDate(windowStart.getDate() + mondayOffset);
				windowStart.setHours(0, 0, 0, 0);
			}

			const existingToken = await prisma.token.findFirst({
				where: {
					type: 'FEEDBACK_INVITE',
					stakeholderId: stakeholder.id,
					createdAt: { gte: windowStart }
				}
			});

			if (existingToken) {
				const period = cadence === 'monthly' ? 'this month' : 'this week';
				return fail(400, {
					action: 'feedback',
					error: `Feedback already requested from ${stakeholder.name} ${period}. Your coach set the cadence to ${cadence === 'monthly' ? 'monthly' : 'weekly'}.`
				});
			}
		}

		// Auto-throttle: skip if stakeholder is rating 3+ people and autoThrottle is on
		if (cycle.autoThrottle) {
			const activeRequestCount = await prisma.token.count({
				where: {
					type: 'FEEDBACK_INVITE',
					stakeholderId: stakeholder.id,
					usedAt: null,
					expiresAt: { gt: new Date() }
				}
			});

			if (activeRequestCount >= 3) {
				return fail(400, {
					action: 'feedback',
					error: `${stakeholder.name} already has ${activeRequestCount} pending feedback requests. Auto-throttle is limiting new requests to prevent survey fatigue.`
				});
			}
		}

		const reflection = await prisma.reflection.upsert({
			where: {
				cycleId_weekNumber_reflectionType_subgoalId: {
					cycleId: cycle.id,
					weekNumber,
					reflectionType: 'RATING_B',
					subgoalId: primarySubgoal.id
				}
			},
			update: {},
			create: {
				cycleId: cycle.id,
				userId: dbUser.id,
				subgoalId: primarySubgoal.id,
				reflectionType: 'RATING_B',
				weekNumber,
				checkInDate: new Date()
			}
		});

		const tokenValue = randomBytes(32).toString('hex');
		const expiresAt = new Date();
		expiresAt.setDate(expiresAt.getDate() + FEEDBACK_TOKEN_EXPIRY_DAYS);

		await prisma.token.create({
			data: {
				tokenHash: tokenValue,
				type: 'FEEDBACK_INVITE',
				expiresAt,
				stakeholderId: stakeholder.id,
				reflectionId: reflection.id,
				userId: dbUser.id,
				metadata: {
					generatedBy: dbUser.id
				}
			}
		});

		const feedbackLink = `${event.url.origin}/stakeholder/feedback/${tokenValue}`;

		// Send feedback invite email
		try {
			const objective = await prisma.objective.findFirst({
				where: { userId: dbUser.id, active: true },
				select: { title: true }
			});

			const template = emailTemplates.feedbackInvite({
				individualName: dbUser.name || undefined,
				stakeholderName: stakeholder.name || undefined,
				objectiveTitle: objective?.title || undefined,
				feedbackLink
			});
			await sendEmail({
				to: stakeholder.email,
				...template
			});
		} catch (error) {
			console.error('[email:error] Failed to send feedback invite', error);
			// Don't fail the request if email fails
		}

		// Send feedback invite SMS to stakeholder
		await trySendSms(
			stakeholder.phone,
			smsTemplates.feedbackInvite({
				individualName: dbUser.name || undefined,
				feedbackLink
			})
		);

		return {
			action: 'feedback',
			success: true,
			feedbackLink,
			expiresAt: expiresAt.toISOString()
		};
	},
	addStakeholder: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const relationship = String(formData.get('relationship') ?? '').trim();
		const phone = String(formData.get('phone') ?? '').trim();

		const values = { name, email, relationship, phone };

		if (!name || !email) {
			return fail(400, {
				action: 'stakeholder',
				error: 'Add a name and valid email to invite a stakeholder.',
				values
			});
		}

		const objective = await prisma.objective.findFirst({
			where: { userId: dbUser.id, active: true },
			orderBy: { createdAt: 'desc' },
			select: { id: true }
		});

		if (!objective) {
			return fail(400, {
				action: 'stakeholder',
				error: 'Create an objective before adding stakeholders.',
				values
			});
		}

		try {
			await prisma.stakeholder.create({
				data: {
					individualId: dbUser.id,
					objectiveId: objective.id,
					name,
					email,
					relationship: relationship.length > 0 ? relationship : null,
					phone: phone.length > 0 ? phone : null
				}
			});
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return fail(400, {
					action: 'stakeholder',
					error: 'You already have a stakeholder with that email.',
					values
				});
			}
			throw error;
		}

		// Send welcome email to new stakeholder
		try {
			const template = emailTemplates.welcomeStakeholder({
				individualName: dbUser.name || undefined,
				stakeholderName: name || undefined,
				appUrl: event.url.origin
			});
			await sendEmail({
				to: email,
				...template
			});
		} catch (error) {
			console.error('[email:error] Failed to send stakeholder welcome email', error);
			// Don't fail the request if email fails
		}

		return {
			action: 'stakeholder',
			success: true
		};
	}
};
