import { json, error } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { rateLimit } from '$lib/server/rateLimit';
import { suggestSubgoals } from '$lib/server/ai/suggestSubgoals';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async (event) => {
	const { dbUser } = requireAuth(event);

	// 5 calls per user per 5 minutes — client debounces so legitimate use is <<1/min.
	if (!(await rateLimit(`suggest-subgoals:${dbUser.id}`, 5, 5 * 60_000))) {
		throw error(429, 'Too many suggestion requests. Try again in a minute.');
	}

	const body = await event.request.json().catch(() => null);
	const objective = typeof body?.objective === 'string' ? body.objective : '';

	const subgoals = await suggestSubgoals(objective);
	return json({ subgoals });
};
