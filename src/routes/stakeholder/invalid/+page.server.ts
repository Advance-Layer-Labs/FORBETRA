import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { rateLimit } from '$lib/server/rateLimit';
import { sendEmail } from '$lib/notifications/email';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { getAppUrl } from '$lib/server/appUrl';
import type { Actions } from './$types';

// Generic response to avoid leaking which emails correspond to real reviewers.
const GENERIC_OK = 'If your email is on file, the person who invited you has been notified.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const actions: Actions = {
	requestNewLink: async (event) => {
		const formData = await event.request.formData();
		const email = String(formData.get('email') ?? '')
			.trim()
			.toLowerCase();
		const name = String(formData.get('name') ?? '').trim();

		if (!email || !EMAIL_RE.test(email)) {
			return fail(400, { error: 'Please enter a valid email address.' });
		}

		// Rate limit per email + per IP — covers both targeted enumeration and spam.
		const ip = event.getClientAddress();
		if (!(await rateLimit(`recover-link:email:${email}`, 3, 24 * 60 * 60 * 1000))) {
			// Still return generic success so attackers can't enumerate via rate-limit
			// timing.
			return { success: true, message: GENERIC_OK };
		}
		if (!(await rateLimit(`recover-link:ip:${ip}`, 10, 60 * 60 * 1000))) {
			return { success: true, message: GENERIC_OK };
		}

		// Look up reviewer by email. Multiple individuals can have the same
		// reviewer email, so handle the multi-match case by notifying all of
		// them. (Real-world: rare, but Marc/Alice/Bob might all list the same
		// reviewer.)
		const reviewers = await prisma.reviewer.findMany({
			where: { email },
			include: {
				individual: { select: { name: true, email: true, phone: true, deliveryMethod: true } }
			},
			take: 10
		});

		const appUrl = getAppUrl();

		for (const sh of reviewers) {
			if (wantsEmail(sh.individual.deliveryMethod)) {
				try {
					const template = emailTemplates.reviewerRequestedNewLink({
						individualName: sh.individual.name || undefined,
						reviewerName: name || sh.name || undefined,
						appUrl
					});
					await sendEmail({ to: sh.individual.email, ...template });
				} catch (err) {
					console.error('[email:error] Failed to notify individual of recovery request', err);
				}
			}
			if (wantsSms(sh.individual.deliveryMethod)) {
				await trySendSms(
					sh.individual.phone,
					smsTemplates.reviewerRequestedNewLink({
						reviewerName: name || sh.name || undefined,
						appUrl
					})
				);
			}
		}

		return { success: true, message: GENERIC_OK };
	}
};
