/**
 * Cycle Auto-Completion Job
 *
 * Finds all ACTIVE cycles whose endDate has passed and marks them COMPLETED.
 * Generates a CYCLE_REPORT insight and sends a completion email.
 * Runs daily at 1 AM UTC.
 */

import prisma from '$lib/server/prisma';
import { generateCycleReport } from '$lib/server/ai/generateInsight';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { getAppUrl } from '$lib/server/appUrl';

export async function completeExpiredCycles(): Promise<{
	completed: number;
	failed: number;
	skipped: number;
}> {
	console.log('[cycles:complete] Starting expired cycle completion...');

	const now = new Date();

	const expiredCycles = await prisma.cycle.findMany({
		where: {
			status: 'ACTIVE',
			endDate: {
				not: null,
				lt: now
			}
		},
		include: {
			user: {
				select: { id: true, email: true, name: true, phone: true, deliveryMethod: true }
			},
			objective: {
				select: { title: true }
			}
		}
	});

	let completed = 0;
	let failed = 0;
	let skipped = 0;

	for (const cycle of expiredCycles) {
		// Check if a CYCLE_REPORT already exists (skip report generation if so, but still fix status)
		const existingReport = await prisma.insight.findFirst({
			where: {
				userId: cycle.userId,
				cycleId: cycle.id,
				type: 'CYCLE_REPORT'
			}
		});

		try {
			// Update cycle status to COMPLETED
			await prisma.cycle.update({
				where: { id: cycle.id },
				data: { status: 'COMPLETED' }
			});

			// Generate cycle report if one doesn't exist
			if (!existingReport) {
				try {
					await generateCycleReport(cycle.userId, cycle.id);
				} catch (reportError) {
					console.error(
						`[cycles:complete] Failed to generate report for cycle ${cycle.id}`,
						reportError
					);
					// Don't fail the whole cycle completion if report generation fails
				}
			} else {
				skipped++;
			}

			const baseUrl = getAppUrl();
			const delivery = cycle.user.deliveryMethod ?? 'both';

			if (delivery !== 'sms') {
				try {
					const template = emailTemplates.cycleCompleted({
						individualName: cycle.user.name || undefined,
						objectiveTitle: cycle.objective.title,
						cycleLabel: cycle.label || undefined,
						appUrl: baseUrl
					});
					await sendEmail({
						to: cycle.user.email,
						...template
					});
				} catch (emailError) {
					console.error(`[cycles:complete] Failed to send email for cycle ${cycle.id}`, emailError);
				}
			}

			// Send SMS notification
			if (delivery !== 'email') {
				await trySendSms(
					cycle.user.phone,
					smsTemplates.cycleCompleted({
						objectiveTitle: cycle.objective.title,
						appUrl: baseUrl
					})
				);
			}

			completed++;
		} catch (error) {
			console.error(`[cycles:complete] Failed to complete cycle ${cycle.id}`, error);
			failed++;
		}
	}

	console.log(
		`[cycles:complete] Done. Completed: ${completed}, Skipped reports: ${skipped}, Failed: ${failed}`
	);
	return { completed, failed, skipped };
}
