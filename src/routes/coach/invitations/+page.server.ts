import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { randomBytes, createHash } from 'crypto';
import { sendEmail, getEmailMode } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { validatePhone, normalizePhone } from '$lib/utils/phone';
import type { Actions, PageServerLoad } from './$types';
import { Prisma } from '@prisma/client';
import type { TokenType } from '@prisma/client';

const generateTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');

const createInviteToken = () => randomBytes(32).toString('hex');

const INVITE_SELECT = {
	id: true,
	email: true,
	name: true,
	phone: true,
	message: true,
	expiresAt: true,
	acceptedAt: true,
	cancelledAt: true,
	updatedAt: true,
	individual: {
		select: {
			id: true,
			name: true,
			email: true
		}
	},
	createdAt: true
} as const;

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

	const isAdmin = dbUser.role === 'ADMIN';

	const invitations = await prisma.coachInvite.findMany({
		where: isAdmin ? {} : { coachId: dbUser.id },
		orderBy: { createdAt: 'desc' },
		select: INVITE_SELECT
	});

	return {
		coach: {
			name: dbUser.name ?? 'Coach'
		},
		emailMode: getEmailMode(),
		invitations: invitations.map((invite) => ({
			id: invite.id,
			email: invite.email,
			name: invite.name,
			phone: invite.phone,
			message: invite.message,
			expiresAt: invite.expiresAt.toISOString(),
			acceptedAt: invite.acceptedAt?.toISOString() ?? null,
			cancelledAt: invite.cancelledAt?.toISOString() ?? null,
			updatedAt: invite.updatedAt.toISOString(),
			individual: invite.individual
				? {
						id: invite.individual.id,
						name: invite.individual.name ?? invite.individual.email,
						email: invite.individual.email
					}
				: null,
			createdAt: invite.createdAt.toISOString()
		}))
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

		// Build optional pre-fill payload
		const goalTitle = String(formData.get('goalTitle') ?? '').trim();
		const goalDescription = String(formData.get('goalDescription') ?? '').trim();

		const focusAreas: { label: string; description?: string }[] = [];
		for (let i = 1; i <= 5; i++) {
			const label = String(formData.get(`focusAreaLabel${i}`) ?? '').trim();
			if (label) {
				const desc = String(formData.get(`focusAreaDescription${i}`) ?? '').trim();
				focusAreas.push({ label, ...(desc ? { description: desc } : {}) });
			}
		}

		const reviewers: { name: string; email: string }[] = [];
		for (let i = 1; i <= 5; i++) {
			const sName = String(formData.get(`reviewerName${i}`) ?? '').trim();
			const sEmail = String(formData.get(`reviewerEmail${i}`) ?? '').trim();
			if (sName && sEmail) {
				reviewers.push({ name: sName, email: sEmail });
			}
		}

		const payload =
			goalTitle || focusAreas.length > 0 || reviewers.length > 0
				? {
						...(goalTitle
							? {
									goal: {
										title: goalTitle,
										...(goalDescription ? { description: goalDescription } : {})
									}
								}
							: {}),
						...(focusAreas.length > 0 ? { focusAreas } : {}),
						...(reviewers.length > 0
							? { reviewers: reviewers.map((s) => ({ ...s, relationship: '' })) }
							: {})
					}
				: undefined;

		if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
			return fail(400, {
				action: 'createInvite' as const,
				error: 'Please provide a valid email address.',
				values: { email, name, phone, message }
			});
		}

		if (phone && !validatePhone(phone)) {
			return fail(400, {
				action: 'createInvite' as const,
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).',
				values: { email, name, phone, message }
			});
		}

		const normalizedPhone = phone ? normalizePhone(phone) : null;

		const existingInvite = await prisma.coachInvite.findFirst({
			where: {
				coachId: dbUser.id,
				email
			}
		});

		if (existingInvite && !existingInvite.cancelledAt && !existingInvite.acceptedAt) {
			// Soft duplicate — let the UI offer Resend / Cancel
			return {
				action: 'createInvite' as const,
				duplicate: true,
				existingInvite: {
					id: existingInvite.id,
					email: existingInvite.email,
					status: 'pending' as const,
					createdAt: existingInvite.createdAt.toISOString(),
					expiresAt: existingInvite.expiresAt.toISOString(),
					cancelledAt: null,
					acceptedAt: null
				}
			};
		}

		const tokenRaw = createInviteToken();
		const tokenHash = generateTokenHash(tokenRaw);
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

		try {
			const invite = await prisma.$transaction(async (tx) => {
				if (existingInvite) {
					await tx.token.deleteMany({
						where: {
							tokenHash: existingInvite.tokenHash,
							type: 'COACH_INVITE'
						}
					});

					const updatedInvite = await tx.coachInvite.update({
						where: { id: existingInvite.id },
						data: {
							name: name.length > 0 ? name : existingInvite.name,
							phone: normalizedPhone ?? existingInvite.phone,
							message: message.length > 0 ? message : existingInvite.message,
							payload: payload ?? Prisma.DbNull,
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

					return updatedInvite;
				}

				const createdInvite = await tx.coachInvite.create({
					data: {
						coachId: dbUser.id,
						email,
						name: name.length > 0 ? name : null,
						phone: normalizedPhone,
						message: message.length > 0 ? message : null,
						...(payload ? { payload } : {}),
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

				return createdInvite;
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

			const smsSent = await trySendSms(
				invite.phone,
				smsTemplates.coachInvitation({
					coachName: dbUser.name || undefined,
					inviteUrl
				})
			);

			return {
				success: true,
				action: 'createInvite' as const,
				email,
				inviteId: invite.id,
				inviteUrl,
				emailFailed,
				smsSent
			};
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
				return fail(400, {
					action: 'createInvite' as const,
					error:
						'An invitation already exists for this email. Cancel or reuse the existing invite.',
					values: { email, name, phone, message }
				});
			}

			console.error('Failed to create coach invite', error);
			throw error;
		}
	},
	cancelInvite: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const inviteId = String(formData.get('inviteId') ?? '');

		if (!inviteId) {
			return fail(400, {
				action: 'cancelInvite' as const,
				error: 'Missing invitation identifier.'
			});
		}

		const invite = await prisma.coachInvite.findUnique({
			where: { id: inviteId }
		});

		if (!invite || (invite.coachId !== dbUser.id && dbUser.role !== 'ADMIN')) {
			return fail(404, { action: 'cancelInvite' as const, error: 'Invitation not found.' });
		}

		if (invite.acceptedAt) {
			return fail(400, {
				action: 'cancelInvite' as const,
				error: 'Invitation has already been accepted.'
			});
		}

		if (invite.cancelledAt) {
			return { success: true, action: 'cancelInvite' as const };
		}

		await prisma.$transaction(async (tx) => {
			await tx.coachInvite.update({
				where: { id: inviteId },
				data: {
					cancelledAt: new Date()
				}
			});

			await tx.token.deleteMany({
				where: {
					tokenHash: invite.tokenHash,
					type: 'COACH_INVITE'
				}
			});
		});

		return { success: true, action: 'cancelInvite' as const };
	},
	resendInvite: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const inviteId = String(formData.get('inviteId') ?? '');

		if (!inviteId) {
			return fail(400, {
				action: 'resendInvite' as const,
				error: 'Missing invitation identifier.'
			});
		}

		const invite = await prisma.coachInvite.findUnique({
			where: { id: inviteId }
		});

		if (!invite || (invite.coachId !== dbUser.id && dbUser.role !== 'ADMIN')) {
			return fail(404, { action: 'resendInvite' as const, error: 'Invitation not found.' });
		}

		if (invite.acceptedAt) {
			return fail(400, {
				action: 'resendInvite' as const,
				error: 'Invitation has already been accepted.'
			});
		}

		const tokenRaw = createInviteToken();
		const tokenHash = generateTokenHash(tokenRaw);
		const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

		await prisma.$transaction(async (tx) => {
			// Remove old token
			await tx.token.deleteMany({
				where: {
					tokenHash: invite.tokenHash,
					type: 'COACH_INVITE'
				}
			});

			// Update invite with new token, reset expiry, clear cancelledAt
			await tx.coachInvite.update({
				where: { id: inviteId },
				data: {
					tokenHash,
					expiresAt,
					cancelledAt: null
				}
			});

			// Create new token row
			await tx.token.create({
				data: {
					type: 'COACH_INVITE' satisfies TokenType,
					tokenHash,
					userId: dbUser.id,
					expiresAt
				}
			});
		});

		const inviteUrl = new URL(`/coach/invite/${tokenRaw}`, event.url.origin).toString();

		let emailFailed = false;
		try {
			const coachName = dbUser.name ?? 'Your coach';
			const template = emailTemplates.coachInvitation({
				coachName,
				recipientName: invite.name || undefined,
				message: invite.message || undefined,
				inviteUrl
			});
			await sendEmail({
				to: invite.email,
				...template
			});
		} catch (error) {
			emailFailed = true;
			console.error('[email:error] Failed to resend coach invitation email', error);
		}

		// Resend SMS if phone on file
		await trySendSms(
			invite.phone,
			smsTemplates.coachInvitation({
				coachName: dbUser.name || undefined,
				inviteUrl
			})
		);

		return {
			success: true,
			action: 'resendInvite' as const,
			email: invite.email,
			emailFailed
		};
	}
};
