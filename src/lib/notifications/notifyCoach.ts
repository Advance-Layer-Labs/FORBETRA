import prisma from '$lib/server/prisma';
import { getAppUrl } from '$lib/server/appUrl';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';

/** Email and SMS the coach when a client joins their roster. Failures are logged, not thrown. */
export async function notifyCoachClientAccepted(input: {
	coachId: string;
	clientName: string;
	clientEmail: string;
}) {
	const coach = await prisma.user.findUnique({
		where: { id: input.coachId },
		select: { email: true, name: true, phone: true, deliveryMethod: true }
	});
	if (!coach) return;

	const appUrl = getAppUrl();
	if (wantsEmail(coach.deliveryMethod)) {
		try {
			const template = emailTemplates.coachClientAccepted({
				coachName: coach.name ?? 'Coach',
				clientName: input.clientName,
				clientEmail: input.clientEmail
			});
			await sendEmail({
				to: coach.email,
				subject: template.subject,
				html: template.html,
				text: template.text
			});
		} catch (error) {
			console.warn('[email:error] Failed to notify coach of accepted invite', error);
		}
	}

	if (wantsSms(coach.deliveryMethod)) {
		await trySendSms(
			coach.phone,
			smsTemplates.coachClientAccepted({
				clientName: input.clientName,
				appUrl
			})
		);
	}
}
