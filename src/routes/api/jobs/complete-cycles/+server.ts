import { createCronJobHandler } from '$lib/server/cronAuth';
import { resolveJob } from '../resolveJob';

export const GET = createCronJobHandler(
	'complete-journeys',
	resolveJob('completeExpiredJourneys', 'completeExpiredCycles')
);
