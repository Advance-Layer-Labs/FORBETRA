import { remindOverduePrompts } from '$jobs/remind-overdue-prompts';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('remind-prompts', remindOverduePrompts);
