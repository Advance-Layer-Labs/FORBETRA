import twilio from 'twilio';

export type SmsPayload = {
	to: string;
	body: string;
};

export type SmsMode = 'send' | 'mock';

export function getSmsMode(): SmsMode {
	const raw = process.env.SMS_MODE?.toLowerCase();
	if (raw === 'send' || raw === 'mock') return raw;

	return process.env.NODE_ENV === 'development' ? 'mock' : 'send';
}

let client: ReturnType<typeof twilio> | null = null;

const getClient = () => {
	if (!client) {
		const sid = process.env.TWILIO_ACCOUNT_SID;
		const token = process.env.TWILIO_AUTH_TOKEN;
		if (!sid || !token) {
			throw new Error('Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
		}
		client = twilio(sid, token);
	}
	return client;
};

export const sendSms = async (payload: SmsPayload) => {
	const mode = getSmsMode();
	if (mode === 'mock') {
		console.info('[sms:mock]', payload);
		return;
	}

	const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
	const fromNumber = process.env.TWILIO_FROM_NUMBER;
	if (!messagingServiceSid && !fromNumber) {
		throw new Error('Missing TWILIO_MESSAGING_SERVICE_SID or TWILIO_FROM_NUMBER');
	}

	const twilioClient = getClient();
	await twilioClient.messages.create({
		body: payload.body,
		to: payload.to,
		...(messagingServiceSid ? { messagingServiceSid } : { from: fromNumber })
	});

	console.info(`[sms:sent] SMS sent to ${payload.to}`);
};

/**
 * Non-blocking SMS helper. Returns true only when a message was handed to the provider.
 * A missing phone or a provider error returns false.
 */
export const trySendSms = async (
	phone: string | null | undefined,
	body: string
): Promise<boolean> => {
	if (!phone) return false;
	try {
		await sendSms({ to: phone, body });
		return true;
	} catch (error) {
		console.error('[sms:error]', error);
		return false;
	}
};
