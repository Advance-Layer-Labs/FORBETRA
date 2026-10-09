import { fail, redirect } from '@sveltejs/kit';
import { requireRole } from '$lib/server/auth';
import prisma from '$lib/server/prisma';
import { replaceFocusAreas } from '$lib/server/domain';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import { focusAreasSchema } from '$lib/validation/onboarding';
import type { Actions, PageServerLoad } from './$types';

const MAX_FOCUS_AREAS = 5;

export const load: PageServerLoad = async (event) => {
	const parent = await event.parent();
	return {
		goalTitle: parent.goal.title,
		focusAreas: parent.goal.focusAreas.map((area) => ({
			label: area.label,
			description: area.description ?? ''
		}))
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { dbUser } = requireRole(event, 'INDIVIDUAL');
		const context = await getActiveGoalWithJourney(dbUser.id);
		if (!context?.goal) {
			return fail(400, {
				error: 'No active goal.',
				focusAreas: [] as Array<{ label: string; description: string }>
			});
		}
		const formData = await event.request.formData();
		const labels = formData.getAll('focusAreaLabel').map((value) => value.toString());
		const descriptions = formData.getAll('focusAreaDescription').map((value) => value.toString());

		const focusAreas = labels
			.map((label, index) => ({
				label: label.trim(),
				description: (descriptions[index] ?? '').trim()
			}))
			.filter((area) => area.label.length > 0)
			.slice(0, MAX_FOCUS_AREAS);

		const parsed = focusAreasSchema.safeParse({ focusAreas });
		if (!parsed.success) {
			const message = parsed.error.issues[0]?.message ?? 'Add at least one focus area';
			return fail(400, { error: message, focusAreas });
		}

		await replaceFocusAreas(context.goal.id, parsed.data.focusAreas);
		await prisma.user.update({
			where: { id: dbUser.id },
			data: { focusAreaPromptAt: null }
		});

		throw redirect(303, '/individual/today');
	}
};
