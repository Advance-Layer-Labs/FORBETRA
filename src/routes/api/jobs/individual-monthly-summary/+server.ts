import { sendIndividualMonthlySummaries } from '$jobs/send-individual-monthly-summaries';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler(
	'individual-monthly-summary',
	sendIndividualMonthlySummaries
);
