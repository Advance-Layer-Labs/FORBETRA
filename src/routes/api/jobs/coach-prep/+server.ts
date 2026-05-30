import { generateCoachPrepInsights } from '$jobs/generate-coach-prep';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('coach-prep', generateCoachPrepInsights);
