import { generateWeeklyInsights } from '$jobs/generate-weekly-insights';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('generate-insights', generateWeeklyInsights);
