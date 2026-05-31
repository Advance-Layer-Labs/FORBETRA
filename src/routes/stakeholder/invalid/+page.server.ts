import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { rateLimit } from '$lib/server/rateLimit';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { getAppUrl } from '$lib/server/appUrl';
import type { Actions } from './$types';

// Generic response to avoid leaking which emails correspond to real stakeholders.
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

		// Look up stakeholder by email. Multiple individuals can have the same
		// stakeholder email, so handle the multi-match case by notifying all of
		// them. (Real-world: rare, but Marc/Alice/Bob might all list the same
		// reviewer.)
		const stakeholders = await prisma.stakeholder.findMany({
			where: { email },
			include: {
				individual: { select: { name: true, email: true } }
			},
			take: 10
		});

		const appUrl = getAppUrl();

		for (const sh of stakeholders) {
			try {
				const template = emailTemplates.stakeholderRequestedNewLink({
					individualName: sh.individual.name || undefined,
					stakeholderName: name || sh.name || undefined,
					appUrl
				});
				await sendEmail({ to: sh.individual.email, ...template });
			} catch (err) {
				console.error('[email:error] Failed to notify individual of recovery request', err);
			}
		}

		return { success: true, message: GENERIC_OK };
	}
};
