import { remindStakeholderFeedback } from '$jobs/remind-stakeholder-feedback';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('remind-feedback', remindStakeholderFeedback);
