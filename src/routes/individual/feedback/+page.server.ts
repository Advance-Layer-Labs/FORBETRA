import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { Prisma } from '@prisma/client';
import { validatePhone, normalizePhone } from '$lib/utils/phone';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { createFeedbackToken, reissueFeedbackToken } from '$lib/server/feedbackToken';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { goal, journey, currentWeek, checkIns } = await event.parent();

	const totalWeeks = Math.max(journey.lengthWeeks, currentWeek);

	// Reviewers with feedback + tokens
	const reviewersWithFeedbacks = await prisma.reviewer.findMany({
		where: { goalId: goal.id },
		orderBy: { createdAt: 'asc' },
		include: {
			feedback: {
				where: { journeyId: journey.id },
				orderBy: { submittedAt: 'desc' }
			},
			tokens: {
				where: { type: 'FEEDBACK_INVITE' },
				orderBy: { createdAt: 'desc' },
				take: 3
			}
		}
	});

	const currentTime = new Date();
	const avg = (arr: number[]) =>
		arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

	// Self scores per week
	const selfWeekMap = new Map<number, { effort: number | null; performance: number | null }>();
	for (let wk = 1; wk <= totalWeeks; wk++) {
		const rows = checkIns.filter((r) => r.weekNumber === wk);
		selfWeekMap.set(wk, {
			effort: avg(rows.map((r) => r.effortScore)),
			performance: avg(rows.map((r) => r.performanceScore))
		});
	}

	const selfScores = selfWeekMap.get(currentWeek);
	const myEffort = selfScores?.effort ?? null;
	const myPerformance = selfScores?.performance ?? null;

	// Group all feedbacks by reviewer and week
	const shWeekMap = new Map<
		string,
		Map<number, { efforts: number[]; performances: number[]; comments: string[] }>
	>();
	for (const sh of reviewersWithFeedbacks) {
		for (const fb of sh.feedback) {
			const wk = fb.weekNumber;
			if (!shWeekMap.has(sh.id)) shWeekMap.set(sh.id, new Map());
			const shWeeks = shWeekMap.get(sh.id)!;
			if (!shWeeks.has(wk)) shWeeks.set(wk, { efforts: [], performances: [], comments: [] });
			const w = shWeeks.get(wk)!;
			if (fb.effortScore !== null) w.efforts.push(fb.effortScore);
			if (fb.performanceScore !== null) w.performances.push(fb.performanceScore);
			if (fb.comment && fb.comment.trim().length > 0) w.comments.push(fb.comment.trim());
		}
	}

	function computeTrend(
		shWeeks: Map<number, { efforts: number[]; performances: number[] }>,
		getSelf: (wk: number) => number | null,
		getStk: (wk: number, data: { efforts: number[]; performances: number[] }) => number | null
	): 'widening' | 'closing' | 'stable' | null {
		const pairedGaps: number[] = [];
		const weeks = Array.from(shWeeks.keys()).sort((a, b) => a - b);
		for (const wk of weeks) {
			const s = getSelf(wk);
			const stk = getStk(wk, shWeeks.get(wk)!);
			if (s !== null && stk !== null) pairedGaps.push(Math.abs(s - stk));
		}
		if (pairedGaps.length < 2) return null;
		const recent = pairedGaps.slice(-3);
		let totalDelta = 0;
		for (let i = 1; i < recent.length; i++) totalDelta += recent[i] - recent[i - 1];
		const avgDelta = totalDelta / (recent.length - 1);
		if (avgDelta > 0.5) return 'widening';
		if (avgDelta < -0.5) return 'closing';
		return 'stable';
	}

	// Aggregate reviewer averages for summary
	const allReviewerEfforts: number[] = [];
	const allReviewerPerfs: number[] = [];

	// Build reviewer cards
	const reviewers = reviewersWithFeedbacks.map((sh) => {
		const pendingToken = sh.tokens.find((token) => !token.usedAt && token.expiresAt > currentTime);
		const latestFeedback = sh.feedback[0] ?? null;

		const shWeeks = shWeekMap.get(sh.id);
		const viewData = shWeeks?.get(currentWeek);

		const stkEffort = viewData ? avg(viewData.efforts) : null;
		const stkPerf = viewData ? avg(viewData.performances) : null;
		if (stkEffort !== null) allReviewerEfforts.push(stkEffort);
		if (stkPerf !== null) allReviewerPerfs.push(stkPerf);

		const effortGap =
			myEffort !== null && stkEffort !== null ? Number((myEffort - stkEffort).toFixed(1)) : null;
		const perfGap =
			myPerformance !== null && stkPerf !== null
				? Number((myPerformance - stkPerf).toFixed(1))
				: null;

		const effortGapTrend = shWeeks
			? computeTrend(
					shWeeks,
					(wk) => selfWeekMap.get(wk)?.effort ?? null,
					(_wk, data) => avg(data.efforts)
				)
			: null;
		const performanceGapTrend = shWeeks
			? computeTrend(
					shWeeks,
					(wk) => selfWeekMap.get(wk)?.performance ?? null,
					(_wk, data) => avg(data.performances)
				)
			: null;

		// Build feedback history (all weeks)
		const history: {
			week: number;
			effort: number | null;
			performance: number | null;
			comment: string | null;
		}[] = [];
		if (shWeeks) {
			const weeks = Array.from(shWeeks.keys()).sort((a, b) => a - b);
			for (const wk of weeks) {
				const d = shWeeks.get(wk)!;
				history.push({
					week: wk,
					effort: avg(d.efforts),
					performance: avg(d.performances),
					comment: d.comments[d.comments.length - 1] ?? null
				});
			}
		}

		return {
			id: sh.id,
			name: sh.name,
			email: sh.email,
			phone: sh.phone,
			lastFeedbackDate: latestFeedback?.submittedAt?.toISOString() ?? null,
			hasPendingInvite: !!pendingToken,
			stkEffort,
			stkPerf,
			effortGap,
			perfGap,
			effortGapTrend,
			performanceGapTrend,
			history
		};
	});

	const reviewerAvgEffort = avg(allReviewerEfforts);
	const reviewerAvgPerf = avg(allReviewerPerfs);

	return {
		goal: { id: goal.id, title: goal.title },
		reviewers,
		myEffort,
		myPerformance,
		reviewerAvgEffort,
		reviewerAvgPerf,
		currentWeek
	};
};

