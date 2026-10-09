import { fail, type RequestEvent } from '@sveltejs/kit';
import type { User } from '@prisma/client';
import prisma from '$lib/server/prisma';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import { currentWeekNumber, recordCheckIn } from '$lib/server/domain';
import { computeCompletionMetrics, withCheckInWeeks } from '$lib/server/hubMetrics';
import { checkInEntrySchema } from '$lib/validation/reflection';
import { sendEmail } from '$lib/notifications/email';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { getAppUrl } from '$lib/server/appUrl';
import { emailTemplates } from '$lib/notifications/emailTemplates';

const MILESTONE_THRESHOLDS = [3, 7, 14, 21, 30, 50];

/** One Effort + one Performance per submission. Multiple check-ins per week are allowed. */
export async function submitCheckIn(event: RequestEvent, dbUser: User) {
	const context = await getActiveGoalWithJourney(dbUser.id);
	const journey = context?.journey;
	if (!context || !journey) {
		return fail(400, { error: 'No active journey found. Complete onboarding first.' });
	}
	if (journey.status === 'COMPLETED') {
		return fail(400, {
			error: 'This journey is complete. Start a new journey to keep checking in.'
		});
	}

	const formData = await event.request.formData();
	const submission = Object.fromEntries(formData) as Record<string, string>;
	const parsed = checkInEntrySchema.safeParse(submission);

	if (!parsed.success) {
		const errors = parsed.error.flatten();
		return fail(400, {
			error:
				errors.fieldErrors.effortScore?.[0] ??
				errors.fieldErrors.performanceScore?.[0] ??
				errors.fieldErrors.notes?.[0] ??
				'Invalid input'
		});
	}

	const data = parsed.data;
	const timeZone = dbUser.timezone;
	const weekNumber = currentWeekNumber(journey.startDate, new Date(), timeZone);

	try {
		const rows = await prisma.checkIn.findMany({
			where: { journeyId: journey.id },
			select: { id: true, effortScore: true, performanceScore: true, submittedAt: true }
		});
		const isFirstThisWeek = !withCheckInWeeks(journey.startDate, rows, timeZone).some(
			(row) => row.weekNumber === weekNumber
		);

		const created = await recordCheckIn({
			journeyId: journey.id,
			userId: dbUser.id,
			effortScore: data.effortScore,
			performanceScore: data.performanceScore,
			notes: data.notes ?? null
		});

		const allCheckIns = withCheckInWeeks(journey.startDate, [...rows, created], timeZone);
		const streak = computeCompletionMetrics(allCheckIns, weekNumber).currentStreak;

		const milestone = MILESTONE_THRESHOLDS.includes(streak) ? streak : null;
		if (milestone && isFirstThisWeek && wantsEmail(dbUser.deliveryMethod)) {
			sendEmail({
				to: dbUser.email,
				...emailTemplates.milestoneCelebration({
					individualName: dbUser.name ?? dbUser.email,
					milestone,
					goalTitle: context.goal.title
				})
			}).catch((err) => {
				console.warn('[email:warn] Failed to send milestone email', err);
			});
		}
		if (milestone && isFirstThisWeek && wantsSms(dbUser.deliveryMethod)) {
			trySendSms(
				dbUser.phone,
				smsTemplates.milestoneCelebration({
					milestone,
					goalTitle: context.goal.title,
					appUrl: getAppUrl()
				})
			).catch((err) => {
				console.warn('[sms:warn] Failed to send milestone SMS', err);
			});
		}

		return {
			success: true as const,
			streak,
			milestone,
			weekNumber,
			checkInId: created.id,
			effortScore: created.effortScore,
			performanceScore: created.performanceScore
		};
	} catch (error) {
		console.error('Failed to record check-in', error);
		return fail(500, { error: 'Could not save your check-in. Please try again.' });
	}
}
