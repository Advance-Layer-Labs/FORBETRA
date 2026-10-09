import prisma from '$lib/server/prisma';
import { currentWeekNumber, isReviewerDue } from '$lib/server/domain/week';
import { allowNotification } from '$lib/server/notificationCap';
import { getAppUrl } from '$lib/server/appUrl';
import { createFeedbackToken } from '$lib/server/feedbackToken';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export const remindReviewerFeedback = async (now = new Date()) => {
	const reviewers = await prisma.reviewer.findMany({
		where: {
			tokens: {
				some: {
					type: 'FEEDBACK_INVITE',
					usedAt: null,
					journey: { status: 'ACTIVE' }
				}
			}
		},
		include: {
			individual: {
				select: {
					id: true,
					name: true,
					timezone: true
				}
			},
			tokens: {
				where: {
					type: 'FEEDBACK_INVITE',
					usedAt: null,
					journey: { status: 'ACTIVE' }
				},
				orderBy: { createdAt: 'desc' },
				include: { journey: { select: { startDate: true } } }
			}
		}
	});

	const baseUrl = getAppUrl();

	for (const reviewer of reviewers) {
		const open = reviewer.tokens.find((token) => token.expiresAt > now);
		const expired = reviewer.tokens.find((token) => token.expiresAt <= now);
		const anchor = open ?? expired;
		if (!anchor?.journey) continue;

		const currentWeek = currentWeekNumber(
			anchor.journey.startDate,
			now,
			reviewer.individual.timezone
		);
		if (!isReviewerDue(reviewer.cadence, currentWeek)) continue;

		const allowed = await allowNotification(`sh-remind:${reviewer.id}`, 2, WEEK_MS);
		if (!allowed) continue;

		const result = await createFeedbackToken(
			{ id: reviewer.individual.id, name: reviewer.individual.name },
			reviewer.id,
			baseUrl,
			'reminder'
		);
		if (!result.ok) {
			console.error(
				'[job:remind-reviewer-feedback] Could not send reminder to',
				reviewer.email,
				result.error
			);
			continue;
		}
		console.info(
			open
				? '[job:remind-reviewer-feedback] Sent a reminder; earlier link still works for'
				: '[job:remind-reviewer-feedback] Sent a reminder for an expired link to',
			reviewer.email
		);
	}
};
