/**
 * Insight Generation Service
 *
 * Core functions for generating AI insights using Claude.
 * Each function creates a PENDING Insight record, gathers context,
 * calls the API, and updates the record.
 */

import prisma from '$lib/server/prisma';
import anthropic from './client';
import {
	SYSTEM_MESSAGE,
	buildCheckInPrompt,
	buildWeeklySynthesisPrompt,
	buildCoachPrepPrompt,
	buildCycleReportPrompt,
	type CheckInContext,
	type WeeklySynthesisContext,
	type CoachPrepContext,
	type CycleReportContext
} from './prompts';
import { stdDev } from '$lib/server/coachUtils';
import { currentWeekNumber, weekNumberForDate } from '$lib/server/domain/week';
import { withCheckInWeeks } from '$lib/server/hubMetrics';
import type { InsightType } from '@prisma/client';

// Override via ANTHROPIC_MODEL_ID env var without a redeploy. When upgrading
// model versions (e.g., 4.5 → 4.6), test prompt outputs first — model behavior
// can shift even on the same prompts.
const MODEL_ID = process.env.ANTHROPIC_MODEL_ID || 'claude-sonnet-4-5-20250929';

// System message is long and stable across every call — mark it cacheable so
// Anthropic charges full input tokens only on cache misses.
const CACHEABLE_SYSTEM = [
	{ type: 'text' as const, text: SYSTEM_MESSAGE, cache_control: { type: 'ephemeral' as const } }
];

async function callClaude(prompt: string, maxTokens: number = 1024): Promise<string> {
	const response = await anthropic.messages.create({
		model: MODEL_ID,
		max_tokens: maxTokens,
		system: CACHEABLE_SYSTEM,
		messages: [{ role: 'user', content: prompt }]
	});

	const textBlock = response.content.find((block) => block.type === 'text');
	return textBlock?.text ?? '';
}

function callClaudeStreaming(prompt: string, maxTokens: number = 4096): ReadableStream<string> {
	return new ReadableStream<string>({
		async start(controller) {
			try {
				const stream = anthropic.messages.stream({
					model: MODEL_ID,
					max_tokens: maxTokens,
					system: CACHEABLE_SYSTEM,
					messages: [{ role: 'user', content: prompt }]
				});

				for await (const event of stream) {
					if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
						controller.enqueue(event.delta.text);
					}
				}

				controller.close();
			} catch (error) {
				controller.error(error);
			}
		}
	});
}

export async function generateCycleReportStreaming(
	userId: string,
	journeyId: string
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	// Create PENDING insight record
	const insight = await prisma.insight.create({
		data: {
			userId,
			journeyId,
			weekNumber: null,
			type: 'JOURNEY_REPORT',
			status: 'PENDING',
			modelId: MODEL_ID
		}
	});

	try {
		await prisma.insight.update({
			where: { id: insight.id },
			data: { status: 'GENERATING' }
		});

		// Reuse the same context-gathering logic as generateCycleReport
		const prompt = await buildCycleReportContext(userId, journeyId);

		const rawStream = callClaudeStreaming(prompt, 4096);
		let accumulated = '';

		// Wrap the stream to accumulate content and save on completion
		const wrappedStream = new ReadableStream<string>({
			async start(controller) {
				const reader = rawStream.getReader();
				try {
					while (true) {
						const { done, value } = await reader.read();
						if (done) break;
						accumulated += value;
						controller.enqueue(value);
					}

					// Stream complete — save accumulated content
					await prisma.insight.update({
						where: { id: insight.id },
						data: {
							status: 'COMPLETED',
							content: accumulated,
							promptHash: simpleHash(prompt)
						}
					});

					controller.close();
				} catch (error) {
					await prisma.insight.update({
						where: { id: insight.id },
						data: {
							status: 'FAILED',
							metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
						}
					});
					controller.error(error);
				}
			}
		});

		return { insightId: insight.id, stream: wrappedStream };
	} catch (error: unknown) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		console.error('[insight:error] Failed to start streaming JOURNEY_REPORT', {
			insightId: insight.id,
			error: errMsg
		});

		await prisma.insight.update({
			where: { id: insight.id },
			data: {
				status: 'FAILED',
				metadata: { error: errMsg }
			}
		});

		return null;
	}
}

