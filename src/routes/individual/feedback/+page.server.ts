import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { Prisma } from '@prisma/client';
import { validatePhone, normalizePhone } from '$lib/utils/phone';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { createFeedbackToken } from '$lib/server/feedbackToken';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { objective, cycle, currentWeek } = await event.parent();
	const baseUrl = event.url.origin;

	const cycleEnd = cycle?.endDate ?? null;
	const totalWeeks =
		cycleEnd && cycle
			? Math.max(
					1,
					Math.ceil((cycleEnd.getTime() - cycle.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
				)
			: (currentWeek ?? 1);

	// Stakeholders with feedbacks + tokens
	const stakeholdersWithFeedbacks = await prisma.stakeholder.findMany({
		where: { objectiveId: objective.id },
		orderBy: { createdAt: 'asc' },
		include: {
			feedbacks: {
				orderBy: { submittedAt: 'desc' },
				include: {
					reflection: { select: { weekNumber: true } }
				}
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
	if (cycle) {
		for (let wk = 1; wk <= totalWeeks; wk++) {
			const refs = cycle.reflections.filter((r) => r.weekNumber === wk);
			const effs = refs.map((r) => r.effortScore).filter((v): v is number => v !== null);
			const prfs = refs.map((r) => r.performanceScore).filter((v): v is number => v !== null);
			selfWeekMap.set(wk, { effort: avg(effs), performance: avg(prfs) });
		}
	}

	const selfScores = selfWeekMap.get(currentWeek ?? 0);
	const myEffort = selfScores?.effort ?? null;
	const myPerformance = selfScores?.performance ?? null;

	// Group all feedbacks by stakeholder and week
	const shWeekMap = new Map<
		string,
		Map<number, { efforts: number[]; performances: number[]; comments: string[] }>
	>();
	for (const sh of stakeholdersWithFeedbacks) {
		for (const fb of sh.feedbacks) {
			if (!fb.reflection) continue;
			const wk = fb.reflection.weekNumber;
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
	const reviewers = stakeholdersWithFeedbacks.map((sh) => {
		const pendingToken = sh.tokens.find((token) => !token.usedAt && token.expiresAt > currentTime);
		const latestFeedback = sh.feedbacks[0] ?? null;

		const shWeeks = shWeekMap.get(sh.id);
		const viewData = shWeeks?.get(currentWeek ?? 0);

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
			pendingFeedbackLink: pendingToken
				? `${baseUrl}/stakeholder/feedback/${pendingToken.tokenHash}`
				: null,
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
		objective: { id: objective.id, title: objective.title },
		reviewers,
		myEffort,
		myPerformance,
		reviewerAvgEffort,
		reviewerAvgPerf,
		currentWeek,
		// For the Reveal status badge — true means reviewers see your self-scores
		// when they submit feedback; false means scored blind. Default is true;
		// users can flip in /individual/settings.
		revealScores: cycle?.revealScores ?? true
	};
};

export const actions: Actions = {
	addStakeholder: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const phone = String(formData.get('phone') ?? '').trim();

		const values = { name, email, phone };

		if (!name || !email) {
			return fail(400, { action: 'stakeholder', error: 'Name and email are required.', values });
		}

		if (phone && !validatePhone(phone)) {
			return fail(400, {
				action: 'stakeholder',
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).',
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
				error: 'Create a goal before adding reviewers.',
				values
			});
		}

		try {
			const stakeholder = await prisma.stakeholder.create({
				data: {
					individualId: dbUser.id,
					objectiveId: objective.id,
					name,
					email,
					phone: phone.length > 0 ? normalizePhone(phone) : null
				}
			});

			try {
				const template = emailTemplates.welcomeStakeholder({
					individualName: dbUser.name || undefined,
					stakeholderName: name || undefined,
					appUrl: event.url.origin
				});
				await sendEmail({ to: email, ...template });
			} catch (error) {
				console.error('[email:error] Failed to send reviewer welcome email', error);
			}

			if (stakeholder.phone) {
				await trySendSms(
					stakeholder.phone,
					smsTemplates.welcomeStakeholder({
						individualName: dbUser.name || undefined,
						appUrl: event.url.origin
					})
				);
			}
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return fail(400, {
					action: 'stakeholder',
					error: 'You already have a reviewer with that email.',
					values
				});
			}
			throw error;
		}

		return { action: 'stakeholder', success: true };
	},

	generateFeedback: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		const formData = await event.request.formData();
		const stakeholderId = formData.get('stakeholderId');

		if (typeof stakeholderId !== 'string' || stakeholderId.length === 0) {
			return fail(400, { action: 'feedback', error: 'Missing reviewer selection.' });
		}

		const result = await createFeedbackToken(dbUser, stakeholderId, event.url.origin);
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
		const stakeholderId = formData.get('stakeholderId');
		const phone = String(formData.get('phone') ?? '').trim();

		if (typeof stakeholderId !== 'string' || stakeholderId.length === 0) {
			return fail(400, { action: 'feedback', error: 'Missing reviewer selection.' });
		}

		if (!phone || !validatePhone(phone)) {
			return fail(400, {
				action: 'feedback',
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).',
				phonePromptFor: stakeholderId
			});
		}

		await prisma.stakeholder.update({
			where: { id: stakeholderId },
			data: { phone: normalizePhone(phone) }
		});

		const result = await createFeedbackToken(dbUser, stakeholderId, event.url.origin);
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
