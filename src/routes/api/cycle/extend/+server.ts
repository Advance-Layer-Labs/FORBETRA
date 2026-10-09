import { json } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { rateLimit } from '$lib/server/rateLimit';
import { journeyEndDate } from '$lib/server/domain';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	if (!(await rateLimit(`journey-extend:${dbUser.id}`, 5, 60_000))) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	const body = await event.request.json();
	const journeyId = typeof body.journeyId === 'string' ? body.journeyId.trim() : '';
	const weeks = typeof body.weeks === 'number' && body.weeks >= 1 ? body.weeks : 4;

	if (!journeyId) {
		return json({ error: 'journeyId is required' }, { status: 400 });
	}

	if (weeks < 1 || weeks > 12) {
		return json({ error: 'weeks must be between 1 and 12' }, { status: 400 });
	}

	const journey = await prisma.journey.findFirst({
		where: { id: journeyId, userId: dbUser.id }
	});

	if (!journey) {
		return json({ error: 'Journey not found' }, { status: 404 });
	}

	const lengthWeeks = journey.lengthWeeks + weeks;
	const newEnd = journeyEndDate(journey.startDate, lengthWeeks);

	await prisma.journey.update({
		where: { id: journeyId },
		data: { endDate: newEnd, lengthWeeks }
	});

	return json({ success: true, newEndDate: newEnd.toISOString(), lengthWeeks });
};
