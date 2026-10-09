import { error } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { loadGrowthStory } from '$lib/server/growthStory';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, 'INDIVIDUAL');
	const { cycleId: journeyId } = event.params;

	const story = await loadGrowthStory(prisma, journeyId, dbUser.id);

	if (!story) {
		throw error(404, 'Growth story not found');
	}

	const firstName = dbUser.name?.split(' ')[0] ?? 'Your';

	return {
		firstName,
		story
	};
};
