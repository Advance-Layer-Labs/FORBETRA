import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';

export const sendReviewerImpactSummaries = async () => {
	const thirtyDaysAgo = new Date();
	thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

	// Find reviewers who gave feedback in the last 30 days
	const recentFeedbacks = await prisma.feedback.findMany({
		where: {
			submittedAt: { gte: thirtyDaysAgo }
		},
		select: {
			reviewerId: true,
			effortScore: true,
			performanceScore: true,
			submittedAt: true,
			weekNumber: true,
			reviewer: {
				select: {
					name: true,
					email: true,
					phone: true,
					individual: {
						select: {
							name: true
						}
					}
				}
			}
		}
	});

	if (recentFeedbacks.length === 0) {
		console.info('[job:reviewer-impact] No recent feedbacks found, skipping');
		return;
	}

	// Group by reviewer + individual pair
	const grouped = new Map<
		string,
		{
			reviewerName: string;
			reviewerEmail: string;
			reviewerPhone: string | null;
			individualName: string;
			feedbacks: Array<{
				weekNumber: number;
				effortScore: number | null;
				performanceScore: number | null;
			}>;
		}
	>();

	for (const fb of recentFeedbacks) {
		if (!fb.reviewer) continue;

		const key = fb.reviewerId;
		if (!grouped.has(key)) {
			grouped.set(key, {
				reviewerName: fb.reviewer.name,
				reviewerEmail: fb.reviewer.email,
				reviewerPhone: fb.reviewer.phone,
				individualName: fb.reviewer.individual?.name || 'your participant',
				feedbacks: []
			});
		}
		grouped.get(key)!.feedbacks.push({
			weekNumber: fb.weekNumber,
			effortScore: fb.effortScore,
			performanceScore: fb.performanceScore
		});
	}

	let sent = 0;
	for (const [, data] of grouped) {
		const { feedbacks, reviewerName, reviewerEmail, reviewerPhone, individualName } = data;

		// Compute stats
		const uniqueWeeks = new Set(feedbacks.map((f) => f.weekNumber));
		const weeksContributed = uniqueWeeks.size;
		const totalFeedbacks = feedbacks.length;

		// Compute trend from sorted feedbacks
		const sorted = [...feedbacks].sort((a, b) => a.weekNumber - b.weekNumber);
		const effortScores = sorted.map((f) => f.effortScore).filter((s): s is number => s !== null);
		const performanceScores = sorted
			.map((f) => f.performanceScore)
			.filter((s): s is number => s !== null);

		const computeTrend = (scores: number[]): 'up' | 'down' | 'stable' => {
			if (scores.length < 2) return 'stable';
			const firstHalf = scores.slice(0, Math.ceil(scores.length / 2));
			const secondHalf = scores.slice(Math.ceil(scores.length / 2));
			const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
			const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
			const diff = avgSecond - avgFirst;
			if (diff > 0.5) return 'up';
			if (diff < -0.5) return 'down';
			return 'stable';
		};

		const effortTrend = computeTrend(effortScores);
		const performanceTrend = computeTrend(performanceScores);

		try {
			const template = emailTemplates.reviewerImpactSummary({
				reviewerName: reviewerName || undefined,
				individualName,
				weeksContributed,
				totalFeedbacks,
				effortTrend,
				performanceTrend
			});
			await sendEmail({
				to: reviewerEmail,
				...template
			});
			sent++;
		} catch (error) {
			console.error(
				`[job:reviewer-impact] Failed to send impact summary to ${reviewerEmail}`,
				error
			);
		}

		// Send SMS impact summary
		await trySendSms(
			reviewerPhone,
			smsTemplates.reviewerImpactSummary({
				individualName,
				weeksContributed,
				totalFeedbacks
			})
		);
	}

	console.info(`[job:reviewer-impact] Sent ${sent} impact summaries`);
};
