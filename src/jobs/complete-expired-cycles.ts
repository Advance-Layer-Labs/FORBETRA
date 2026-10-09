/**
 * Journey Auto-Completion Job
 *
 * Finds all ACTIVE journeys whose endDate has passed and marks them COMPLETED.
 * Generates a JOURNEY_REPORT insight and sends a completion email.
 * Runs daily at 1 AM UTC.
 */

import prisma from '$lib/server/prisma';
import { generateCycleReport } from '$lib/server/ai/generateInsight';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { getAppUrl } from '$lib/server/appUrl';

export async function completeExpiredCycles(): Promise<{
	completed: number;
	failed: number;
	skipped: number;
}> {
	console.log('[journeys:complete] Starting expired journey completion...');

	const now = new Date();

	const expiredCycles = await prisma.journey.findMany({
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
			goal: {
				select: { title: true }
			}
		}
	});

	let completed = 0;
	let failed = 0;
	let skipped = 0;

	for (const journey of expiredCycles) {
		// Check if a JOURNEY_REPORT already exists (skip report generation if so, but still fix status)
		const existingReport = await prisma.insight.findFirst({
			where: {
				userId: journey.userId,
				journeyId: journey.id,
				type: 'JOURNEY_REPORT'
			}
		});

		try {
			// Update journey status to COMPLETED
			await prisma.journey.update({
				where: { id: journey.id },
				data: { status: 'COMPLETED' }
			});

			// Generate journey report if one doesn't exist
			if (!existingReport) {
				try {
					await generateCycleReport(journey.userId, journey.id);
				} catch (reportError) {
					console.error(
						`[journeys:complete] Failed to generate report for journey ${journey.id}`,
						reportError
					);
					// Don't fail the whole journey completion if report generation fails
				}
			} else {
				skipped++;
			}

			const baseUrl = getAppUrl();

			if (wantsEmail(journey.user.deliveryMethod)) {
				try {
					const template = emailTemplates.cycleCompleted({
						individualName: journey.user.name || undefined,
						goalTitle: journey.goal.title,
						cycleLabel: journey.label || undefined,
						appUrl: baseUrl
					});
					await sendEmail({
						to: journey.user.email,
						...template
					});
				} catch (emailError) {
					console.error(
						`[journeys:complete] Failed to send email for journey ${journey.id}`,
						emailError
					);
				}
			}

			if (wantsSms(journey.user.deliveryMethod)) {
				await trySendSms(
					journey.user.phone,
					smsTemplates.cycleCompleted({
						goalTitle: journey.goal.title,
						appUrl: baseUrl
					})
				);
			}

			completed++;
		} catch (error) {
			console.error(`[journeys:complete] Failed to complete journey ${journey.id}`, error);
			failed++;
		}
	}

	console.log(
		`[journeys:complete] Done. Completed: ${completed}, Skipped reports: ${skipped}, Failed: ${failed}`
	);
	return { completed, failed, skipped };
}
