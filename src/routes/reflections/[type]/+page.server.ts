import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

const CHECKIN_PATH = '/individual/checkin';

export const load: PageServerLoad = async () => {
	throw redirect(303, CHECKIN_PATH);
};

export const actions: Actions = {
	default: async () => {
		throw redirect(303, CHECKIN_PATH);
	}
};