export const actions: Actions = {
	addReviewer: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const phone = String(formData.get('phone') ?? '').trim();

		const values = { name, email, phone };

		if (!name || !email) {
			return fail(400, { action: 'reviewer', error: 'Name and email are required.', values });
		}

		if (phone && !validatePhone(phone)) {
			return fail(400, {
				action: 'reviewer',
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).',
				values
			});
		}

		const goal = await prisma.goal.findFirst({
			where: { userId: dbUser.id, active: true },
			orderBy: { createdAt: 'desc' },
			select: { id: true }
		});

		if (!goal) {
			return fail(400, {
				action: 'reviewer',
				error: 'Create a goal before adding reviewers.',
				values
			});
		}

		try {
			const reviewer = await prisma.reviewer.create({
				data: {
					individualId: dbUser.id,
					goalId: goal.id,
					name,
					email,
					phone: phone.length > 0 ? normalizePhone(phone) : null
				}
			});

			try {
				const template = emailTemplates.welcomeReviewer({
					individualName: dbUser.name || undefined,
					reviewerName: name || undefined,
					appUrl: event.url.origin
				});
				await sendEmail({ to: email, ...template });
			} catch (error) {
				console.error('[email:error] Failed to send reviewer welcome email', error);
			}

			if (reviewer.phone) {
				await trySendSms(
					reviewer.phone,
					smsTemplates.welcomeReviewer({
						individualName: dbUser.name || undefined,
						appUrl: event.url.origin
					})
				);
			}
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return fail(400, {
					action: 'reviewer',
					error: 'You already have a reviewer with that email.',
					values
				});
			}
			throw error;
		}

		return { action: 'reviewer', success: true };
	},

	reissueFeedback: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		const formData = await event.request.formData();
		const reviewerId = formData.get('reviewerId');

		if (typeof reviewerId !== 'string' || reviewerId.length === 0) {
			return fail(400, { action: 'feedback', error: 'Missing reviewer selection.' });
		}

		const result = await reissueFeedbackToken(dbUser, reviewerId, event.url.origin);
		if (!result.ok) {
			return fail(result.status as 400 | 404, { action: 'feedback', error: result.error });
		}

		return {
			action: 'feedback',
			success: true,
			emailed: true,
			expiresAt: result.expiresAt,
			smsSent: result.smsSent
		};
	},

	generateFeedback: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		const formData = await event.request.formData();
		const reviewerId = formData.get('reviewerId');

		if (typeof reviewerId !== 'string' || reviewerId.length === 0) {
			return fail(400, { action: 'feedback', error: 'Missing reviewer selection.' });
		}

		const result = await createFeedbackToken(dbUser, reviewerId, event.url.origin);
		if (!result.ok) {
			return fail(result.status as 400 | 404, { action: 'feedback', error: result.error });
		}

		return {
			action: 'feedback',
			success: true,
			feedbackLink: result.feedbackLink,
			expiresAt: result.expiresAt,
			smsSent: result.smsSent
		};
	},

	addPhoneAndGenerateFeedback: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		const formData = await event.request.formData();
		const reviewerId = formData.get('reviewerId');
		const phone = String(formData.get('phone') ?? '').trim();

		if (typeof reviewerId !== 'string' || reviewerId.length === 0) {
			return fail(400, { action: 'feedback', error: 'Missing reviewer selection.' });
		}

		if (!phone || !validatePhone(phone)) {
			return fail(400, {
				action: 'feedback',
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).',
				phonePromptFor: reviewerId
			});
		}

		await prisma.reviewer.updateMany({
			where: { id: reviewerId, individualId: dbUser.id },
			data: { phone: normalizePhone(phone) }
		});

		const result = await createFeedbackToken(dbUser, reviewerId, event.url.origin);
		if (!result.ok) {
			return fail(result.status as 400 | 404, { action: 'feedback', error: result.error });
		}

		return {
			action: 'feedback',
			success: true,
			feedbackLink: result.feedbackLink,
			expiresAt: result.expiresAt,
			smsSent: result.smsSent
		};
	}
};
