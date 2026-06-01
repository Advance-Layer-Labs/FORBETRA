import { redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const objective = await prisma.objective.findFirst({
		where: { userId: dbUser.id, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			stakeholders: {
				orderBy: { createdAt: 'asc' },
				select: { id: true, name: true }
			},
			cycles: {
				orderBy: { startDate: 'desc' },
				take: 2,
				include: {
					reflections: {
						select: {
							id: true,
							reflectionType: true,
							weekNumber: true,
							submittedAt: true,
							effortScore: true,
							performanceScore: true,
							notes: true
						}
					}
				}
			}
		}
	});

	if (!objective) {
		throw redirect(303, '/onboarding');
	}

	const cycle = objective.cycles[0] ?? null;
	const priorCycle = objective.cycles[1] ?? null;

	// Prior-cycle individual weekly averages (Item #10 of 9/10 plan).
	// Rendered as a dimmed dashed line in PerformanceEffortChart so the user
	// can see whether they're trending better than they did last time around.
	let priorIndividualData: Array<{
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	}> = [];
	if (priorCycle && priorCycle.reflections.length > 0) {
		const priorMap = new Map<number, { effortScores: number[]; performanceScores: number[] }>();
		for (const r of priorCycle.reflections) {
			if (r.reflectionType !== 'RATING_A' && r.reflectionType !== 'RATING_B') continue;
			const entry = priorMap.get(r.weekNumber) ?? { effortScores: [], performanceScores: [] };
			if (r.effortScore !== null) entry.effortScores.push(r.effortScore);
			if (r.performanceScore !== null) entry.performanceScores.push(r.performanceScore);
			priorMap.set(r.weekNumber, entry);
		}
		priorIndividualData = Array.from(priorMap.entries())
			.sort(([a], [b]) => a - b)
			.map(([weekNumber, scores]) => ({
				weekNumber,
				effortScore:
					scores.effortScores.length > 0
						? Number(
								(
									scores.effortScores.reduce((s, v) => s + v, 0) / scores.effortScores.length
								).toFixed(1)
							)
						: null,
				performanceScore:
					scores.performanceScores.length > 0
						? Number(
								(
									scores.performanceScores.reduce((s, v) => s + v, 0) /
									scores.performanceScores.length
								).toFixed(1)
							)
						: null
			}));
	}

	// --- 1. Latest cycle report (AI report) ---
	let cycleReport: {
		id: string;
		content: string | null;
		createdAt: Date;
		thumbs: number | null;
	} | null = null;

	if (cycle) {
		cycleReport = await prisma.insight.findFirst({
			where: { userId: dbUser.id, cycleId: cycle.id, status: 'COMPLETED', type: 'CYCLE_REPORT' },
			orderBy: { createdAt: 'desc' },
			select: { id: true, content: true, createdAt: true, thumbs: true }
		});
	}

	// --- 2. Visualization data (individual scores + stakeholder scores) ---
	const reflectionTrendMap = new Map<
		number,
		{ weekNumber: number; effortScores: number[]; performanceScores: number[] }
	>();

	if (cycle) {
		cycle.reflections.forEach((reflection) => {
			const weekEntry = reflectionTrendMap.get(reflection.weekNumber) ?? {
				weekNumber: reflection.weekNumber,
				effortScores: [],
				performanceScores: []
			};
			if (reflection.reflectionType === 'RATING_A' || reflection.reflectionType === 'RATING_B') {
				if (reflection.effortScore !== null) weekEntry.effortScores.push(reflection.effortScore);
				if (reflection.performanceScore !== null)
					weekEntry.performanceScores.push(reflection.performanceScore);
			}
			reflectionTrendMap.set(reflection.weekNumber, weekEntry);
		});
	}

	const individualWeeklyData = Array.from(reflectionTrendMap.values())
		.sort((a, b) => a.weekNumber - b.weekNumber)
		.map((week) => ({
			weekNumber: week.weekNumber,
			effortScore:
				week.effortScores.length > 0
					? Number(
							(week.effortScores.reduce((s, v) => s + v, 0) / week.effortScores.length).toFixed(1)
						)
					: null,
			performanceScore:
				week.performanceScores.length > 0
					? Number(
							(
								week.performanceScores.reduce((s, v) => s + v, 0) / week.performanceScores.length
							).toFixed(1)
						)
					: null
		}));

	const stakeholderWeeklyData: Array<{
		weekNumber: number;
		stakeholderId: string;
		stakeholderName: string;
		effortScore: number | null;
		performanceScore: number | null;
	}> = [];

	if (cycle) {
		const allFeedbacks = await prisma.feedback.findMany({
			where: { reflection: { cycleId: cycle.id } },
			include: {
				reflection: { select: { weekNumber: true } },
				stakeholder: { select: { id: true, name: true } }
			}
		});

		allFeedbacks.forEach((feedback) => {
			if (feedback.reflection) {
				stakeholderWeeklyData.push({
					weekNumber: feedback.reflection.weekNumber,
					stakeholderId: feedback.stakeholder.id,
					stakeholderName: feedback.stakeholder.name,
					effortScore: feedback.effortScore,
					performanceScore: feedback.performanceScore
				});
			}
		});
	}

	// --- 3. History: reflections grouped by week with feedback ---
	type HistoryReflection = {
		id: string;
		type: string;
		effortScore: number | null;
		performanceScore: number | null;
		notes: string | null;
		checkInDate: string;
		feedbacks: Array<{
			stakeholderName: string;
			effortScore: number | null;
			performanceScore: number | null;
			comment: string | null;
			behavioralObservation: string | null;
			suggestion: string | null;
		}>;
	};

	type HistoryWeek = {
		weekNumber: number;
		reflections: HistoryReflection[];
	};

	let weeks: HistoryWeek[] = [];

	if (cycle) {
		const reflections = await prisma.reflection.findMany({
			where: { cycleId: cycle.id, userId: objective.userId },
			orderBy: [{ weekNumber: 'desc' }, { checkInDate: 'desc' }],
			select: {
				id: true,
				reflectionType: true,
				weekNumber: true,
				effortScore: true,
				performanceScore: true,
				notes: true,
				checkInDate: true,
				feedbacks: {
					select: {
						id: true,
						effortScore: true,
						performanceScore: true,
						comment: true,
						behavioralObservation: true,
						suggestion: true,
						submittedAt: true,
						stakeholder: { select: { name: true } }
					}
				}
			}
		});

		const weekMap = new Map<number, HistoryReflection[]>();

		for (const r of reflections) {
			if (!weekMap.has(r.weekNumber)) weekMap.set(r.weekNumber, []);
			weekMap.get(r.weekNumber)!.push({
				id: r.id,
				type: r.reflectionType,
				effortScore: r.effortScore,
				performanceScore: r.performanceScore,
				notes: r.notes,
				checkInDate: r.checkInDate.toISOString(),
				feedbacks: r.feedbacks.map((f) => ({
					stakeholderName: f.stakeholder.name,
					effortScore: f.effortScore,
					performanceScore: f.performanceScore,
					comment: f.comment,
					behavioralObservation: f.behavioralObservation,
					suggestion: f.suggestion
				}))
			});
		}

		weeks = Array.from(weekMap.entries())
			.map(([weekNumber, reflections]) => ({ weekNumber, reflections }))
			.sort((a, b) => b.weekNumber - a.weekNumber);
	}

	return {
		objective: { id: objective.id, title: objective.title },
		cycleReport,
		visualizationData: {
			individual: individualWeeklyData,
			stakeholders: stakeholderWeeklyData,
			stakeholderList: objective.stakeholders.map((s) => ({ id: s.id, name: s.name })),
			priorIndividual: priorIndividualData,
			priorCycleLabel: priorCycle?.label ?? null
		},
		weeks
	};
};
