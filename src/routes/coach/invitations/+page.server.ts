import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { fail } from '@sveltejs/kit';
import { cancelCoachInvite, issueCoachInvite, resendCoachInvite } from '$lib/server/coachInvites';
import { getEmailMode } from '$lib/notifications/email';
import { parseBulkInviteList } from '$lib/coachBulkInvites';
import { validatePhone, normalizePhone } from '$lib/utils/phone';
import type { Actions, PageServerLoad } from './$types';

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

		try {
			const result = await issueCoachInvite({
				coachId: dbUser.id,
				email,
				name,
				phone: normalizedPhone,
				message,
				payload,
				origin: event.url.origin,
				coachName: dbUser.name ?? 'Your coach',
				practiceName: dbUser.practiceName,
				practiceDescription: dbUser.practiceDescription,
				sendSms: true,
				reissueAccepted: true,
				treatOpenAsDuplicate: true
			});

			if (!result.ok) {
				return fail(result.status, {
					action: 'createInvite' as const,
					error: result.error,
					values: { email, name, phone, message }
				});
			}

			if (result.outcome === 'pending') {
				return {
					action: 'createInvite' as const,
					duplicate: true,
					existingInvite: {
						id: result.inviteId,
						email: result.email,
						status: 'pending' as const,
						createdAt: result.createdAt.toISOString(),
						expiresAt: result.expiresAt.toISOString(),
						cancelledAt: null,
						acceptedAt: null
					}
				};
			}

			if (result.outcome !== 'sent') {
				return fail(400, {
					action: 'createInvite' as const,
					error: 'This person has already joined. They are on your client list.',
					values: { email, name, phone, message }
				});
			}

			return {
				success: true,
				action: 'createInvite' as const,
				email,
				inviteId: result.inviteId,
				inviteUrl: result.inviteUrl,
				emailFailed: result.emailFailed,
				smsSent: result.smsSent
			};
		} catch (error) {
			console.error('Failed to create coach invite', error);
			throw error;
		}
	},
	bulkInvite: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const people = String(formData.get('people') ?? '');
		const message = String(formData.get('message') ?? '').trim();
		const parsed = parseBulkInviteList(people);

		if (!parsed.ok) {
			return fail(400, {
				action: 'bulkInvite' as const,
				error: parsed.error,
				values: { people, message }
			});
		}

		const sent: { email: string }[] = [];
		const skipped: { email: string; reason: 'pending' | 'accepted' }[] = [];
		const failed: { email: string; inviteUrl?: string; error?: string }[] = [];

		for (const person of parsed.people) {
			const result = await issueCoachInvite({
				coachId: dbUser.id,
				email: person.email,
				name: person.name,
				message,
				origin: event.url.origin,
				coachName: dbUser.name ?? 'Your coach',
				practiceName: dbUser.practiceName,
				practiceDescription: dbUser.practiceDescription,
				sendSms: false
			});

			if (!result.ok) {
				failed.push({ email: person.email, error: result.error });
				continue;
			}
			if (result.outcome === 'pending') {
				skipped.push({ email: result.email, reason: 'pending' });
			} else if (result.outcome === 'accepted') {
				skipped.push({ email: result.email, reason: 'accepted' });
			} else if (result.emailFailed) {
				failed.push({ email: result.email, inviteUrl: result.inviteUrl });
			} else {
				sent.push({ email: result.email });
			}
		}

		return {
			success: true,
			action: 'bulkInvite' as const,
			sent,
			skipped,
			failed,
			invalid: parsed.invalid
		};
	},
	cancelInvite: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const result = await cancelCoachInvite({
			inviteId: String(formData.get('inviteId') ?? ''),
			actorId: dbUser.id,
			isAdmin: dbUser.role === 'ADMIN'
		});

		if (!result.ok) {
			return fail(result.status, { action: 'cancelInvite' as const, error: result.error });
		}

		return { success: true, action: 'cancelInvite' as const };
	},
	resendInvite: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const result = await resendCoachInvite({
			inviteId: String(formData.get('inviteId') ?? ''),
			actorId: dbUser.id,
			isAdmin: dbUser.role === 'ADMIN',
			coachName: dbUser.name ?? 'Your coach',
			origin: event.url.origin,
			practiceName: dbUser.practiceName,
			practiceDescription: dbUser.practiceDescription
		});

		if (!result.ok) {
			return fail(result.status, { action: 'resendInvite' as const, error: result.error });
		}

		return {
			success: true,
			action: 'resendInvite' as const,
			email: result.email,
			emailFailed: result.emailFailed ?? false,
			inviteUrl: result.emailFailed ? result.inviteUrl : undefined
		};
	}
};
