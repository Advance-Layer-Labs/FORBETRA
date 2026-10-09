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
import { getAppUrl } from '$lib/server/appUrl';

/** Day within the journey week (0 = journey start weekday) on which to nudge. */
const REMINDER_DAY_OF_JOURNEY_WEEK = 3;

export const remindBaseReflections = async (now = new Date()) => {
	const baseUrl = getAppUrl();

	const journeys = await prisma.journey.findMany({
		where: { status: 'ACTIVE', goal: { active: true } },
		include: {
			user: true,
			goal: { select: { title: true } },
			checkIns: { select: { submittedAt: true } }
		}
	});

	for (const journey of journeys) {
		const timeZone = journey.user.timezone;
		if (!isLocalWeekday(now, timeZone)) continue;
		if (!isUsersNotificationHour(now, journey.user)) continue;

		const daysIn = daysBetweenInTimeZone(journey.startDate, now, timeZone);
		if (daysIn < 0 || daysIn % 7 !== REMINDER_DAY_OF_JOURNEY_WEEK) continue;

		const currentWeek = currentWeekNumber(journey.startDate, now, timeZone);
		if (currentWeek > journey.lengthWeeks) continue;

		if (hasCheckInForWeek(journey.startDate, journey.checkIns, currentWeek, timeZone)) {
			console.info(
				`[job:remind-base-checkIns] Check-in already submitted for user ${journey.user.email}, week ${currentWeek}`
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
				const template = emailTemplates.reminderBase({
					individualName: journey.user.name || undefined,
					goalTitle: journey.goal.title,
					weekNumber: currentWeek,
					appUrl: baseUrl,
					currentStreak
				});
				await sendEmail({ to: journey.user.email, ...template });
				console.info(
					`[job:remind-base-checkIns] Sent check-in reminder to ${journey.user.email} for week ${currentWeek}`
				);
			} catch (error) {
				console.error(
					`[job:remind-base-checkIns] Failed to send reminder to ${journey.user.email}`,
					error
				);
			}
		}

		if (wantsSms(journey.user.deliveryMethod)) {
			await trySendSms(
				journey.user.phone,
				smsTemplates.reminderBase({ weekNumber: currentWeek, appUrl: baseUrl })
			);
		}
	}
};