async function createAndGenerateInsight(
	userId: string,
	journeyId: string | null,
	weekNumber: number | null,
	type: InsightType,
	promptBuilder: () => Promise<string>,
	maxTokens: number = 1024
): Promise<string | null> {
	const insight = await prisma.insight.create({
		data: {
			userId,
			journeyId,
			weekNumber,
			type,
			status: 'PENDING',
			modelId: MODEL_ID
		}
	});

	try {
		await prisma.insight.update({
			where: { id: insight.id },
			data: { status: 'GENERATING' }
		});

		const prompt = await promptBuilder();
		const content = await callClaude(prompt, maxTokens);

		await prisma.insight.update({
			where: { id: insight.id },
			data: {
				status: 'COMPLETED',
				content,
				promptHash: simpleHash(prompt)
			}
		});

		return insight.id;
	} catch (error: unknown) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		console.error(`[insight:error] Failed to generate ${type} insight`, {
			insightId: insight.id,
			error: errMsg
		});

		await prisma.insight.update({
			where: { id: insight.id },
			data: {
				status: 'FAILED',
				metadata: { error: errMsg }
			}
		});

		return null;
	}
}

async function createAndGenerateInsightStreaming(
	userId: string,
	journeyId: string | null,
	weekNumber: number | null,
	type: InsightType,
	promptBuilder: () => Promise<string>,
	maxTokens: number = 1024
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	const insight = await prisma.insight.create({
		data: {
			userId,
			journeyId,
			weekNumber,
			type,
			status: 'PENDING',
			modelId: MODEL_ID
		}
	});

	try {
		await prisma.insight.update({
			where: { id: insight.id },
			data: { status: 'GENERATING' }
		});

		const prompt = await promptBuilder();
		const rawStream = callClaudeStreaming(prompt, maxTokens);
		let accumulated = '';

		let cancelled = false;
		const wrappedStream = new ReadableStream<string>({
			async start(controller) {
				const reader = rawStream.getReader();
				try {
					while (true) {
						if (cancelled) break;
						const { done, value } = await reader.read();
						if (done) break;
						accumulated += value;
						controller.enqueue(value);
					}

					await prisma.insight.update({
						where: { id: insight.id },
						data: {
							status: 'COMPLETED',
							content: accumulated,
							promptHash: simpleHash(prompt)
						}
					});
					controller.close();
				} catch (error) {
					await prisma.insight.update({
						where: { id: insight.id },
						data: {
							status: 'FAILED',
							metadata: { error: error instanceof Error ? error.message : 'Unknown error' }
						}
					});
					controller.error(error);
				}
			},
			cancel() {
				cancelled = true;
				// Save whatever we accumulated so far
				if (accumulated) {
					prisma.insight
						.update({
							where: { id: insight.id },
							data: {
								status: 'COMPLETED',
								content: accumulated,
								promptHash: simpleHash(prompt)
							}
						})
						.catch(() => {
							// Last resort: mark as failed if save fails
							prisma.insight
								.update({
									where: { id: insight.id },
									data: {
										status: 'FAILED',
										metadata: { error: 'Client disconnected, save failed' }
									}
								})
								.catch(() => {});
						});
				} else {
					prisma.insight
						.update({
							where: { id: insight.id },
							data: {
								status: 'FAILED',
								metadata: { error: 'Client disconnected before content received' }
							}
						})
						.catch(() => {});
				}
			}
		});

		return { insightId: insight.id, stream: wrappedStream };
	} catch (error: unknown) {
		const errMsg = error instanceof Error ? error.message : 'Unknown error';
		console.error(`[insight:error] Failed to start streaming ${type}`, {
			insightId: insight.id,
			error: errMsg
		});
		await prisma.insight.update({
			where: { id: insight.id },
			data: { status: 'FAILED', metadata: { error: errMsg } }
		});
		return null;
	}
}

