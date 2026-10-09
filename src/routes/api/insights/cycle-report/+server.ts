import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { generateCycleReport, generateCycleReportStreaming } from '$lib/server/ai/generateInsight';
import { rateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	if (!(await rateLimit(`insight:${dbUser.id}`, 5, 60_000))) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	const goal = await prisma.goal.findFirst({
		where: { userId: dbUser.id, active: true },
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
		return json({ error: 'No active journey found' }, { status: 400 });
	}

	const journey = goal.journeys[0];

	// Check if client wants streaming via Accept header
	const acceptHeader = event.request.headers.get('accept') ?? '';
	if (acceptHeader.includes('text/event-stream')) {
		const result = await generateCycleReportStreaming(dbUser.id, journey.id);

		if (!result) {
			return json({ error: 'Failed to generate report' }, { status: 500 });
		}

		const { insightId, stream } = result;
		const reader = stream.getReader();
		const encoder = new TextEncoder();

		const sseStream = new ReadableStream({
			async start(controller) {
				// Send the insight ID as the first event
				controller.enqueue(
					encoder.encode(`event: meta\ndata: ${JSON.stringify({ id: insightId })}\n\n`)
				);

				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						controller.enqueue(encoder.encode(`data: ${JSON.stringify(value)}\n\n`));
					}
					controller.enqueue(encoder.encode('event: done\ndata: {}\n\n'));
					controller.close();
				} catch {
					controller.enqueue(
						encoder.encode(`event: error\ndata: ${JSON.stringify({ error: 'Stream failed' })}\n\n`)
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

	// Non-streaming fallback (backward compatible)
	const insightId = await generateCycleReport(dbUser.id, journey.id);

	if (!insightId) {
		return json({ error: 'Failed to generate report' }, { status: 500 });
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
