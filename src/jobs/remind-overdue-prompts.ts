import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import {
	daysBetweenInTimeZone,
	isLocalWeekday,
	isUsersNotificationHour,
	wantsEmail,
	wantsSms
} from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { currentWeekNumber } from '$lib/server/domain/week';
import { hasCheckInForWeek, weeklyCheckInStreak } from '$lib/server/checkInStreak';
import { allowNotification } from '$lib/server/notificationCap';
import { getAppUrl } from '$lib/server/appUrl';

/** Same day the weekly check-in nudge uses, so the two jobs do not both fire. */
const BASE_REMINDER_DAY = 3;

export const remindOverduePrompts = async (now = new Date()) => {
	const journeys = await prisma.journey.findMany({
		where: { status: 'ACTIVE', goal: { active: true } },
		include: {
			user: true,
			goal: { select: { title: true } },
			checkIns: { select: { submittedAt: true } }
		}
	});

	const appUrl = getAppUrl();

	for (const journey of journeys) {
		const timeZone = journey.user.timezone;
		if (!isLocalWeekday(now, timeZone)) continue;
		if (!isUsersNotificationHour(now, journey.user)) continue;

		const daysIn = daysBetweenInTimeZone(journey.startDate, now, timeZone);
		if (daysIn >= 0 && daysIn % 7 === BASE_REMINDER_DAY) continue;

		const currentWeek = currentWeekNumber(journey.startDate, now, timeZone);
		if (currentWeek > journey.lengthWeeks) continue;
		if (hasCheckInForWeek(journey.startDate, journey.checkIns, currentWeek, timeZone)) continue;

		// Limit overdue reminders to max 2 per user per week (persisted via Redis/rateLimit)
		const allowed = await allowNotification(
			`overdue-remind:${journey.user.id}`,
			2,
			7 * 24 * 60 * 60 * 1000
		);
		if (!allowed) {
			console.info(
				`[job:remind-overdue-prompts] Weekly limit reached for ${journey.user.email}, skipping`
			);
			continue;
		}

		const currentStreak = weeklyCheckInStreak(
			journey.startDate,
			journey.checkIns,
			currentWeek,
			timeZone
		);

		if (wantsEmail(journey.user.deliveryMethod)) {
			try {
				const template = emailTemplates.reminderOverdue({
					individualName: journey.user.name || undefined,
					goalTitle: journey.goal.title,
					currentStreak,
					appUrl
				});
				await sendEmail({ to: journey.user.email, ...template });
				console.info('[job:remind-overdue-prompts] Sent reminder to', journey.user.email);
			} catch (error) {
				console.error(
					'[job:remind-overdue-prompts] Failed to send reminder to',
					journey.user.email,
					error
				);
			}
		}

		if (wantsSms(journey.user.deliveryMethod)) {
			await trySendSms(journey.user.phone, smsTemplates.reminderOverdue({ appUrl }));
		}
	}
};
