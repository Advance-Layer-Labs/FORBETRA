import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { fail, redirect } from '@sveltejs/kit';
import { randomBytes, createHash } from 'crypto';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { validatePhone, normalizePhone } from '$lib/utils/phone';
import type { Actions, PageServerLoad } from './$types';
import { Prisma } from '@prisma/client';
import type { TokenType } from '@prisma/client';

const generateTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const createInviteToken = () => randomBytes(32).toString('hex');

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

	// Skip onboarding if already completed
	if (dbUser.coachOnboardingCompletedAt) {
		throw redirect(307, '/coach');
	}

	// Smart check: skip if coach already has clients (existing coach)
	const clientCount = await prisma.coachClient.count({
		where: { coachId: dbUser.id }
	});

	if (clientCount > 0) {
		// Backfill the field for existing coaches
		await prisma.user.update({
			where: { id: dbUser.id },
			data: { coachOnboardingCompletedAt: new Date() }
		});
		throw redirect(307, '/coach');
	}

	return {
		coach: {
			name: dbUser.name ?? 'Coach',
			email: dbUser.email
		}
	};
};

export const actions: Actions = {
	createInvite: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

		const formData = await event.request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const name = String(formData.get('name') ?? '').trim();
		const phone = String(formData.get('phone') ?? '').trim();
		const message = String(formData.get('message') ?? '').trim();

		// Parse optional pre-fill payload
		const goalTitle = String(formData.get('prefillGoalTitle') ?? '').trim();
		const reviewersJson = String(formData.get('prefillReviewers') ?? '').trim();

		let reviewers: { name: string; email: string }[] = [];
		try {
			if (reviewersJson) {
				const parsed = JSON.parse(reviewersJson);
				if (Array.isArray(parsed)) {
					reviewers = parsed.flatMap((row) => {
						if (!row || typeof row !== 'object') return [];
						const reviewerName = String((row as { name?: unknown }).name ?? '').trim();
						const reviewerEmail = String((row as { email?: unknown }).email ?? '').trim();
						if (!reviewerName || !reviewerEmail) return [];
						return [{ name: reviewerName, email: reviewerEmail }];
					});
				}
			}
		} catch {
			/* intentionally empty */
		}

		let payload: Record<string, unknown> | null = null;
		if (goalTitle.length > 0 || reviewers.length > 0) {
			payload = {
				...(goalTitle.length > 0 ? { goal: { title: goalTitle } } : {}),
				...(reviewers.length > 0 ? { reviewers } : {})
			};
		}

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, {
				error: 'Please provide a valid email address.',
				values: { email, name, phone, message }
			});
		}

		if (phone && !validatePhone(phone)) {
			return fail(400, {
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).',
				values: { email, name, phone, message }
			});
		}

		const normalizedPhone = phone ? normalizePhone(phone) : null;

		// Check for existing invite from this coach to this email
		const existingInvite = await prisma.coachInvite.findFirst({
			where: {
				coachId: dbUser.id,
				email
			}
		});

		if (existingInvite && !existingInvite.cancelledAt && !existingInvite.acceptedAt) {
			return fail(400, {
				error: 'An active invitation already exists for this email.',
				values: { email, name, message }
			});
		}

		const tokenRaw = createInviteToken();
		const tokenHash = generateTokenHash(tokenRaw);
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

		try {
			await prisma.$transaction(async (tx) => {
				if (existingInvite) {
					await tx.token.deleteMany({
						where: {
							tokenHash: existingInvite.tokenHash,
							type: 'COACH_INVITE'
						}
					});

					await tx.coachInvite.update({
						where: { id: existingInvite.id },
						data: {
							name: name.length > 0 ? name : existingInvite.name,
							phone: normalizedPhone ?? existingInvite.phone,
							message: message.length > 0 ? message : existingInvite.message,
							tokenHash,
							expiresAt,
							acceptedAt: null,
							cancelledAt: null,
							individualId: null
						}
					});

					await tx.token.create({
						data: {
							type: 'COACH_INVITE' satisfies TokenType,
							tokenHash,
							userId: dbUser.id,
							expiresAt
						}
					});
				} else {
					await tx.coachInvite.create({
						data: {
							coachId: dbUser.id,
							email,
							name: name.length > 0 ? name : null,
							phone: normalizedPhone,
							message: message.length > 0 ? message : null,
							payload: payload ? (payload as Prisma.InputJsonValue) : Prisma.JsonNull,
							tokenHash,
							expiresAt
						}
					});

					await tx.token.create({
						data: {
							type: 'COACH_INVITE' satisfies TokenType,
							tokenHash,
							userId: dbUser.id,
							expiresAt
						}
					});
				}

				// Mark onboarding as complete
				await tx.user.update({
					where: { id: dbUser.id },
					data: { coachOnboardingCompletedAt: new Date() }
				});
			});

			const inviteUrl = new URL(`/coach/invite/${tokenRaw}`, event.url.origin).toString();

			// Send invitation email
			let emailFailed = false;
			try {
				const coachName = dbUser.name ?? 'Your coach';
				const template = emailTemplates.coachInvitation({
					coachName,
					recipientName: name || undefined,
					message: message || undefined,
					inviteUrl
				});
				await sendEmail({
					to: email,
					...template
				});
			} catch (error) {
				emailFailed = true;
				console.error('[email:error] Failed to send coach invitation email', error);
			}

			// Send invitation SMS
			await trySendSms(
				normalizedPhone,
				smsTemplates.coachInvitation({
					coachName: dbUser.name || undefined,
					inviteUrl
				})
			);

			return {
				success: true,
				inviteUrl,
				emailFailed
			};
		} catch (error) {
			console.error('Failed to create coach invite during onboarding', error);
			throw error;
		}
	},

	skip: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

		await prisma.user.update({
			where: { id: dbUser.id },
			data: { coachOnboardingCompletedAt: new Date() }
		});

		return { skipped: true };
	}
};
