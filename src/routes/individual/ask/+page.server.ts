import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
	const { dbUserName, journey, checkIns, feedback } = await parent();

	return {
		userName: dbUserName || 'there',
		hasActiveCycle: journey.status === 'ACTIVE',
		checkInCount: checkIns.length,
		feedbackCount: feedback.length
	};
};
