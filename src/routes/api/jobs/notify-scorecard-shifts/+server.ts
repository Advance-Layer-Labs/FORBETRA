import { notifyScorecardShifts } from '$jobs/notify-scorecard-shifts';
import { createCronJobHandler } from '$lib/server/cronAuth';

export const GET = createCronJobHandler('notify-scorecard-shifts', notifyScorecardShifts);
