import { randomBytes } from 'node:crypto';
import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { FEEDBACK_TOKEN_EXPIRY_DAYS } from '$lib/server/coachUtils';
import { hashToken } from '$lib/server/tokenHash';
import { currentWeekNumber, isReviewerDue } from '$lib/server/domain/week';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';

export type FeedbackNotice = 'invite' | 'reminder';

export async function createFeedbackToken(
	dbUser: { id: string; name: string | null },
	reviewerId: string,
	origin: string,
	notice: FeedbackNotice = 'invite'
): Promise<
	| { ok: true; feedbackLink: string; expiresAt: string; smsSent: boolean }
	| { ok: false; status: number; error: string }
> {
	const reviewer = await prisma.reviewer.findFirst({
		where: { id: reviewerId, individualId: dbUser.id }
	});
	if (!reviewer) return { ok: false, status: 404, error: 'Reviewer not found.' };

	const context = await getActiveGoalWithJourney(dbUser.id);
	if (!context) return { ok: false, status: 400, error: 'No active goal available.' };

	const journey = context.journey;
	if (!journey || journey.status !== 'ACTIVE') {
		return { ok: false, status: 400, error: 'No active journey found.' };
	}

	const weekNumber = currentWeekNumber(journey.startDate, new Date(), context.timeZone);
	if (!isReviewerDue(reviewer.cadence, weekNumber)) {
		return {
			ok: false,
			status: 400,
			error: `${reviewer.name} is on a biweekly cadence and is not due this week.`
		};
	}

	const existing = await prisma.feedback.findUnique({
		where: {
			reviewerId_journeyId_weekNumber: {
				reviewerId: reviewer.id,
				journeyId: journey.id,
				weekNumber
			}
		}
	});
	if (existing) {
		return {
			ok: false,
			status: 400,
			error: `Feedback already recorded from ${reviewer.name} this week.`
		};
	}

	const openToken = await prisma.token.findFirst({
		where: {
			type: 'FEEDBACK_INVITE',
			reviewerId: reviewer.id,
			journeyId: journey.id,
			weekNumber,
			usedAt: null,
			expiresAt: { gt: new Date() }
		}
	});
	// A reminder adds another live link. The earlier one stays valid.
	if (openToken && notice !== 'reminder') {
		return {
			ok: false,
			status: 400,
			error: `Feedback already requested from ${reviewer.name} this week.`
		};
	}

	const tokenValue = randomBytes(32).toString('hex');
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + FEEDBACK_TOKEN_EXPIRY_DAYS);

	await prisma.token.create({
		data: {
			tokenHash: hashToken(tokenValue),
			type: 'FEEDBACK_INVITE',
			expiresAt,
			reviewerId: reviewer.id,
			journeyId: journey.id,
			weekNumber,
			userId: dbUser.id,
			metadata: { generatedBy: dbUser.id }
		}
	});

	const feedbackLink = `${origin}/stakeholder/feedback/${tokenValue}`;
	const emailTemplate =
		notice === 'reminder'
			? emailTemplates.reminderReviewerFeedback({
					individualName: dbUser.name || undefined,
					feedbackLink
				})
			: emailTemplates.feedbackInvite({
					individualName: dbUser.name || undefined,
					reviewerName: reviewer.name || undefined,
					goalTitle: context.goal.title || undefined,
					feedbackLink
				});
	const smsBody =
		notice === 'reminder'
			? smsTemplates.reminderReviewerFeedback({
					individualName: dbUser.name || undefined,
					feedbackLink
				})
			: smsTemplates.feedbackInvite({
					individualName: dbUser.name || undefined,
					feedbackLink
				});

	try {
		await sendEmail({ to: reviewer.email, ...emailTemplate });
	} catch (error) {
		console.error('[email:error] Failed to send feedback invite', error);
	}

	const smsSent = await trySendSms(reviewer.phone, smsBody);

	return { ok: true, feedbackLink, expiresAt: expiresAt.toISOString(), smsSent };
}

/** Expire unused invite links, then email a new raw token. The raw value is never stored. */
export async function reissueFeedbackToken(
	dbUser: { id: string; name: string | null },
	reviewerId: string,
	origin: string,
	notice: FeedbackNotice = 'invite'
) {
	await prisma.token.updateMany({
		where: {
			type: 'FEEDBACK_INVITE',
			reviewerId,
			usedAt: null,
			expiresAt: { gt: new Date() }
		},
		data: { expiresAt: new Date(Date.now() - 1000) }
	});
	return createFeedbackToken(dbUser, reviewerId, origin, notice);
}
