#!/usr/bin/env ts-node

import { remindOverduePrompts } from '$jobs/remind-overdue-prompts';
import { remindReviewerFeedback } from '$jobs/remind-stakeholder-feedback';

const jobs = {
	'remind-overdue-prompts': remindOverduePrompts,
	'remind-reviewer-feedback': remindReviewerFeedback
};

const jobName = process.argv[2];

if (!jobName || !(jobName in jobs)) {
	console.error(
		`Usage: ts-node scripts/run-job.ts <job-name>\nAvailable jobs: ${Object.keys(jobs).join(', ')}`
	);
	process.exit(1);
}

(async () => {
	try {
		await jobs[jobName as keyof typeof jobs]();
		console.info(`[job:${jobName}] completed`);
	} catch (error) {
		console.error(`[job:${jobName}] failed`, error);
		process.exit(1);
	}
})();
