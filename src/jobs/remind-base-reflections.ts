import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { computeWeekNumber } from '$lib/server/coachUtils';
import { getAppUrl } from '$lib/server/appUrl';

export const remindBaseReflections = async () => {
	const now = new Date();
	const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
	const hour = now.getHours();

	// Only run at 9am (adjust for timezone if needed)
	if (hour !== 9) {
		console.info('[job:remind-base-reflections] Not 9am, skipping');
		return;
	}

	// Determine which reflection type to remind for based on day
	// Monday = 1, Tuesday = 2, Wednesday = 3, Thursday = 4, Friday = 5
	let reflectionType: 'RATING_A' | 'RATING_B' | null = null;
	let reminderDays: 'wednesday_friday' | 'tuesday_thursday' | null = null;

	if (dayOfWeek === 3) {
		// Wednesday - RATING_A for wednesday_friday users
		reflectionType = 'RATING_A';
		reminderDays = 'wednesday_friday';
	} else if (dayOfWeek === 5) {
		// Friday - RATING_B for wednesday_friday users
		reflectionType = 'RATING_B';
		reminderDays = 'wednesday_friday';
	} else if (dayOfWeek === 2) {
		// Tuesday - RATING_A for tuesday_thursday users
		reflectionType = 'RATING_A';
		reminderDays = 'tuesday_thursday';
	} else if (dayOfWeek === 4) {
		// Thursday - RATING_B for tuesday_thursday users
		reflectionType = 'RATING_B';
		reminderDays = 'tuesday_thursday';
	}

	if (!reflectionType) {
		console.info('[job:remind-base-reflections] Not a reminder day, skipping');
		return;
	}

	const baseUrl = getAppUrl();

	// Find all active objectives with users who need reminders
	// Include users with null reminderDays (default to wednesday_friday)
	const objectives = await prisma.objective.findMany({
		where: {
			active: true,
			user: {
				OR: [
					{ reminderDays: reminderDays || undefined },
					...(reminderDays === 'wednesday_friday' ? [{ reminderDays: null }] : [])
				]
			}
		},
		include: {
			user: true,
			cycles: {
				where: { status: 'ACTIVE' },
				orderBy: { startDate: 'desc' },
				take: 1,
				include: {
					reflections: {
						select: { weekNumber: true, reflectionType: true }
					}
				}
			}
		}
	});

	for (const objective of objectives) {
		const cycle = objective.cycles[0];
		if (!cycle) continue;

		// Skip reminders based on check-in frequency
		const freq = cycle.checkInFrequency ?? '3x';
		if (freq === '1x' && reflectionType !== 'RATING_A') {
			// 1x frequency: only send for RATING_A (single combined check-in)
			continue;
		}

		const currentWeek = computeWeekNumber(cycle.startDate);

		// Check if reflection already submitted for this week
		const existingReflection = cycle.reflections.find(
			(r) => r.weekNumber === currentWeek && r.reflectionType === reflectionType
		);

		if (existingReflection) {
			console.info(
				`[job:remind-base-reflections] Reflection already submitted for user ${objective.user.email}, week ${currentWeek}, type ${reflectionType}`
			);
			continue;
		}

		// Compute current streak for motivational messaging
		let currentStreak = 0;
		try {
			const completedSet = new Set(
				cycle.reflections.map((r) => `${r.weekNumber}-${r.reflectionType}`)
			);
			const freq = cycle.checkInFrequency ?? '3x';
			const expectedSequence: Array<{ week: number; type: string }> = [];
			for (let w = 1; w <= currentWeek; w++) {
				if (freq === '1x') {
					expectedSequence.push({ week: w, type: 'RATING_A' });
				} else {
					expectedSequence.push({ week: w, type: 'RATING_A' });
					expectedSequence.push({ week: w, type: 'RATING_B' });
				}
			}
			for (let i = expectedSequence.length - 1; i >= 0; i--) {
				const expected = expectedSequence[i];
				if (completedSet.has(`${expected.week}-${expected.type}`)) {
					currentStreak++;
				} else {
					break;
				}
			}
		} catch {
			// Streak computation is non-critical
		}

		const delivery = objective.user.deliveryMethod ?? 'both';

		// Send reminder email
		if (delivery !== 'sms') {
			try {
				const template = emailTemplates.reminderBase({
					individualName: objective.user.name || undefined,
					objectiveTitle: objective.title,
					reflectionType: reflectionType.toLowerCase(),
					weekNumber: currentWeek,
					appUrl: baseUrl,
					currentStreak
				});
				await sendEmail({
					to: objective.user.email,
					...template
				});
				console.info(
					`[job:remind-base-reflections] Sent ${reflectionType} reminder to ${objective.user.email} for week ${currentWeek}`
				);
			} catch (error) {
				console.error(
					`[job:remind-base-reflections] Failed to send reminder to ${objective.user.email}`,
					error
				);
			}
		}

		// Send SMS reminder if user has a phone number
		if (delivery !== 'email') {
			await trySendSms(
				objective.user.phone,
				smsTemplates.reminderBase({
					reflectionType: reflectionType.toLowerCase(),
					weekNumber: currentWeek,
					appUrl: baseUrl
				})
			);
		}
	}
};
