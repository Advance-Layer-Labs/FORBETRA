import { fail, redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { calendarDateString } from '$lib/notifications/preferences';
import { requireRole } from '$lib/server/auth';
import { getActiveGoal, journeyLengthWeeks, startJourney } from '$lib/server/domain';
import { newJourneySchema } from '$lib/validation/onboarding';
import type { Actions, PageServerLoad } from './$types';

const JOURNEY_LENGTHS: number[] = [6, 12, 16];

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');

	const goal = await getActiveGoal(dbUser.id);

	if (!goal) {
		throw redirect(303, '/onboarding');
	}

	const lastCycle = goal.journeys[0] ?? null;
	const cycleCount = await prisma.journey.count({
		where: { goalId: goal.id }
	});

	const defaultStartDate = calendarDateString(new Date(), dbUser.timezone);

	return {
		goal: {
			id: goal.id,
			title: goal.title,
			description: goal.description
		},
		focusAreas: goal.focusAreas.map((s) => ({
			id: s.id,
			label: s.label,
			description: s.description
		})),
		lastCycle: lastCycle
			? {
					id: lastCycle.id,
					label: lastCycle.label,
					startDate: lastCycle.startDate.toISOString(),
					endDate: lastCycle.endDate?.toISOString() ?? null,
					lengthWeeks: lastCycle.lengthWeeks
				}
			: null,
		journeyLengths: [...JOURNEY_LENGTHS],
		defaults: {
			cycleLabel: `Journey ${cycleCount + 1}`,
			startDate: defaultStartDate,
			durationWeeks: journeyLengthWeeks(lastCycle?.lengthWeeks, false)
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');

		const formData = await event.request.formData();
		const values = Object.fromEntries(formData) as Record<string, string>;
		const cycleMode = (formData.get('cycleMode') ?? 'continue').toString();

		const activeGoal = await getActiveGoal(dbUser.id);

		let goalTitle: string;
		let goalDescription: string | undefined;
		if (cycleMode === 'fresh') {
			goalTitle = (formData.get('freshGoalTitle') ?? '').toString().trim();
			goalDescription = (formData.get('freshGoalDescription') ?? '').toString().trim() || undefined;
		} else {
			if (!activeGoal) {
				return fail(400, { error: 'No active goal found.', values });
			}
			goalTitle = activeGoal.title;
			goalDescription = activeGoal.description ?? undefined;
		}

		const parsed = newJourneySchema.safeParse({
			goalTitle,
			goalDescription,
			focusAreas: [],
			reviewers: [],
			journeyLabel: (formData.get('cycleLabel') ?? '').toString().trim() || undefined,
			journeyStartDate: (formData.get('cycleStartDate') ?? '').toString(),
			lengthWeeks: Number.parseInt((formData.get('lengthWeeks') ?? '12').toString(), 10)
		});

		if (!parsed.success) {
			const errors = parsed.error.flatten();
			return fail(400, {
				error:
					errors.fieldErrors.goalTitle?.[0] ??
					errors.fieldErrors.journeyLabel?.[0] ??
					errors.fieldErrors.journeyStartDate?.[0] ??
					errors.fieldErrors.lengthWeeks?.[0] ??
					'Invalid input',
				values
			});
		}

		const data = parsed.data;
		if (!data.journeyLabel) {
			return fail(400, { error: 'Journey name is required', values });
		}

		const startDate = new Date(`${data.journeyStartDate}T12:00:00.000Z`);
		const lengthWeeks = journeyLengthWeeks(data.lengthWeeks, false);

		try {
			let goalId: string;

			if (cycleMode === 'fresh') {
				await prisma.goal.updateMany({
					where: { userId: dbUser.id, active: true },
					data: { active: false }
				});

				await prisma.journey.updateMany({
					where: { userId: dbUser.id, status: 'ACTIVE' },
					data: { status: 'COMPLETED' }
				});

				const newGoal = await prisma.goal.create({
					data: {
						userId: dbUser.id,
						title: data.goalTitle,
						description: data.goalDescription || null,
						active: true
					}
				});
				goalId = newGoal.id;

				if (activeGoal) {
					await prisma.reviewer.updateMany({
						where: { individualId: dbUser.id, goalId: activeGoal.id },
						data: { goalId }
					});
				}
			} else {
				goalId = activeGoal!.id;

				await prisma.journey.updateMany({
					where: { goalId, status: 'ACTIVE' },
					data: { status: 'COMPLETED' }
				});
			}

			await startJourney({
				userId: dbUser.id,
				goalId,
				startDate,
				lengthWeeks,
				label: data.journeyLabel
			});
		} catch (error) {
			console.error('[new-journey:error] Failed to create journey:', error);
			return fail(500, { error: 'Failed to create new journey. Please try again.', values });
		}

		throw redirect(303, '/individual/today');
	}
};
