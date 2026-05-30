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
import { computeWeekNumber, stdDev } from '$lib/server/coachUtils';
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
	cycleId: string
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	// Create PENDING insight record
	const insight = await prisma.insight.create({
		data: {
			userId,
			cycleId,
			weekNumber: null,
			type: 'CYCLE_REPORT',
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
		const prompt = await buildCycleReportContext(userId, cycleId);

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
		console.error('[insight:error] Failed to start streaming CYCLE_REPORT', {
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
	cycleId: string | null,
	weekNumber: number | null,
	type: InsightType,
	promptBuilder: () => Promise<string>,
	maxTokens: number = 1024
): Promise<string | null> {
	const insight = await prisma.insight.create({
		data: {
			userId,
			cycleId,
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
	cycleId: string | null,
	weekNumber: number | null,
	type: InsightType,
	promptBuilder: () => Promise<string>,
	maxTokens: number = 1024
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	const insight = await prisma.insight.create({
		data: {
			userId,
			cycleId,
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
async function getIdentityAnchor(cycleId: string, userId: string): Promise<string | null> {
	const week1 = await prisma.reflection.findFirst({
		where: {
			cycleId,
			userId,
			weekNumber: 1,
			notes: { not: null }
		},
		select: { notes: true },
		orderBy: { submittedAt: 'asc' }
	});
	return week1?.notes?.trim() || null;
}

// Helper to get weekly averages from reflections
function getWeeklyAverages(
	reflections: Array<{
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	}>
): Array<{ weekNumber: number; effort: number | null; performance: number | null }> {
	const weekMap = new Map<number, { efforts: number[]; performances: number[] }>();

	for (const r of reflections) {
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
 * Generate a CHECK_IN insight after a reflection submission.
 */
export async function generateCheckInInsight(
	userId: string,
	cycleId: string,
	weekNumber: number
): Promise<string | null> {
	return createAndGenerateInsight(userId, cycleId, weekNumber, 'CHECK_IN', async () => {
		const cycle = await prisma.cycle.findUnique({
			where: { id: cycleId },
			include: {
				objective: {
					include: { subgoals: { where: { active: true } } }
				},
				reflections: {
					where: {
						userId,
						weekNumber: { lte: weekNumber, gte: Math.max(1, weekNumber - 3) }
					},
					select: {
						weekNumber: true,
						reflectionType: true,
						effortScore: true,
						performanceScore: true
					}
				}
			}
		});

		if (!cycle) throw new Error('Cycle not found');

		const weeklyAverages = getWeeklyAverages(cycle.reflections);
		const thisWeek = weeklyAverages.find((w) => w.weekNumber === weekNumber);
		const last3 = weeklyAverages.filter((w) => w.weekNumber < weekNumber).slice(-3);

		// Get stakeholder feedback for this week
		const feedback = await prisma.feedback.findMany({
			where: {
				reflection: { cycleId, weekNumber }
			},
			include: {
				stakeholder: { select: { name: true } }
			}
		});

		const context: CheckInContext = {
			objectiveTitle: cycle.objective.title,
			subgoals: cycle.objective.subgoals.map((s) => s.label),
			currentWeek: weekNumber,
			thisWeekScores: {
				effort: thisWeek?.effort ?? null,
				performance: thisWeek?.performance ?? null
			},
			last3Weeks: last3,
			stakeholderFeedback: feedback.map((f) => ({
				weekNumber,
				stakeholderName: f.stakeholder.name,
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
	cycleId: string,
	weekNumber: number
): Promise<string> {
	const cycle = await prisma.cycle.findUnique({
		where: { id: cycleId },
		include: {
			objective: {
				include: { subgoals: { where: { active: true } } }
			},
			reflections: {
				where: {
					userId,
					weekNumber: { lte: weekNumber, gte: Math.max(1, weekNumber - 3) }
				},
				select: {
					weekNumber: true,
					reflectionType: true,
					effortScore: true,
					performanceScore: true,
					notes: true
				}
			},
			coachNotes: {
				where: { weekNumber },
				select: { content: true }
			}
		}
	});

	if (!cycle) throw new Error('Cycle not found');

	const [thisWeekReflectionsRaw, identityAnchor] = await Promise.all([
		Promise.resolve(cycle.reflections.filter((r) => r.weekNumber === weekNumber)),
		getIdentityAnchor(cycleId, userId)
	]);

	const thisWeekReflections = thisWeekReflectionsRaw.map((r) => ({
		type: r.reflectionType,
		effort: r.effortScore,
		performance: r.performanceScore,
		notes: r.notes
	}));

	const weeklyAverages = getWeeklyAverages(cycle.reflections);
	const last3 = weeklyAverages.filter((w) => w.weekNumber < weekNumber).slice(-3);

	const feedback = await prisma.feedback.findMany({
		where: {
			reflection: {
				cycleId,
				weekNumber: { lte: weekNumber, gte: Math.max(1, weekNumber - 3) }
			}
		},
		include: {
			stakeholder: { select: { name: true } },
			reflection: { select: { weekNumber: true } }
		}
	});

	const context: WeeklySynthesisContext = {
		objectiveTitle: cycle.objective.title,
		subgoals: cycle.objective.subgoals.map((s) => s.label),
		currentWeek: weekNumber,
		identityAnchor,
		thisWeekReflections,
		last3Weeks: last3,
		stakeholderFeedback: feedback
			.filter((f) => f.reflection.weekNumber === weekNumber)
			.map((f) => ({
				weekNumber: f.reflection.weekNumber,
				stakeholderName: f.stakeholder.name,
				effort: f.effortScore,
				performance: f.performanceScore,
				behavioralObservation: f.behavioralObservation,
				suggestion: f.suggestion
			})),
		coachNotes: cycle.coachNotes.map((n) => n.content)
	};

	return buildWeeklySynthesisPrompt(context);
}

export async function generateWeeklySynthesis(
	userId: string,
	cycleId: string,
	weekNumber: number
): Promise<string | null> {
	return createAndGenerateInsight(userId, cycleId, weekNumber, 'WEEKLY_SYNTHESIS', () =>
		buildWeeklySynthesisContext(userId, cycleId, weekNumber)
	);
}

/**
 * Streaming variant of weekly synthesis — returns SSE-compatible stream.
 */
export async function generateWeeklySynthesisStreaming(
	userId: string,
	cycleId: string,
	weekNumber: number
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	return createAndGenerateInsightStreaming(userId, cycleId, weekNumber, 'WEEKLY_SYNTHESIS', () =>
		buildWeeklySynthesisContext(userId, cycleId, weekNumber)
	);
}

/**
 * Generate a COACH_PREP insight for a specific client.
 */
async function buildCoachPrepContext(
	coachId: string,
	individualId: string,
	cycleId: string
): Promise<string> {
	const individual = await prisma.user.findUnique({
		where: { id: individualId },
		select: { name: true, email: true }
	});

	const cycle = await prisma.cycle.findUnique({
		where: { id: cycleId },
		include: {
			objective: {
				include: {
					subgoals: { where: { active: true } },
					stakeholders: {
						include: {
							feedbacks: {
								orderBy: { submittedAt: 'desc' },
								take: 20,
								include: {
									stakeholder: { select: { name: true } },
									reflection: {
										select: {
											weekNumber: true,
											effortScore: true,
											performanceScore: true
										}
									}
								}
							}
						}
					}
				}
			},
			reflections: {
				where: { userId: individualId },
				orderBy: { weekNumber: 'desc' },
				take: 30,
				select: {
					weekNumber: true,
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

	if (!cycle || !individual) throw new Error('Data not found');

	const currentWeek = computeWeekNumber(cycle.startDate);
	const weeklyAverages = getWeeklyAverages(cycle.reflections);
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

	// Build stakeholder feedback and gap data
	const allStakeholderFeedback: Array<{
		weekNumber: number;
		stakeholderName: string;
		effort: number | null;
		performance: number | null;
	}> = [];

	const gapByWeek = new Map<
		number,
		{ selfEffort: number[]; selfPerf: number[]; shEffort: number[]; shPerf: number[] }
	>();

	cycle.objective.stakeholders.forEach((sh) => {
		sh.feedbacks.forEach((fb) => {
			if (!fb.reflection) return;
			const wk = fb.reflection.weekNumber;

			allStakeholderFeedback.push({
				weekNumber: wk,
				stakeholderName: fb.stakeholder.name,
				effort: fb.effortScore,
				performance: fb.performanceScore
			});

			if (!gapByWeek.has(wk)) {
				gapByWeek.set(wk, {
					selfEffort: [],
					selfPerf: [],
					shEffort: [],
					shPerf: []
				});
			}
			const g = gapByWeek.get(wk)!;
			if (fb.effortScore !== null) g.shEffort.push(fb.effortScore);
			if (fb.performanceScore !== null) g.shPerf.push(fb.performanceScore);
			if (fb.reflection.effortScore !== null) g.selfEffort.push(fb.reflection.effortScore);
			if (fb.reflection.performanceScore !== null) g.selfPerf.push(fb.reflection.performanceScore);
		});
	});

	const stakeholderGapTrend = Array.from(gapByWeek.entries())
		.filter(([wk]) => wk >= currentWeek - 4)
		.map(([weekNumber, g]) => {
			const selfE =
				g.selfEffort.length > 0 ? g.selfEffort.reduce((a, b) => a + b, 0) / g.selfEffort.length : 0;
			const shE =
				g.shEffort.length > 0 ? g.shEffort.reduce((a, b) => a + b, 0) / g.shEffort.length : 0;
			const selfP =
				g.selfPerf.length > 0 ? g.selfPerf.reduce((a, b) => a + b, 0) / g.selfPerf.length : 0;
			const shP = g.shPerf.length > 0 ? g.shPerf.reduce((a, b) => a + b, 0) / g.shPerf.length : 0;
			return {
				weekNumber,
				effortGap: Number((selfE - shE).toFixed(1)),
				performanceGap: Number((selfP - shP).toFixed(1))
			};
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
		objectiveTitle: cycle.objective.title,
		last4Weeks: last4,
		stakeholderFeedback: allStakeholderFeedback
			.filter((f) => f.weekNumber >= currentWeek - 4)
			.slice(0, 20),
		stakeholderGapTrend,
		stabilityScore,
		coachNotes: cycle.coachNotes.map((n) => n.content),
		alerts
	};

	return buildCoachPrepPrompt(context);
}

export async function generateCoachPrep(
	coachId: string,
	individualId: string,
	cycleId: string
): Promise<string | null> {
	return createAndGenerateInsight(individualId, cycleId, null, 'COACH_PREP', () =>
		buildCoachPrepContext(coachId, individualId, cycleId)
	);
}

/**
 * Streaming variant of coach prep — returns SSE-compatible stream.
 */
export async function generateCoachPrepStreaming(
	coachId: string,
	individualId: string,
	cycleId: string
): Promise<{ insightId: string; stream: ReadableStream<string> } | null> {
	return createAndGenerateInsightStreaming(individualId, cycleId, null, 'COACH_PREP', () =>
		buildCoachPrepContext(coachId, individualId, cycleId)
	);
}

/**
 * Generate a CYCLE_REPORT insight — comprehensive full-cycle analysis.
 */
async function buildCycleReportContext(userId: string, cycleId: string): Promise<string> {
	const cycle = await prisma.cycle.findUnique({
		where: { id: cycleId },
		include: {
			objective: {
				include: {
					subgoals: { where: { active: true } },
					stakeholders: {
						include: {
							feedbacks: {
								orderBy: { submittedAt: 'desc' },
								include: {
									stakeholder: { select: { name: true } },
									reflection: {
										select: {
											weekNumber: true,
											effortScore: true,
											performanceScore: true
										}
									}
								}
							}
						}
					}
				}
			},
			reflections: {
				where: { userId },
				orderBy: { weekNumber: 'asc' },
				select: {
					weekNumber: true,
					reflectionType: true,
					effortScore: true,
					performanceScore: true,
					notes: true
				}
			},
			coachNotes: {
				orderBy: { createdAt: 'desc' },
				take: 10,
				select: { content: true }
			}
		}
	});

	if (!cycle) throw new Error('Cycle not found');

	const identityAnchor = await getIdentityAnchor(cycleId, userId);
	const currentWeek = computeWeekNumber(cycle.startDate);
	const totalWeeks = cycle.endDate
		? Math.max(
				1,
				Math.ceil((cycle.endDate.getTime() - cycle.startDate.getTime()) / (7 * 24 * 60 * 60 * 1000))
			)
		: currentWeek;

	const weeklyAverages = getWeeklyAverages(cycle.reflections);

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

	const ratingWeeks = new Set(
		cycle.reflections
			.filter((r) => r.reflectionType === 'RATING_A' || r.reflectionType === 'RATING_B')
			.map((r) => r.weekNumber)
	);
	const completionRate =
		totalWeeks > 0
			? Math.round((ratingWeeks.size / Math.min(currentWeek, totalWeeks)) * 100)
			: null;

	const allStakeholderFeedback: Array<{
		weekNumber: number;
		stakeholderName: string;
		effort: number | null;
		performance: number | null;
	}> = [];

	const gapByStakeholder = new Map<
		string,
		Array<{ weekNumber: number; effortGap: number | null; performanceGap: number | null }>
	>();

	cycle.objective.stakeholders.forEach((sh) => {
		sh.feedbacks.forEach((fb) => {
			if (!fb.reflection) return;
			const wk = fb.reflection.weekNumber;

			allStakeholderFeedback.push({
				weekNumber: wk,
				stakeholderName: fb.stakeholder.name,
				effort: fb.effortScore,
				performance: fb.performanceScore
			});

			const name = fb.stakeholder.name;
			if (!gapByStakeholder.has(name)) {
				gapByStakeholder.set(name, []);
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

			gapByStakeholder.get(name)!.push({ weekNumber: wk, effortGap, performanceGap });
		});
	});

	const perceptionGaps: CycleReportContext['perceptionGaps'] = [];
	gapByStakeholder.forEach((gaps, stakeholderName) => {
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
			stakeholderName,
			latestEffortGap: latest?.effortGap ?? null,
			latestPerformanceGap: latest?.performanceGap ?? null,
			effortGapTrend: computeTrend((g) => g.effortGap),
			performanceGapTrend: computeTrend((g) => g.performanceGap)
		});
	});

	let respondedThisWeek = 0;
	cycle.objective.stakeholders.forEach((sh) => {
		const hasThisWeek = sh.feedbacks.some(
			(fb) => fb.reflection && fb.reflection.weekNumber === currentWeek
		);
		if (hasThisWeek) respondedThisWeek++;
	});
	const alignmentRatio =
		cycle.objective.stakeholders.length > 0
			? Math.round((respondedThisWeek / cycle.objective.stakeholders.length) * 100)
			: null;

	const context: CycleReportContext = {
		objectiveTitle: cycle.objective.title,
		subgoals: cycle.objective.subgoals.map((s) => s.label),
		cycleStartDate: cycle.startDate.toISOString().split('T')[0],
		currentWeek,
		totalWeeks,
		identityAnchor,
		weeklyScores: weeklyAverages,
		stakeholderFeedback: allStakeholderFeedback,
		perceptionGaps,
		stabilityScore,
		trajectoryScore,
		completionRate,
		alignmentRatio,
		coachNotes: cycle.coachNotes.map((n) => n.content)
	};

	return buildCycleReportPrompt(context);
}

export async function generateCycleReport(userId: string, cycleId: string): Promise<string | null> {
	return createAndGenerateInsight(
		userId,
		cycleId,
		null,
		'CYCLE_REPORT',
		async () => {
			return buildCycleReportContext(userId, cycleId);
		},
		4096
	);
}
