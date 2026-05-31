import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

// Vestige of pre-Tier-2 IA — the individual hub now subsumes this view.
// Kept as a 308 permanent redirect so any external bookmark or stale link
// lands somewhere useful.
export const load: PageServerLoad = async () => {
	throw redirect(308, '/individual');
};
