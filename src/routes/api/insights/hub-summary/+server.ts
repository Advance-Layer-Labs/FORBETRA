import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import {
	generateWeeklySynthesis,
	generateWeeklySynthesisStreaming
} from '$lib/server/ai/generateInsight';
import { currentWeekNumber } from '$lib/server/domain/week';
import { rateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	if (!(await rateLimit(`insight:${dbUser.id}`, 5, 60_000))) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	// Get active journey
	const goal = await prisma.goal.findFirst({
		where: { userId: dbUser.id, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			journeys: {
				orderBy: { startDate: 'desc' },
				take: 1
			}
		}
	});

	if (!goal || goal.journeys.length === 0) {
		return json({ error: 'No active journey found' }, { status: 400 });
	}

	const journey = goal.journeys[0];
	const currentWeek = currentWeekNumber(journey.startDate, new Date(), dbUser.timezone);

	// Check if client wants streaming
	const acceptHeader = event.request.headers.get('accept') ?? '';
	if (acceptHeader.includes('text/event-stream')) {
		const result = await generateWeeklySynthesisStreaming(dbUser.id, journey.id, currentWeek);

		if (!result) {
			return json({ error: 'Failed to generate insight' }, { status: 500 });
		}

		const encoder = new TextEncoder();
		const sseStream = new ReadableStream({
			async start(controller) {
				// Send insight ID as first event
				controller.enqueue(
					encoder.encode(`event: meta\ndata: ${JSON.stringify({ id: result.insightId })}\n\n`)
				);

				const reader = result.stream.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
					}
					controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
					controller.close();
				} catch (error) {
					controller.enqueue(
						encoder.encode(
							`event: error\ndata: ${JSON.stringify({ error: error instanceof Error ? error.message : 'Stream error' })}\n\n`
						)
					);
					controller.close();
				}
			}
		});

		return new Response(sseStream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache',
				Connection: 'keep-alive'
			}
		});
	}

	// Non-streaming fallback
	const insightId = await generateWeeklySynthesis(dbUser.id, journey.id, currentWeek);

	if (!insightId) {
		return json({ error: 'Failed to generate insight' }, { status: 500 });
	}

	const insight = await prisma.insight.findUnique({
		where: { id: insightId },
		select: { id: true, content: true, type: true, weekNumber: true, createdAt: true }
	});

	return json({
		id: insight?.id,
		content: insight?.content ?? null,
		type: insight?.type,
		weekNumber: insight?.weekNumber,
		createdAt: insight?.createdAt?.toISOString()
	});
};
