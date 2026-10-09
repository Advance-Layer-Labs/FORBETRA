import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { getActiveGoalWithJourney, listJourneysForBoard } from '$lib/server/individualContext';
import { onboardingSchema } from '$lib/validation/onboarding';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');
	const parent = await event.parent();

	const [journeys, user] = await Promise.all([
		listJourneysForBoard(dbUser.id),
		prisma.user.findUnique({
			where: { id: dbUser.id },
			select: { focusAreaPromptAt: true }
		})
	]);

	const activeGoalFocusAreas = parent.goal.focusAreas.length;
	const earliestScored = parent.checkIns.find(
		(row) => row.effortScore != null || row.performanceScore != null
	);

	return {
		journeys,
		showFocusAreaPrompt: !!user?.focusAreaPromptAt && activeGoalFocusAreas === 0,
		currentJourneyId: parent.journey.id,
		baseline: earliestScored
			? {
					effort: earliestScored.effortScore,
					performance: earliestScored.performanceScore
				}
			: null,
		checkedInThisWeek: parent.checkIns.some((row) => row.weekNumber === parent.currentWeek)
	};
};

export const actions: Actions = {
	renameGoal: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		const context = await getActiveGoalWithJourney(dbUser.id);
		if (!context?.goal) {
			return fail(400, { error: 'No active goal.', rename: true });
		}
		const goal = context.goal;
		const formData = await event.request.formData();
		const goalTitle = (formData.get('goalTitle') ?? '').toString();
		const rawDescription = (formData.get('goalDescription') ?? '').toString().trim();

		const parsed = onboardingSchema.safeParse({
			goalTitle,
			goalDescription: rawDescription.length > 0 ? rawDescription : undefined
		});

		if (!parsed.success) {
			const errors = parsed.error.flatten();
			return fail(400, {
				error:
					errors.fieldErrors.goalTitle?.[0] ??
					errors.fieldErrors.goalDescription?.[0] ??
					'Invalid goal',
				rename: true
			});
		}

		const nextDescription = parsed.data.goalDescription || null;
		const previousDescription = goal.description;
		const changed =
			goal.title !== parsed.data.goalTitle || (previousDescription ?? null) !== nextDescription;

		if (changed) {
			await prisma.$transaction([
				prisma.goal.update({
					where: { id: goal.id },
					data: {
						title: parsed.data.goalTitle,
						description: nextDescription
					}
				}),
				prisma.goalChange.create({
					data: {
						goalId: goal.id,
						userId: dbUser.id,
						previousTitle: goal.title,
						newTitle: parsed.data.goalTitle,
						previousDesc: previousDescription,
						newDesc: nextDescription
					}
				})
			]);
		}

		return { renamed: true };
	},

	dismissFocusPrompt: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		await prisma.user.update({
			where: { id: dbUser.id },
			data: { focusAreaPromptAt: null }
		});
		return { dismissedFocusPrompt: true };
	}
};
