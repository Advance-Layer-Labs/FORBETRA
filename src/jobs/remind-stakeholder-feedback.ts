import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { computeWeekNumber } from '$lib/server/coachUtils';
import { rateLimit } from '$lib/server/rateLimit';
import { getAppUrl } from '$lib/server/appUrl';

export const remindStakeholderFeedback = async () => {
	const stakeholders = await prisma.stakeholder.findMany({
		include: {
			individual: {
				select: {
					id: true,
					email: true,
					name: true
				}
			},
			tokens: {
				where: { type: 'FEEDBACK_INVITE', usedAt: null },
				orderBy: { expiresAt: 'asc' }
			}
		}
	});

	const individualIds = Array.from(new Set(stakeholders.map((s) => s.individual.id)));
	const activeCycles = await prisma.cycle.findMany({
		where: { userId: { in: individualIds }, status: 'ACTIVE' },
		orderBy: { startDate: 'desc' },
		select: { userId: true, stakeholderCadence: true, startDate: true }
	});

	const individualCycles = new Map<string, { stakeholderCadence: string; startDate: Date }>();
	for (const cycle of activeCycles) {
		if (!individualCycles.has(cycle.userId)) {
			individualCycles.set(cycle.userId, {
				stakeholderCadence: cycle.stakeholderCadence,
				startDate: cycle.startDate
			});
		}
	}

	const baseUrl = getAppUrl();

	for (const stakeholder of stakeholders) {
		const pending = stakeholder.tokens.filter((token) => token.expiresAt > new Date());
		if (pending.length === 0) continue;

		// Check biweekly cadence — skip on even weeks
		const cycleInfo = individualCycles.get(stakeholder.individual.id);
		if (cycleInfo && cycleInfo.stakeholderCadence === 'biweekly') {
			const currentWeek = computeWeekNumber(cycleInfo.startDate);
			if (currentWeek % 2 === 0) {
				continue; // Only send on odd-numbered weeks
			}
		}

		// Limit to 2 reminders per stakeholder per week
		const allowed = await rateLimit(`sh-remind:${stakeholder.id}`, 2, 7 * 24 * 60 * 60 * 1000);
		if (!allowed) continue;

		// Get the most recent pending token
		const latestToken = pending[0];
		const feedbackLink = `${baseUrl}/stakeholder/feedback/${latestToken.tokenHash}`;

		try {
			const template = emailTemplates.reminderStakeholderFeedback({
				individualName: stakeholder.individual.name || undefined,
				stakeholderName: stakeholder.name || undefined,
				feedbackLink
			});
			await sendEmail({
				to: stakeholder.email,
				...template
			});
			console.info('[job:remind-stakeholder-feedback] Sent reminder to', stakeholder.email);
		} catch (error) {
			console.error(
				'[job:remind-stakeholder-feedback] Failed to send reminder to',
				stakeholder.email,
				error
			);
		}

		// Send SMS reminder to stakeholder
		await trySendSms(
			stakeholder.phone,
			smsTemplates.reminderStakeholderFeedback({
				individualName: stakeholder.individual.name || undefined,
				feedbackLink
			})
		);
	}
};
