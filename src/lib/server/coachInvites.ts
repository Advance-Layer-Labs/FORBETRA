import { createHash, randomBytes } from 'crypto';
import { Prisma, type TokenType } from '@prisma/client';
import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';

const generateTokenHash = (token: string) => createHash('sha256').update(token).digest('hex');
const createInviteToken = () => randomBytes(32).toString('hex');

export type CoachInviteActionResult =
	| { ok: true; email?: string; emailFailed?: boolean; inviteUrl?: string }
	| { ok: false; status: number; error: string };

export async function cancelCoachInvite(input: {
	inviteId: string;
	actorId: string;
	isAdmin: boolean;
}): Promise<CoachInviteActionResult> {
	if (!input.inviteId) {
		return { ok: false, status: 400, error: 'Missing invitation identifier.' };
	}

	const invite = await prisma.coachInvite.findUnique({
		where: { id: input.inviteId }
	});

	if (!invite || (invite.coachId !== input.actorId && !input.isAdmin)) {
		return { ok: false, status: 404, error: 'Invitation not found.' };
	}

	if (invite.acceptedAt) {
		return { ok: false, status: 400, error: 'Invitation has already been accepted.' };
	}

	if (invite.cancelledAt) {
		return { ok: true };
	}

	await prisma.$transaction(async (tx) => {
		await tx.coachInvite.update({
			where: { id: input.inviteId },
			data: { cancelledAt: new Date() }
		});

		await tx.token.deleteMany({
			where: {
				tokenHash: invite.tokenHash,
				type: 'COACH_INVITE'
			}
		});
	});

	return { ok: true };
}

export async function resendCoachInvite(input: {
	inviteId: string;
	actorId: string;
	isAdmin: boolean;
	coachName: string;
	origin: string;
	practiceName?: string | null;
	practiceDescription?: string | null;
}): Promise<CoachInviteActionResult> {
	if (!input.inviteId) {
		return { ok: false, status: 400, error: 'Missing invitation identifier.' };
	}

	const invite = await prisma.coachInvite.findUnique({
		where: { id: input.inviteId }
	});

	if (!invite || (invite.coachId !== input.actorId && !input.isAdmin)) {
		return { ok: false, status: 404, error: 'Invitation not found.' };
	}

	if (invite.acceptedAt) {
		return { ok: false, status: 400, error: 'Invitation has already been accepted.' };
	}

	const tokenRaw = createInviteToken();
	const tokenHash = generateTokenHash(tokenRaw);
	const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

	await prisma.$transaction(async (tx) => {
		await tx.token.deleteMany({
			where: {
				tokenHash: invite.tokenHash,
				type: 'COACH_INVITE'
			}
		});

		await tx.coachInvite.update({
			where: { id: input.inviteId },
			data: {
				tokenHash,
				expiresAt,
				cancelledAt: null
			}
		});

		await tx.token.create({
			data: {
				type: 'COACH_INVITE' satisfies TokenType,
				tokenHash,
				userId: input.actorId,
				expiresAt
			}
		});
	});

	const inviteUrl = new URL(`/coach/invite/${tokenRaw}`, input.origin).toString();

	let emailFailed = false;
	try {
		const template = emailTemplates.coachInvitation({
			coachName: input.coachName,
			recipientName: invite.name || undefined,
			message: invite.message || undefined,
			inviteUrl,
			practiceName: input.practiceName || undefined,
			practiceDescription: input.practiceDescription || undefined
		});
		await sendEmail({
			to: invite.email,
			...template
		});
	} catch (error) {
		emailFailed = true;
		console.error('[email:error] Failed to resend coach invitation email', error);
	}

	await trySendSms(
		invite.phone,
		smsTemplates.coachInvitation({
			coachName: input.coachName,
			inviteUrl
		})
	);

	return { ok: true, email: invite.email, emailFailed, inviteUrl };
}

const INVITE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export type CoachInvitePayload = {
	goal?: { title: string; description?: string };
	focusAreas?: { label: string; description?: string }[];
	reviewers?: { name: string; email: string; relationship: string }[];
};

