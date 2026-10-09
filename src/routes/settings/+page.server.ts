import { redirect } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireAuth(event);

	if (dbUser.role === 'ORG_ADMIN') {
		throw redirect(303, '/admin/organizations');
	}
	if (dbUser.role === 'ADMIN') {
		throw redirect(303, '/admin/settings');
	}
	if (dbUser.role === 'COACH') {
		throw redirect(303, '/coach/settings');
	}
	throw redirect(303, '/individual/settings');
};
