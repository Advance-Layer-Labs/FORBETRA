import { sendStakeholderImpactSummaries } from '$jobs/send-stakeholder-impact-summaries';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('stakeholder-impact', sendStakeholderImpactSummaries);
