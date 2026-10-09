import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';
import type { ReviewerCadence } from '@prisma/client';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { createFeedbackToken } from '$lib/server/feedbackToken';
import { isReviewerDue, upsertReviewer } from '$lib/server/domain';
import { validatePhone, normalizePhone } from '$lib/utils/phone';

const parseCadence = (value: FormDataEntryValue | null): ReviewerCadence =>
	value === 'BIWEEKLY' ? 'BIWEEKLY' : 'WEEKLY';

export const load: PageServerLoad = async (event) => {
	const { goal, journey, currentWeek } = await event.parent();

	const reviewerRows = await prisma.reviewer.findMany({
		where: { goalId: goal.id },
		orderBy: { createdAt: 'asc' },
		include: {
			feedback: {
				where: { journeyId: journey.id },
				orderBy: { submittedAt: 'desc' },
				take: 1
			},
			tokens: {
				where: { type: 'FEEDBACK_INVITE' },
				orderBy: { createdAt: 'desc' },
				take: 3
			}
		}
	});

	const currentTime = new Date();

	const reviewers = reviewerRows.map((reviewer) => {
		const pendingToken = reviewer.tokens.find(
			(token) => !token.usedAt && token.expiresAt > currentTime
		);
		const latestFeedback = reviewer.feedback[0] ?? null;
		const latestFeedbackWeek = latestFeedback?.weekNumber ?? null;
		const isCurrentWeekResponse = latestFeedbackWeek === currentWeek;

		return {
			id: reviewer.id,
			name: reviewer.name,
			email: reviewer.email,
			phone: reviewer.phone,
			relationship: reviewer.relationship,
			cadence: reviewer.cadence,
			isDueThisWeek: isReviewerDue(reviewer.cadence, currentWeek),
			hasPendingInvite: !!pendingToken,
			pendingFeedbackExpiresAt: pendingToken?.expiresAt?.toISOString() ?? null,
			lastFeedback: latestFeedback
				? {
						submittedAt: latestFeedback.submittedAt?.toISOString() ?? null,
						effortScore: latestFeedback.effortScore,
						performanceScore: latestFeedback.performanceScore,
						weekNumber: latestFeedbackWeek,
						isCurrentWeek: isCurrentWeekResponse
					}
				: null
		};
	});

	return {
		goal: {
			id: goal.id,
			title: goal.title
		},
		reviewers
	};
};

export const actions: Actions = {
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

		// Save the normalized phone to the reviewer
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
	},
	addReviewer: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const relationship = String(formData.get('relationship') ?? '').trim();
		const phone = String(formData.get('phone') ?? '').trim();
		const cadence = parseCadence(formData.get('cadence'));

		const values = { name, email, relationship, phone, cadence };

		if (!name || !email) {
			return fail(400, {
				action: 'reviewer',
				error: 'Add a name and valid email to invite a reviewer.',
				values
			});
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

		const existing = await prisma.reviewer.findUnique({
			where: { individualId_email: { individualId: dbUser.id, email } },
			select: { goalId: true }
		});
		if (existing && existing.goalId === goal.id) {
			return fail(400, {
				action: 'reviewer',
				error: 'You already have a reviewer with that email.',
				values
			});
		}

		const reviewer = await upsertReviewer({
			individualId: dbUser.id,
			goalId: goal.id,
			invitedById: dbUser.id,
			name,
			email,
			relationship: relationship.length > 0 ? relationship : null,
			phone: phone.length > 0 ? normalizePhone(phone) : null,
			cadence
		});

		// Send welcome email to new reviewer
		try {
			const template = emailTemplates.welcomeReviewer({
				individualName: dbUser.name || undefined,
				reviewerName: name || undefined,
				appUrl: event.url.origin
			});
			await sendEmail({
				to: email,
				...template
			});
		} catch (error) {
			console.error('[email:error] Failed to send reviewer welcome email', error);
			// Don't fail the request if email fails
		}

		// Send welcome SMS if phone provided
		if (reviewer.phone) {
			await trySendSms(
				reviewer.phone,
				smsTemplates.welcomeReviewer({
					individualName: dbUser.name || undefined,
					appUrl: event.url.origin
				})
			);
		}

		return {
			action: 'reviewer',
			success: true
		};
	},

	updateCadence: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const reviewerId = formData.get('reviewerId');
		const cadence = parseCadence(formData.get('cadence'));

		if (typeof reviewerId !== 'string' || reviewerId.length === 0) {
			return fail(400, { action: 'cadence', error: 'Missing reviewer selection.' });
		}

		const updated = await prisma.reviewer.updateMany({
			where: { id: reviewerId, individualId: dbUser.id },
			data: { cadence }
		});
		if (updated.count === 0) {
			return fail(404, { action: 'cadence', error: 'Reviewer not found.' });
		}

		return { action: 'cadence', success: true };
	}
};
