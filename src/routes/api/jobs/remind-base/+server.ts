import { remindBaseReflections } from '$jobs/remind-base-reflections';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('remind-base', remindBaseReflections);
