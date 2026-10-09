import { json, error, type RequestHandler } from '@sveltejs/kit';
import { requireAuth } from '$lib/server/auth';
import { rateLimit } from '$lib/server/rateLimit';
type SuggestModule = { suggestFocusAreas?: (goalTitle: string) => Promise<string[]> };

// The AI module has been renamed during migration; resolve whichever file exports suggestFocusAreas.
const suggestModules = import.meta.glob<SuggestModule>('/src/lib/server/ai/suggest*.ts', {
	eager: true
});
const suggestFocusAreas =
	Object.values(suggestModules).find((mod) => typeof mod.suggestFocusAreas === 'function')
		?.suggestFocusAreas ?? (async () => []);

export const suggestFocusAreasHandler: RequestHandler = async (event) => {
	const { dbUser } = requireAuth(event);

	// 5 calls per user per 5 minutes — client debounces so legitimate use is <<1/min.
	if (!(await rateLimit(`suggest-focus-areas:${dbUser.id}`, 5, 5 * 60_000))) {
		throw error(429, 'Too many suggestion requests. Try again in a minute.');
	}

	const body = await event.request.json().catch(() => null);
	const goal = typeof body?.goal === 'string' ? body.goal : '';

	const focusAreas = await suggestFocusAreas(goal);
	return json({ focusAreas });
};
