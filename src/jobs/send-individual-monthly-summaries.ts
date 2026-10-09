import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { getAppUrl } from '$lib/server/appUrl';

/**
 * Monthly "here's what happened this month" email to each active Individual.
 * Parallel to send-reviewer-impact-summaries — that one nurtures reviewers,
 * this one closes the loop for the Individual themself.
 *
 * Fires from /api/jobs/individual-monthly-summary cron on the 1st of each
 * month. The reviewer-impact cron also runs at the same time.
 */
export const sendIndividualMonthlySummaries = async () => {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
	const sixtyDaysAgo = new Date();
	sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

	// Pull active individuals who have an active journey. We compute last-30 vs
	// prior-30 stats and skip users with no recent activity.
	const individuals = await prisma.user.findMany({
		where: {
			role: 'INDIVIDUAL',
			goals: { some: { active: true, journeys: { some: { status: 'ACTIVE' } } } }
		},
		select: {
			id: true,
			name: true,
			email: true,
			phone: true,
			deliveryMethod: true,
			goals: {
				where: { active: true },
				select: {
					title: true,
					journeys: {
						where: { status: 'ACTIVE' },
						orderBy: { startDate: 'desc' },
						take: 1,
						select: {
							id: true,
							checkIns: {
								where: { submittedAt: { gte: sixtyDaysAgo } },
								select: {
									effortScore: true,
									performanceScore: true,
									submittedAt: true
								}
							},
							feedback: {
								where: { submittedAt: { gte: sixtyDaysAgo } },
								select: {
									effortScore: true,
									performanceScore: true,
									submittedAt: true
								}
							}
						}
					}
				}
			}
		}
	});

	let sent = 0;
	for (const user of individuals) {
		const goal = user.goals[0];
		const journey = goal?.journeys[0];
		if (!goal || !journey) continue;

		// Partition checkIns + feedbacks into "this month" (last 30d) and
		// "last month" (30-60d). All-zero in this-month → skip (no activity to
		// summarize, don't spam inactive users).
		const reflectionsThis = journey.checkIns.filter((r) => r.submittedAt >= thirtyDaysAgo);
		const reflectionsLast = journey.checkIns.filter(
			(r) => r.submittedAt < thirtyDaysAgo && r.submittedAt >= sixtyDaysAgo
		);

		const feedbacksThis = journey.feedback.filter((f) => f.submittedAt >= thirtyDaysAgo);
		const feedbacksLast = journey.feedback.filter(
			(f) => f.submittedAt < thirtyDaysAgo && f.submittedAt >= sixtyDaysAgo
		);

		const checkInCount = reflectionsThis.length;
		if (checkInCount === 0 && feedbacksThis.length === 0) continue;

		// Self averages
		const avg = (nums: Array<number | null>) => {
			const xs = nums.filter((n): n is number => n !== null);
			return xs.length > 0 ? +(xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1) : null;
		};
		const myEffortThis = avg(reflectionsThis.map((r) => r.effortScore));
		const myEffortLast = avg(reflectionsLast.map((r) => r.effortScore));
		const myPerfThis = avg(reflectionsThis.map((r) => r.performanceScore));

		// Reviewer averages
		const reviewerEffortThis = avg(feedbacksThis.map((f) => f.effortScore));
		const reviewerPerfThis = avg(feedbacksThis.map((f) => f.performanceScore));

		// Gap delta — only meaningful if both periods have paired data.
		const gapThis =
			myEffortThis != null && reviewerEffortThis != null
				? +Math.abs(myEffortThis - reviewerEffortThis).toFixed(1)
				: null;
		const myEffortLastVal = myEffortLast;
		const reviewerEffortLast = avg(feedbacksLast.map((f) => f.effortScore));
		const gapLast =
			myEffortLastVal != null && reviewerEffortLast != null
				? +Math.abs(myEffortLastVal - reviewerEffortLast).toFixed(1)
				: null;
		const gapDelta = gapThis != null && gapLast != null ? +(gapThis - gapLast).toFixed(1) : null;

		if (wantsEmail(user.deliveryMethod)) {
			try {
				const template = emailTemplates.individualMonthlySummary({
					individualName: user.name || undefined,
					goalTitle: goal.title,
					checkInCount,
					feedbackCount: feedbacksThis.length,
					myEffortThis,
					myPerfThis,
					reviewerEffortThis,
					reviewerPerfThis,
					gapDelta
				});
				await sendEmail({ to: user.email, ...template });
				sent++;
			} catch (err) {
				console.error(`[job:individual-monthly-summary] Failed to send to ${user.email}`, err);
			}
		}

		if (wantsSms(user.deliveryMethod)) {
			await trySendSms(
				user.phone,
				smsTemplates.individualMonthlySummary({
					goalTitle: goal.title,
					checkInCount,
					feedbackCount: feedbacksThis.length,
					appUrl: getAppUrl()
				})
			);
		}
	}

	console.info(`[job:individual-monthly-summary] Sent ${sent} monthly summaries`);
};
