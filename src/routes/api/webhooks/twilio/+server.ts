import twilio from 'twilio';
import prisma from '$lib/server/prisma';
import { classifySmsKeyword } from '$lib/notifications/smsKeywords';
import { getAppUrl } from '$lib/server/appUrl';
import { normalizePhone } from '$lib/utils/phone';
import type { RequestHandler } from './$types';

const twiml = (message: string) => {
	const escaped = message.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
	return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escaped}</Message></Response>`;
};

const xml = (body: string, status = 200) =>
	new Response(body, {
		status,
		headers: { 'Content-Type': 'text/xml' }
	});

export const POST: RequestHandler = async ({ request }) => {
	const authToken = process.env.TWILIO_AUTH_TOKEN;
	if (!authToken) {
		return new Response('Twilio is not configured', { status: 503 });
	}

	const raw = await request.text();
	const params = Object.fromEntries(new URLSearchParams(raw));
	const signature = request.headers.get('x-twilio-signature') ?? '';
	const configuredUrl = `${getAppUrl()}/api/webhooks/twilio`;
	const valid =
		twilio.validateRequest(authToken, signature, request.url, params) ||
		twilio.validateRequest(authToken, signature, configuredUrl, params);
	if (!valid) {
		return new Response('Invalid signature', { status: 403 });
	}

	const keyword = classifySmsKeyword(params.Body);
	if (!keyword) {
		return xml(twiml('Forbetra: reply STOP to opt out or START to resume texts.'));
	}

	const from = params.From ?? '';
	let phone = from;
	try {
		if (from) phone = normalizePhone(from);
	} catch {
		phone = from;
	}

	const deliveryMethod = keyword === 'stop' ? 'email' : 'both';
	if (phone) {
		await prisma.user.updateMany({
			where: { OR: [{ phone }, { phone: from }] },
			data: { deliveryMethod }
		});
	}

	const message =
		keyword === 'stop'
			? 'You will no longer receive Forbetra texts. Reply START to resume.'
			: 'You are subscribed to Forbetra texts again. Reply STOP to opt out.';
	return xml(twiml(message));
};
