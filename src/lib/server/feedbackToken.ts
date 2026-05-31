import prisma from '$lib/server/prisma';
import { randomBytes } from 'node:crypto';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { FEEDBACK_TOKEN_EXPIRY_DAYS } from '$lib/server/coachUtils';
import { hashToken } from '$lib/server/tokenHash';

/**
 * Validates stakeholder, checks cadence gating + auto-throttle,
 * creates token, sends email + SMS.
 */
export async function createFeedbackToken(
	dbUser: { id: string; name: string | null },
	stakeholderId: string,
	origin: string
): Promise<
	| { ok: true; feedbackLink: string; expiresAt: string; smsSent: boolean }
	| { ok: false; status: number; error: string }
> {
	const stakeholder = await prisma.stakeholder.findFirst({
		where: { id: stakeholderId, individualId: dbUser.id }
	});

	if (!stakeholder) {
		return { ok: false, status: 404, error: 'Reviewer not found.' };
	}

	const objective = await prisma.objective.findFirst({
		where: { userId: dbUser.id, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			subgoals: { where: { active: true }, orderBy: { createdAt: 'asc' } },
			cycles: { orderBy: { startDate: 'desc' }, take: 1 }
		}
	});

	if (!objective) {
		return { ok: false, status: 400, error: 'No active goal available.' };
	}

	const primarySubgoal = objective.subgoals[0];
	if (!primarySubgoal) {
		return { ok: false, status: 400, error: 'Add a focus area before requesting feedback.' };
	}

	const cycle = objective.cycles[0];
	if (!cycle) {
		return { ok: false, status: 400, error: 'No active cycle found.' };
	}

	const weekNumber = Math.max(
		1,
		Math.floor((new Date().getTime() - cycle.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
	);

	// Cadence gating
	const cadence = cycle.stakeholderCadence ?? 'weekly';
	if (cadence !== 'every_checkin') {
		let windowStart: Date;
		if (cadence === 'monthly') {
			windowStart = new Date();
			windowStart.setDate(1);
			windowStart.setHours(0, 0, 0, 0);
		} else {
			windowStart = new Date();
			const dayOfWeek = windowStart.getDay();
			const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
			windowStart.setDate(windowStart.getDate() + mondayOffset);
			windowStart.setHours(0, 0, 0, 0);
		}

		const existingToken = await prisma.token.findFirst({
			where: {
				type: 'FEEDBACK_INVITE',
				stakeholderId: stakeholder.id,
				createdAt: { gte: windowStart }
			}
		});

		if (existingToken) {
			const period = cadence === 'monthly' ? 'this month' : 'this week';
			return {
				ok: false,
				status: 400,
				error: `Feedback already requested from ${stakeholder.name} ${period}. Your coach set the cadence to ${cadence === 'monthly' ? 'monthly' : 'weekly'}.`
			};
		}
	}

	// Auto-throttle
	if (cycle.autoThrottle) {
		const activeRequestCount = await prisma.token.count({
			where: {
				type: 'FEEDBACK_INVITE',
				stakeholderId: stakeholder.id,
				usedAt: null,
				expiresAt: { gt: new Date() }
			}
		});

		if (activeRequestCount >= 3) {
			return {
				ok: false,
				status: 400,
				error: `${stakeholder.name} already has ${activeRequestCount} pending feedback requests. Auto-throttle is limiting new requests to prevent survey fatigue.`
			};
		}
	}

	const reflection = await prisma.reflection.upsert({
		where: {
			cycleId_weekNumber_reflectionType_subgoalId: {
				cycleId: cycle.id,
				weekNumber,
				reflectionType: 'RATING_B',
				subgoalId: primarySubgoal.id
			}
		},
		update: {},
		create: {
			cycleId: cycle.id,
			userId: dbUser.id,
			subgoalId: primarySubgoal.id,
			reflectionType: 'RATING_B',
			weekNumber,
			checkInDate: new Date()
		}
	});

	const tokenValue = randomBytes(32).toString('hex');
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + FEEDBACK_TOKEN_EXPIRY_DAYS);

	await prisma.token.create({
		data: {
			tokenHash: hashToken(tokenValue),
			type: 'FEEDBACK_INVITE',
			expiresAt,
			stakeholderId: stakeholder.id,
			reflectionId: reflection.id,
			userId: dbUser.id,
			metadata: { generatedBy: dbUser.id }
		}
	});

	const feedbackLink = `${origin}/stakeholder/feedback/${tokenValue}`;

	// Send feedback invite email
	try {
		const template = emailTemplates.feedbackInvite({
			individualName: dbUser.name || undefined,
			stakeholderName: stakeholder.name || undefined,
			objectiveTitle: objective.title || undefined,
			feedbackLink
		});
		await sendEmail({ to: stakeholder.email, ...template });
	} catch (error) {
		console.error('[email:error] Failed to send feedback invite', error);
	}

	// Send feedback invite SMS
	let smsSent = false;
	if (stakeholder.phone) {
		await trySendSms(
			stakeholder.phone,
			smsTemplates.feedbackInvite({
				individualName: dbUser.name || undefined,
				feedbackLink
			})
		);
		smsSent = true;
	}

	return { ok: true, feedbackLink, expiresAt: expiresAt.toISOString(), smsSent };
}