function simpleHash(str: string): string {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		const char = str.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash |= 0;
	}
	return hash.toString(36);
}

// Helper to fetch the Week 1 identity anchor (notes from earliest check-in)
async function getIdentityAnchor(
	journeyId: string,
	userId: string,
	journeyStart: Date,
	timeZone?: string | null
): Promise<string | null> {
	const earliest = await prisma.checkIn.findFirst({
		where: { journeyId, userId, notes: { not: null } },
		select: { notes: true, submittedAt: true },
		orderBy: { submittedAt: 'asc' }
	});
	if (!earliest || weekNumberForDate(journeyStart, earliest.submittedAt, timeZone) !== 1)
		return null;
	return earliest.notes?.trim() || null;
}

const inWeekWindow = (weekNumber: number, from: number, to: number) =>
	weekNumber >= from && weekNumber <= to;

// Helper to get weekly averages from checkIns
function getWeeklyAverages(
	checkIns: Array<{
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	}>
): Array<{ weekNumber: number; effort: number | null; performance: number | null }> {
	const weekMap = new Map<number, { efforts: number[]; performances: number[] }>();

	for (const r of checkIns) {
		if (!weekMap.has(r.weekNumber)) {
			weekMap.set(r.weekNumber, { efforts: [], performances: [] });
		}
		const w = weekMap.get(r.weekNumber)!;
		if (r.effortScore !== null) w.efforts.push(r.effortScore);
		if (r.performanceScore !== null) w.performances.push(r.performanceScore);
	}

	return Array.from(weekMap.entries())
		.map(([weekNumber, data]) => ({
			weekNumber,
			effort:
				data.efforts.length > 0
					? Number((data.efforts.reduce((a, b) => a + b, 0) / data.efforts.length).toFixed(1))
					: null,
			performance:
				data.performances.length > 0
					? Number(
							(data.performances.reduce((a, b) => a + b, 0) / data.performances.length).toFixed(1)
						)
					: null
		}))
		.sort((a, b) => a.weekNumber - b.weekNumber);
}

/**
 * Generate a CHECK_IN insight after a check-in submission.
 */
export async function generateCheckInInsight(
	userId: string,
	journeyId: string,
	weekNumber: number
): Promise<string | null> {
	return createAndGenerateInsight(userId, journeyId, weekNumber, 'CHECK_IN', async () => {
		const journey = await prisma.journey.findUnique({
			where: { id: journeyId },
			include: {
				goal: {
					include: { focusAreas: { where: { active: true } } }
				},
				user: { select: { timezone: true } },
				checkIns: {
					where: { userId },
					select: {
						submittedAt: true,
						effortScore: true,
						performanceScore: true
					}
				}
			}
		});

		if (!journey) throw new Error('Journey not found');

		const checkIns = withCheckInWeeks(
			journey.startDate,
			journey.checkIns,
			journey.user.timezone
		).filter((c) => inWeekWindow(c.weekNumber, Math.max(1, weekNumber - 3), weekNumber));
		const weeklyAverages = getWeeklyAverages(checkIns);
		const thisWeek = weeklyAverages.find((w) => w.weekNumber === weekNumber);
		const last3 = weeklyAverages.filter((w) => w.weekNumber < weekNumber).slice(-3);

		const feedback = await prisma.feedback.findMany({
			where: { journeyId, weekNumber },
			include: {
				reviewer: { select: { name: true } }
			}
		});

		const context: CheckInContext = {
			goalTitle: journey.goal.title,
			focusAreas: journey.goal.focusAreas.map((s) => s.label),
			currentWeek: weekNumber,
			thisWeekScores: {
				effort: thisWeek?.effort ?? null,
				performance: thisWeek?.performance ?? null
			},
			last3Weeks: last3,
			reviewerFeedback: feedback.map((f) => ({
				weekNumber,
				reviewerName: f.reviewer.name,
				effort: f.effortScore,
				performance: f.performanceScore,
				behavioralObservation: f.behavioralObservation,
				suggestion: f.suggestion
			})),
			weeklyPromptTopic: `Week ${weekNumber}`
		};

		return buildCheckInPrompt(context);
	});
}

