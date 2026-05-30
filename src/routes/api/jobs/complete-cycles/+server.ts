import { completeExpiredCycles } from '$jobs/complete-expired-cycles';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('complete-cycles', completeExpiredCycles);
