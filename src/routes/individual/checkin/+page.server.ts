import { redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import { currentWeekNumber } from '$lib/server/domain';
import { withCheckInWeeks } from '$lib/server/hubMetrics';
import { submitCheckIn } from '../submitCheckIn.server';
import type { Actions, PageServerLoad } from './$types';

type MicroMoment = {
	type:
		| 'insight_preview'
		| 'reviewer_pulse'
		| 'streak_milestone'
		| 'growth_signal'
		| 'identity_echo'
		| 'coach_connection';
	title: string;
	message: string;
};

export const load: PageServerLoad = async (event) => {
	const isPreview = event.url.searchParams.get('preview') === 'true';
	const { dbUser } = requireRole(event, isPreview ? ['INDIVIDUAL', 'ADMIN'] : 'INDIVIDUAL');

	const context = await getActiveGoalWithJourney(dbUser.id);
	if (!context || !context.journey) {
		throw redirect(303, '/onboarding');
	}

	const { goal, journey } = context;

	if (journey.status === 'COMPLETED') {
		throw redirect(303, '/individual/today');
	}

	const timeZone = context.timeZone;
	const currentWeek = currentWeekNumber(journey.startDate, new Date(), timeZone);
	const totalWeeks = journey.lengthWeeks;

	const checkIns = withCheckInWeeks(
		journey.startDate,
		await prisma.checkIn.findMany({
			where: { journeyId: journey.id },
			orderBy: { submittedAt: 'asc' }
		}),
		timeZone
	);

	const priorCheckIns = checkIns.filter((row) => row.weekNumber < currentWeek);

	let previousRatings: {
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	} | null = null;
	let historicRatings: Array<{
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	}> = [];

	if (currentWeek > 1) {
		const last = priorCheckIns[priorCheckIns.length - 1];
		previousRatings = last
			? {
					weekNumber: last.weekNumber,
					effortScore: last.effortScore,
					performanceScore: last.performanceScore
				}
			: { weekNumber: currentWeek - 1, effortScore: null, performanceScore: null };

		// Latest check-in wins when a week has several
		const historicMap = new Map<number, { effortScore: number; performanceScore: number }>();
		for (const row of priorCheckIns) {
			historicMap.set(row.weekNumber, {
				effortScore: row.effortScore,
				performanceScore: row.performanceScore
			});
		}
		historicRatings = Array.from(historicMap.entries())
			.map(([weekNumber, scores]) => ({ weekNumber, ...scores }))
			.sort((a, b) => b.weekNumber - a.weekNumber);
	}

	const week1WithNotes = checkIns.find((row) => row.weekNumber === 1 && row.notes?.trim());
	const identityAnchor = currentWeek > 1 ? week1WithNotes?.notes?.trim() || null : null;

	return {
		checkInLabel: 'Check-in',
		isAvailable: true,
		availableDate: new Date().toISOString(),
		isLocked: false,
		isPreview,
		identityAnchor,
		isMidpoint: currentWeek === Math.ceil(totalWeeks / 2) && currentWeek > 1,
		checkInsThisWeek: checkIns.filter((row) => row.weekNumber === currentWeek).length,
		goal: {
			id: goal.id,
			title: goal.title,
			description: goal.description ?? ''
		},
		journey: {
			id: journey.id,
			label: journey.label ?? 'Journey',
			startDate: journey.startDate.toISOString()
		},
		focusAreas: goal.focusAreas.map((focusArea) => ({
			id: focusArea.id,
			label: focusArea.label,
			description: focusArea.description ?? ''
		})),
		currentWeek,
		isBaseline: checkIns.length === 0,
		previousEntry: null as {
			id: string;
			effortScore: number | null;
			performanceScore: number | null;
			notes: string;
		} | null,
		previousRatings,
		historicRatings
	};
};

async function buildMicroMoment(input: {
	userId: string;
	journeyId: string;
	journeyStart: Date;
	timeZone?: string | null;
	weekNumber: number;
	checkInId: string;
	effortScore: number;
	performanceScore: number;
	streak: number;
}): Promise<MicroMoment | null> {
	const { weekNumber, effortScore, performanceScore, streak } = input;
	const microMomentType = weekNumber % 6;

	const checkIns = withCheckInWeeks(
		input.journeyStart,
		await prisma.checkIn.findMany({
			where: { journeyId: input.journeyId },
			orderBy: { submittedAt: 'asc' }
		}),
		input.timeZone
	);
	const others = checkIns.filter((row) => row.id !== input.checkInId);

	if (microMomentType === 1) {
		const prev = [...others].reverse().find((row) => row.weekNumber < weekNumber);
		if (prev) {
			const eDelta = effortScore - prev.effortScore;
			const pDelta = performanceScore - prev.performanceScore;
			let teaser = '';
			if (eDelta > 0 && pDelta > 0) teaser = 'Both effort and performance are trending up.';
			else if (eDelta < 0 && pDelta < 0)
				teaser = 'A dip in both dimensions — worth exploring what shifted.';
			else if (eDelta > 0) teaser = 'Your effort is climbing. Performance may follow.';
			else if (pDelta > 0)
				teaser = 'Performance is up even without more effort — something clicked.';
			else teaser = 'Steady data this week — consistency has its own signal.';
			return {
				type: 'insight_preview',
				title: 'Insight Preview',
				message: `Your AI insight for this week will be ready Sunday evening. Based on your recent pattern: ${teaser}`
			};
		}
		return {
			type: 'insight_preview',
			title: 'Insight Preview',
			message:
				'Your first AI insight will be generated this Sunday evening. It gets smarter with each check-in.'
		};
	}

	if (microMomentType === 2) {
		const [feedbackCount, totalReviewers] = await Promise.all([
			prisma.feedback.count({ where: { journeyId: input.journeyId, weekNumber } }),
			prisma.reviewer.count({ where: { individualId: input.userId } })
		]);
		if (totalReviewers === 0) return null;
		return {
			type: 'reviewer_pulse',
			title: 'Reviewer Pulse',
			message:
				feedbackCount > 0
					? `This week, ${feedbackCount} of your ${totalReviewers} reviewer${totalReviewers !== 1 ? 's' : ''} ${feedbackCount !== 1 ? 'have' : 'has'} provided feedback. Their perspective adds depth to your data.`
					: `You have ${totalReviewers} reviewer${totalReviewers !== 1 ? 's' : ''} invited. As they submit feedback, you'll see how their perception compares with yours.`
		};
	}

	if (microMomentType === 3) {
		if (streak >= 20) {
			return {
				type: 'streak_milestone',
				title: 'Streak Milestone',
				message: `${streak} weeks without a miss. This kind of consistency doesn't just build data — it rewires how you lead. You're in rare company.`
			};
		}
		if (streak >= 10) {
			return {
				type: 'streak_milestone',
				title: 'Streak Milestone',
				message: `${streak} weeks in a row. Your data is now deep enough for meaningful pattern analysis. The AI insights this week will be especially rich.`
			};
		}
		if (streak >= 6) {
			return {
				type: 'streak_milestone',
				title: 'Streak Milestone',
				message: `${streak}-week streak — you're in the top 20% of committed leaders on the platform. Patterns are becoming clear.`
			};
		}
		if (streak >= 3) {
			return {
				type: 'streak_milestone',
				title: 'Streak Milestone',
				message: `${streak} weeks consistent — you're building a habit. Research shows it takes about 6 weeks to lock in a new practice.`
			};
		}
		return {
			type: 'streak_milestone',
			title: 'Building Momentum',
			message:
				'Every check-in builds your streak. Three weeks in a row unlocks richer insights and pattern recognition.'
		};
	}

	if (microMomentType === 4) {
		const firstWeek = others.find((row) => row.weekNumber === 1);
		if (!firstWeek || weekNumber <= 1) return null;
		const eDelta = effortScore - firstWeek.effortScore;
		const pDelta = performanceScore - firstWeek.performanceScore;
		let interpretation = '';
		if (eDelta > 0 && pDelta > 0)
			interpretation = 'Both dimensions are moving in the right direction.';
		else if (eDelta > 0)
			interpretation = "You're investing more effort — performance often follows.";
		else if (pDelta > 0)
			interpretation = 'Performance is climbing — your earlier effort is paying off.';
		else if (eDelta === 0 && pDelta === 0)
			interpretation = 'Steady state — consistency is valuable data too.';
		else
			interpretation =
				'Dips are part of the process. The trend over weeks matters more than any single point.';
		return {
			type: 'growth_signal',
			title: 'Growth Signal',
			message: `Since your first week: effort ${eDelta >= 0 ? '+' : ''}${eDelta}, performance ${pDelta >= 0 ? '+' : ''}${pDelta}. ${interpretation}`
		};
	}

	if (microMomentType === 5) {
		const anchor = checkIns.find((row) => row.weekNumber === 1 && row.notes?.trim())?.notes?.trim();
		if (!anchor) return null;
		return {
			type: 'identity_echo',
			title: 'Identity Echo',
			message: `Remember: you said you're becoming "${anchor.length > 80 ? anchor.slice(0, 80) + '…' : anchor}". This week's check-in is one more data point on that path.`
		};
	}

	const coachClient = await prisma.coachClient.findFirst({
		where: { individualId: input.userId, archivedAt: null },
		select: { coach: { select: { name: true, id: true } } }
	});
	if (!coachClient?.coach) return null;
	const recentNote = await prisma.coachNote.findFirst({
		where: { individualId: input.userId, coachId: coachClient.coach.id },
		orderBy: { createdAt: 'desc' },
		select: { content: true }
	});
	const coachFirst = coachClient.coach.name?.split(' ')[0] ?? 'Your coach';
	if (recentNote?.content) {
		const excerpt =
			recentNote.content.length > 100 ? recentNote.content.slice(0, 100) + '…' : recentNote.content;
		return {
			type: 'coach_connection',
			title: 'Coach Connection',
			message: `${coachFirst} last noted: "${excerpt}". Your check-in data helps them prepare for your next session.`
		};
	}
	return {
		type: 'coach_connection',
		title: 'Coach Connection',
		message: `${coachFirst} can see your check-in data. Each entry helps them prepare better for your sessions.`
	};
}

export const actions: Actions = {
	default: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const result = await submitCheckIn(event, dbUser);
		if (!('success' in result)) return result;

		const context = await getActiveGoalWithJourney(dbUser.id);
		let microMoment: MicroMoment | null = null;
		if (context?.journey) {
			try {
				microMoment = await buildMicroMoment({
					userId: dbUser.id,
					journeyId: context.journey.id,
					journeyStart: context.journey.startDate,
					timeZone: context.timeZone,
					weekNumber: result.weekNumber,
					checkInId: result.checkInId,
					effortScore: result.effortScore,
					performanceScore: result.performanceScore,
					streak: result.streak
				});
			} catch {
				// Micro-moment is non-critical — skip on error
			}
		}

		return {
			success: true,
			streak: result.streak,
			milestone: result.milestone,
			microMoment
		};
	}
};
