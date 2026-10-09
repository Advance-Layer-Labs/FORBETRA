import { createCronJobHandler } from '$lib/server/cronAuth';
import { resolveJob } from '../resolveJob';

export const GET = createCronJobHandler('remind-feedback', resolveJob('remindReviewerFeedback'));