/**
 * Generate a WEEKLY_SYNTHESIS insight for end-of-week.
 */
async function buildWeeklySynthesisContext(
	userId: string,
	journeyId: string,
	weekNumber: number
): Promise<string> {
	const journey = await prisma.journey.findUnique({
		where: { id: journeyId },
		include: {
			goal: {
				include: { focusAreas: { where: { active: true } } }
			},
			checkIns: {
				where: { userId },
				orderBy: { submittedAt: 'asc' },
				select: {
					submittedAt: true,
					effortScore: true,
					performanceScore: true,
					notes: true
				}
			},
			coachNotes: {
				where: { weekNumber },
				select: { content: true }
			},
			user: { select: { timezone: true } }
		}
	});

	if (!journey) throw new Error('Journey not found');

	const checkIns = withCheckInWeeks(
		journey.startDate,
		journey.checkIns,
		journey.user.timezone
	).filter((c) => inWeekWindow(c.weekNumber, Math.max(1, weekNumber - 3), weekNumber));
	const identityAnchor = await getIdentityAnchor(
		journeyId,
		userId,
		journey.startDate,
		journey.user.timezone
	);

	const thisWeekCheckIns = checkIns
		.filter((c) => c.weekNumber === weekNumber)
		.map((c) => ({
			label: `Check-in ${c.submittedAt.toISOString().slice(0, 10)}`,
			effort: c.effortScore,
			performance: c.performanceScore,
			notes: c.notes
		}));

	const weeklyAverages = getWeeklyAverages(checkIns);
	const last3 = weeklyAverages.filter((w) => w.weekNumber < weekNumber).slice(-3);

	const feedback = await prisma.feedback.findMany({
		where: { journeyId, weekNumber },
		include: {
			reviewer: { select: { name: true } }
		}
	});

	const context: WeeklySynthesisContext = {
		goalTitle: journey.goal.title,
		focusAreas: journey.goal.focusAreas.map((s) => s.label),
		currentWeek: weekNumber,
		identityAnchor,
		thisWeekCheckIns,
		last3Weeks: last3,
		reviewerFeedback: feedback.map((f) => ({
			weekNumber: f.weekNumber,
			reviewerName: f.reviewer.name,
			effort: f.effortScore,
			performance: f.performanceScore,
			behavioralObservation: f.behavioralObservation,
			suggestion: f.suggestion
		})),
		coachNotes: journey.coachNotes.map((n) => n.content)
	};

	return buildWeeklySynthesisPrompt(context);
}

export async function generateWeeklySynthesis(
	userId: string,
	journeyId: string,
	weekNumber: number
): Promise<string | null> {
	return createAndGenerateInsight(userId, journeyId, weekNumber, 'WEEKLY_SYNTHESIS', () =>
		buildWeeklySynthesisContext(userId, journeyId, weekNumber)
	);
}

/**
 * Streaming variant of weekly synthesis — returns SSE-compatible stream.
 */
export async function generateWeeklySynthesisStreaming(
	userId: string,
	journeyId: string,
	weekNumber: number
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	return createAndGenerateInsightStreaming(userId, journeyId, weekNumber, 'WEEKLY_SYNTHESIS', () =>
		buildWeeklySynthesisContext(userId, journeyId, weekNumber)
	);
}

/**
 * Generate a COACH_PREP insight for a specific client.
 */