export type IssueCoachInviteResult =
	| {
			ok: true;
			outcome: 'pending';
			email: string;
			inviteId: string;
			createdAt: Date;
			expiresAt: Date;
	  }
	| { ok: true; outcome: 'accepted'; email: string }
	| {
			ok: true;
			outcome: 'sent';
			email: string;
			inviteId: string;
			inviteUrl: string;
			emailFailed: boolean;
			smsSent: boolean;
	  }
	| { ok: false; status: number; error: string };

export async function issueCoachInvite(input: {
	coachId: string;
	email: string;
	name?: string | null;
	phone?: string | null;
	message?: string | null;
	payload?: CoachInvitePayload | null;
	origin: string;
	coachName: string;
	practiceName?: string | null;
	practiceDescription?: string | null;
	sendSms?: boolean;
	/** Single-invite form reopens an accepted address. Bulk invite does not. */
	reissueAccepted?: boolean;
	/** Single-invite form treats any open invite, including an expired one, as a duplicate. */
	treatOpenAsDuplicate?: boolean;
}): Promise<IssueCoachInviteResult> {
	const email = input.email.trim().toLowerCase();
	const name = input.name?.trim() ?? '';
	const message = input.message?.trim() ?? '';
	const existingInvite = await prisma.coachInvite.findFirst({
		where: { coachId: input.coachId, email }
	});

	if (existingInvite && !existingInvite.cancelledAt && !existingInvite.acceptedAt) {
		const stillOpen = input.treatOpenAsDuplicate || existingInvite.expiresAt.getTime() > Date.now();
		if (stillOpen) {
			return {
				ok: true,
				outcome: 'pending',
				email,
				inviteId: existingInvite.id,
				createdAt: existingInvite.createdAt,
				expiresAt: existingInvite.expiresAt
			};
		}
	}

	if (existingInvite?.acceptedAt && !input.reissueAccepted) {
		return { ok: true, outcome: 'accepted', email };
	}

	const tokenRaw = createInviteToken();
	const tokenHash = generateTokenHash(tokenRaw);
	const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

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
						phone: input.phone ?? existingInvite.phone,
						message: message.length > 0 ? message : existingInvite.message,
						payload: input.payload ?? Prisma.DbNull,
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
						userId: input.coachId,
						expiresAt
					}
				});

				return updatedInvite;
			}

			const createdInvite = await tx.coachInvite.create({
				data: {
					coachId: input.coachId,
					email,
					name: name.length > 0 ? name : null,
					phone: input.phone ?? null,
					message: message.length > 0 ? message : null,
					...(input.payload ? { payload: input.payload } : {}),
					tokenHash,
					expiresAt
				}
			});

			await tx.token.create({
				data: {
					type: 'COACH_INVITE' satisfies TokenType,
					tokenHash,
					userId: input.coachId,
					expiresAt
				}
			});

			return createdInvite;
		});

		const inviteUrl = new URL(`/coach/invite/${tokenRaw}`, input.origin).toString();
		let emailFailed = false;
		try {
			const template = emailTemplates.coachInvitation({
				coachName: input.coachName,
				recipientName: name || undefined,
				message: message || undefined,
				inviteUrl,
				practiceName: input.practiceName || undefined,
				practiceDescription: input.practiceDescription || undefined
			});
			await sendEmail({
				to: email,
				...template
			});
		} catch (error) {
			emailFailed = true;
			console.error('[email:error] Failed to send coach invitation email', error);
		}

		const smsSent = input.sendSms
			? await trySendSms(
					invite.phone,
					smsTemplates.coachInvitation({
						coachName: input.coachName,
						inviteUrl
					})
				)
			: false;

		return {
			ok: true,
			outcome: 'sent',
			email,
			inviteId: invite.id,
			inviteUrl,
			emailFailed,
			smsSent
		};
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			return {
				ok: false,
				status: 400,
				error: 'An invitation already exists for this email. Cancel or reuse the existing invite.'
			};
		}
		throw error;
	}
}
