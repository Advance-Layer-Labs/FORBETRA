import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import prisma from '$lib/server/prisma';
import anthropic from '$lib/server/ai/client';
import { weekNumberForDate } from '$lib/server/domain';
import { rateLimit } from '$lib/server/rateLimit';

export const POST: RequestHandler = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	if (!(await rateLimit(`insight:${dbUser.id}`, 5, 60_000))) {
		return json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
	}

	const body = await event.request.json();
	const messages: Array<{ role: 'user' | 'assistant'; content: string }> = body.messages ?? [];

	if (!messages.length || messages[messages.length - 1].role !== 'user') {
		return json({ error: 'Missing user message' }, { status: 400 });
	}

	if (messages.length > 20) {
		return json({ error: 'Too many messages. Please start a new conversation.' }, { status: 400 });
	}

	const oversizedMessage = messages.find((m) => m.content.length > 2000);
	if (oversizedMessage) {
		return json(
			{ error: 'Message too long. Please keep each message under 2000 characters.' },
			{ status: 400 }
		);
	}

	// Simple rate limit: max 20 insight requests per hour (all types)
	const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
	const recentCount = await prisma.insight.count({
		where: {
			userId: dbUser.id,
			createdAt: { gte: oneHourAgo }
		}
	});
	if (recentCount >= 20) {
		return json({ error: 'Rate limit reached. Please try again later.' }, { status: 429 });
	}

	// Load user's active journey data
	const goal = await prisma.goal.findFirst({
		where: { userId: dbUser.id, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			focusAreas: { where: { active: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
			journeys: {
				where: { status: 'ACTIVE' },
				orderBy: { startDate: 'desc' },
				take: 1,
				include: {
					checkIns: {
						where: { userId: dbUser.id },
						orderBy: { submittedAt: 'asc' },
						select: {
							effortScore: true,
							performanceScore: true,
							notes: true,
							submittedAt: true
						}
					},
					feedback: {
						orderBy: { submittedAt: 'asc' },
						select: {
							weekNumber: true,
							effortScore: true,
							performanceScore: true,
							comment: true,
							reviewer: { select: { name: true } }
						}
					}
				}
			}
		}
	});

	if (!goal || goal.journeys.length === 0) {
		return json({ error: 'No active journey found. Start a journey first.' }, { status: 400 });
	}

	const reviewers = await prisma.reviewer.findMany({
		where: { individualId: dbUser.id, OR: [{ goalId: null }, { goalId: goal.id }] },
		orderBy: { createdAt: 'asc' },
		select: { name: true, relationship: true, attribution: true }
	});

	const journey = goal.journeys[0];
	const currentWeek = weekNumberForDate(journey.startDate, new Date(), dbUser.timezone);

	// Build context string
	const contextLines: string[] = [
		`User: ${dbUser.name || dbUser.email}`,
		`Goal: ${goal.title}`,
		goal.description ? `Description: ${goal.description}` : '',
		`Focus areas: ${goal.focusAreas.map((s) => s.label + (s.description ? ` (${s.description})` : '')).join('; ')}`,
		`Journey: ${journey.label || 'Current'}, started ${journey.startDate.toISOString().slice(0, 10)}, ${journey.lengthWeeks} weeks, current week ${currentWeek}`,
		`Reviewers: ${reviewers.map((s) => s.name + (s.attribution === 'COACH' ? ' (coach)' : s.relationship ? ` (${s.relationship})` : '')).join(', ') || 'None'}`,
		'',
		'--- Check-in Data ---'
	];

	const weeks = new Map<
		number,
		{ checkIns: typeof journey.checkIns; feedback: typeof journey.feedback }
	>();
	const bucket = (week: number) => {
		let entry = weeks.get(week);
		if (!entry) {
			entry = { checkIns: [], feedback: [] };
			weeks.set(week, entry);
		}
		return entry;
	};
	for (const c of journey.checkIns)
		bucket(weekNumberForDate(journey.startDate, c.submittedAt, dbUser.timezone)).checkIns.push(c);
	for (const f of journey.feedback) bucket(f.weekNumber).feedback.push(f);

	for (const [week, entry] of [...weeks.entries()].sort((a, b) => a[0] - b[0])) {
		for (const r of entry.checkIns) {
			let line = `Week ${week} check-in:`;
			line += ` Effort=${r.effortScore} Performance=${r.performanceScore}`;
			if (r.notes) line += ` Notes: "${r.notes}"`;
			contextLines.push(line);
		}

		for (const fb of entry.feedback) {
			let fbLine = `  Week ${week} reviewer ${fb.reviewer.name}:`;
			if (fb.effortScore !== null) fbLine += ` Effort=${fb.effortScore}`;
			if (fb.performanceScore !== null) fbLine += ` Performance=${fb.performanceScore}`;
			if (fb.comment) fbLine += ` Comment: "${fb.comment}"`;
			contextLines.push(fbLine);
		}
	}

	const contextStr = contextLines.filter(Boolean).join('\n');

	const systemPrompt = `You are a developmental coach AI integrated into Forbetra, a personal development platform. You have access to the user's actual data from their development journey.

Your role:
- Answer questions about the user's data, patterns, and progress
- Reference specific numbers, trends, and observations from their checkIns
- Be encouraging but honest — point out both strengths and areas for growth
- Stay focused on the user's development goal and focus areas
- Keep responses concise (2-4 paragraphs max unless more detail is requested)
- Do not make up data — only reference what's in the context below

User's Development Data:
${contextStr}`;

	// Stream the response
	const stream = await anthropic.messages.stream({
		model: 'claude-sonnet-4-5-20250929',
		max_tokens: 1024,
		system: systemPrompt,
		messages: messages.map((m) => ({
			role: m.role,
			content: m.content
		}))
	});

	const encoder = new TextEncoder();
	const readable = new ReadableStream({
		async start(controller) {
			try {
				for await (const event of stream) {
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						controller.enqueue(
							encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
						);
					}
				}
				controller.enqueue(encoder.encode('data: [DONE]\n\n'));
				controller.close();
			} catch (error) {
				console.error('[ask:error]', error);
				controller.enqueue(
					encoder.encode(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`)
				);
				controller.close();
			}
		}
	});

	return new Response(readable, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
