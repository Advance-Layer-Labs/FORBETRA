import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { generateCoachPrep, generateCoachPrepStreaming } from '$lib/server/ai/generateInsight';
import { rateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

	if (!(await rateLimit(`insight:${dbUser.id}`, 5, 60_000))) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	const body = await event.request.json();
	const individualId = (body.individualId ?? '').toString().trim();

	if (!individualId) {
		return json({ error: 'individualId is required' }, { status: 400 });
	}

	// Verify coach-client relationship
	const relationship = await prisma.coachClient.findUnique({
		where: {
			coachId_individualId: {
				coachId: dbUser.id,
				individualId
			}
		}
	});

	if (!relationship) {
		return json({ error: 'You do not have access to this client' }, { status: 403 });
	}

	// Find active journey for individual
	const goal = await prisma.goal.findFirst({
		where: { userId: individualId, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			journeys: {
				where: { status: 'ACTIVE' },
				orderBy: { startDate: 'desc' },
				take: 1
			}
		}
	});

	if (!goal || goal.journeys.length === 0) {
		return json({ error: 'No active journey found for this client' }, { status: 400 });
	}

	const journey = goal.journeys[0];

	// Check if client wants streaming
	const acceptHeader = event.request.headers.get('accept') ?? '';
	if (acceptHeader.includes('text/event-stream')) {
		const result = await generateCoachPrepStreaming(dbUser.id, individualId, journey.id);

		if (!result) {
			return json({ error: 'Failed to generate coach prep' }, { status: 500 });
		}

		const encoder = new TextEncoder();
		const sseStream = new ReadableStream({
			async start(controller) {
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
	const insightId = await generateCoachPrep(dbUser.id, individualId, journey.id);

	if (!insightId) {
		return json({ error: 'Failed to generate coach prep' }, { status: 500 });
	}

	const insight = await prisma.insight.findUnique({
		where: { id: insightId },
		select: { id: true, content: true, createdAt: true }
	});

	return json({
		id: insight?.id,
		content: insight?.content ?? null,
		createdAt: insight?.createdAt?.toISOString()
	});
};