async function buildCoachPrepContext(
	coachId: string,
	individualId: string,
	journeyId: string
): Promise<string> {
	const individual = await prisma.user.findUnique({
		where: { id: individualId },
		select: { name: true, email: true, timezone: true }
	});

	const journey = await prisma.journey.findUnique({
		where: { id: journeyId },
		include: {
			goal: { select: { title: true } },
			feedback: {
				orderBy: { submittedAt: 'desc' },
				take: 40,
				include: { reviewer: { select: { name: true } } }
			},
			checkIns: {
				where: { userId: individualId },
				orderBy: { submittedAt: 'desc' },
				take: 30,
				select: {
					submittedAt: true,
					effortScore: true,
					performanceScore: true
				}
			},
			coachNotes: {
				where: { coachId },
				orderBy: { createdAt: 'desc' },
				take: 5,
				select: { content: true }
			}
		}
	});

	if (!journey || !individual) throw new Error('Data not found');

	const currentWeek = currentWeekNumber(journey.startDate, new Date(), individual?.timezone);
	const weeklyAverages = getWeeklyAverages(
		withCheckInWeeks(journey.startDate, journey.checkIns, individual?.timezone)
	);
	const last4 = weeklyAverages.slice(-4);

	// Calculate stability
	const effortValues = last4.map((w) => w.effort).filter((v): v is number => v !== null);
	const perfValues = last4.map((w) => w.performance).filter((v): v is number => v !== null);
	const efStd = stdDev(effortValues);
	const prStd = stdDev(perfValues);
	const stds = [efStd, prStd].filter((v): v is number => v !== null);
	const combinedStd = stds.length > 0 ? stds.reduce((a, b) => a + b, 0) / stds.length : null;
	const stabilityScore =
		combinedStd !== null ? Math.max(0, Math.round(100 - combinedStd * 10)) : null;

	// Build reviewer feedback and gap data
	const allReviewerFeedback: Array<{
		weekNumber: number;
		reviewerName: string;
		effort: number | null;
		performance: number | null;
	}> = [];

	const reviewerByWeek = new Map<number, { effort: number[]; perf: number[] }>();

	for (const fb of journey.feedback) {
		const wk = fb.weekNumber;
		allReviewerFeedback.push({
			weekNumber: wk,
			reviewerName: fb.reviewer.name,
			effort: fb.effortScore,
			performance: fb.performanceScore
		});

		const bucket = reviewerByWeek.get(wk) ?? { effort: [], perf: [] };
		if (fb.effortScore !== null) bucket.effort.push(fb.effortScore);
		if (fb.performanceScore !== null) bucket.perf.push(fb.performanceScore);
		reviewerByWeek.set(wk, bucket);
	}

	const mean = (xs: number[]) => (xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

	const reviewerGapTrend = Array.from(reviewerByWeek.entries())
		.filter(([wk]) => wk >= currentWeek - 4)
		.flatMap(([weekNumber, g]) => {
			const self = weeklyAverages.find((w) => w.weekNumber === weekNumber);
			const shE = mean(g.effort);
			const shP = mean(g.perf);
			if (!self || self.effort === null || self.performance === null) return [];
			if (shE === null || shP === null) return [];
			return [
				{
					weekNumber,
					effortGap: Number((self.effort - shE).toFixed(1)),
					performanceGap: Number((self.performance - shP).toFixed(1))
				}
			];
		})
		.sort((a, b) => a.weekNumber - b.weekNumber);

	// Build alerts
	const alerts: string[] = [];
	if (stabilityScore !== null && stabilityScore < 50) {
		alerts.push(`Low stability score: ${stabilityScore}/100`);
	}
	const lastWeekAvg = last4[last4.length - 1];
	if (lastWeekAvg && lastWeekAvg.effort !== null && lastWeekAvg.performance !== null) {
		const gap = lastWeekAvg.effort - lastWeekAvg.performance;
		if (gap > 2) {
			alerts.push(
				`Significant effort-performance gap: ${gap.toFixed(1)} points (effort ${lastWeekAvg.effort}, performance ${lastWeekAvg.performance})`
			);
		}
	}

	const context: CoachPrepContext = {
		individualName: individual.name ?? individual.email,
		goalTitle: journey.goal.title,
		last4Weeks: last4,
		reviewerFeedback: allReviewerFeedback
			.filter((f) => f.weekNumber >= currentWeek - 4)
			.slice(0, 20),
		reviewerGapTrend,
		stabilityScore,
		coachNotes: journey.coachNotes.map((n) => n.content),
		alerts
	};

	return buildCoachPrepPrompt(context);
}

export async function generateCoachPrep(
	coachId: string,
	individualId: string,
	journeyId: string
): Promise<string | null> {
	return createAndGenerateInsight(individualId, journeyId, null, 'COACH_PREP', () =>
		buildCoachPrepContext(coachId, individualId, journeyId)
	);
}

/**
 * Streaming variant of coach prep — returns SSE-compatible stream.
 */
export async function generateCoachPrepStreaming(
	coachId: string,
	individualId: string,
	journeyId: string
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	return createAndGenerateInsightStreaming(individualId, journeyId, null, 'COACH_PREP', () =>
		buildCoachPrepContext(coachId, individualId, journeyId)
	);
}

/**
 * Generate a JOURNEY_REPORT insight — comprehensive full-journey analysis.
 */
async function buildCycleReportContext(userId: string, journeyId: string): Promise<string> {
	const journey = await prisma.journey.findUnique({
		where: { id: journeyId },
		include: {
			goal: {
				include: {
					focusAreas: { where: { active: true } },
					reviewers: { select: { id: true } }
				}
			},
			feedback: {
				orderBy: { submittedAt: 'desc' },
				include: { reviewer: { select: { name: true } } }
			},
			checkIns: {
				where: { userId },
				orderBy: { submittedAt: 'asc' },
				select: {
					submittedAt: true,
					effortScore: true,
					performanceScore: true,
					notes: true
				}
			},
			coachNotes: {
				orderBy: { createdAt: 'desc' },
				take: 10,
				select: { content: true }
			},
			user: { select: { timezone: true } }
		}
	});

	if (!journey) throw new Error('Journey not found');

	const identityAnchor = await getIdentityAnchor(
		journeyId,
		userId,
		journey.startDate,
		journey.user.timezone
	);
	const currentWeek = currentWeekNumber(journey.startDate, new Date(), journey.user.timezone);
	const totalWeeks = journey.endDate
		? Math.max(
				1,
				Math.ceil(
					(journey.endDate.getTime() - journey.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000)
				)
			)
		: journey.lengthWeeks;

	const checkIns = withCheckInWeeks(journey.startDate, journey.checkIns, journey.user.timezone);
	const weeklyAverages = getWeeklyAverages(checkIns);

	const effortValues = weeklyAverages.map((w) => w.effort).filter((v): v is number => v !== null);
	const perfValues = weeklyAverages
		.map((w) => w.performance)
		.filter((v): v is number => v !== null);
	const efStd = stdDev(effortValues);
	const prStd = stdDev(perfValues);
	const stds = [efStd, prStd].filter((v): v is number => v !== null);
	const combinedStd = stds.length > 0 ? stds.reduce((a, b) => a + b, 0) / stds.length : null;
	const stabilityScore =
		combinedStd !== null ? Math.max(0, Math.round(100 - combinedStd * 10)) : null;

	let trajectoryScore: number | null = null;
	if (weeklyAverages.length >= 2) {
		const points: { x: number; y: number }[] = [];
		for (const w of weeklyAverages) {
			const vals = [w.effort, w.performance].filter((v): v is number => v !== null);
			if (vals.length > 0) {
				points.push({ x: w.weekNumber, y: vals.reduce((a, b) => a + b, 0) / vals.length });
			}
		}
		if (points.length >= 2) {
			const n = points.length;
			const sumX = points.reduce((s, p) => s + p.x, 0);
			const sumY = points.reduce((s, p) => s + p.y, 0);
			const sumXY = points.reduce((s, p) => s + p.x * p.y, 0);
			const sumX2 = points.reduce((s, p) => s + p.x * p.x, 0);
			const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
			trajectoryScore = Math.max(-100, Math.min(100, Math.round(slope * 25)));
		}
	}

	const checkInWeeks = new Set(checkIns.map((c) => c.weekNumber));
	const completionRate =
		totalWeeks > 0
			? Math.round((checkInWeeks.size / Math.min(currentWeek, totalWeeks)) * 100)
			: null;

	const allReviewerFeedback: Array<{
		weekNumber: number;
		reviewerName: string;
		effort: number | null;
		performance: number | null;
	}> = [];

	const gapByReviewer = new Map<
		string,
		Array<{ weekNumber: number; effortGap: number | null; performanceGap: number | null }>
	>();

	for (const fb of journey.feedback) {
		const wk = fb.weekNumber;

		allReviewerFeedback.push({
			weekNumber: wk,
			reviewerName: fb.reviewer.name,
			effort: fb.effortScore,
			performance: fb.performanceScore
		});

		const name = fb.reviewer.name;
		if (!gapByReviewer.has(name)) {
			gapByReviewer.set(name, []);
		}

		const selfWeek = weeklyAverages.find((w) => w.weekNumber === wk);
		const effortGap =
			selfWeek?.effort !== null && selfWeek?.effort !== undefined && fb.effortScore !== null
				? Number((selfWeek.effort - fb.effortScore).toFixed(1))
				: null;
		const performanceGap =
			selfWeek?.performance !== null &&
			selfWeek?.performance !== undefined &&
			fb.performanceScore !== null
				? Number((selfWeek.performance - fb.performanceScore).toFixed(1))
				: null;

		gapByReviewer.get(name)!.push({ weekNumber: wk, effortGap, performanceGap });
	}

	const perceptionGaps: CycleReportContext['perceptionGaps'] = [];
	gapByReviewer.forEach((gaps, reviewerName) => {
		const sorted = gaps.sort((a, b) => a.weekNumber - b.weekNumber);
		const latest = sorted[sorted.length - 1];

		const computeTrend = (
			getter: (g: (typeof gaps)[0]) => number | null
		): 'widening' | 'closing' | 'stable' | null => {
			const vals = sorted.map(getter).filter((v): v is number => v !== null);
			if (vals.length < 2) return null;
			const absFirst = Math.abs(vals[0]);
			const absLast = Math.abs(vals[vals.length - 1]);
			if (absLast - absFirst > 0.5) return 'widening';
			if (absFirst - absLast > 0.5) return 'closing';
			return 'stable';
		};

		perceptionGaps.push({
			reviewerName,
			latestEffortGap: latest?.effortGap ?? null,
			latestPerformanceGap: latest?.performanceGap ?? null,
			effortGapTrend: computeTrend((g) => g.effortGap),
			performanceGapTrend: computeTrend((g) => g.performanceGap)
		});
	});

	const respondedThisWeek = new Set(
		journey.feedback.filter((fb) => fb.weekNumber === currentWeek).map((fb) => fb.reviewerId)
	).size;
	const alignmentRatio =
		journey.goal.reviewers.length > 0
			? Math.round((respondedThisWeek / journey.goal.reviewers.length) * 100)
			: null;

	const context: CycleReportContext = {
		goalTitle: journey.goal.title,
		focusAreas: journey.goal.focusAreas.map((s) => s.label),
		cycleStartDate: journey.startDate.toISOString().split('T')[0],
		currentWeek,
		totalWeeks,
		identityAnchor,
		weeklyScores: weeklyAverages,
		reviewerFeedback: allReviewerFeedback,
		perceptionGaps,
		stabilityScore,
		trajectoryScore,
		completionRate,
		alignmentRatio,
		coachNotes: journey.coachNotes.map((n) => n.content)
	};

	return buildCycleReportPrompt(context);
}

export async function generateCycleReport(
	userId: string,
	journeyId: string
): Promise<string | null> {
	return createAndGenerateInsight(
		userId,
		journeyId,
		null,
		'JOURNEY_REPORT',
		async () => {
			return buildCycleReportContext(userId, journeyId);
		},
		4096
	);
}
