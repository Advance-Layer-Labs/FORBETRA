import prisma from '$lib/server/prisma';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';

const SHIFT_THRESHOLD = 1.5;

/**
 * Push-style notification: when a user's perception gap (self vs. reviewer)
 * shifts meaningfully week-over-week, send a targeted email pulling them to
 * the Scorecard view. Runs after generate-insights so we ride its data window.
 *
 * Threshold: |this_week_avg_gap - last_week_avg_gap| >= 1.5
 * (about 15% of the 0-10 scale — empirically the point where the shift is
 * obvious to a coach, not noise.)
 *
 * Only fires when both this week and last week have paired data. First-cycle
 * users with no prior week of reviewer feedback will never see this — that's
 * fine, the existing scorecardReady ambient nudge covers their first surfacing.
 */
export const notifyScorecardShifts = async () => {
	const now = new Date();
	const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	const individuals = await prisma.user.findMany({
		where: {
			role: 'INDIVIDUAL',
			objectives: { some: { active: true, cycles: { some: { status: 'ACTIVE' } } } }
		},
		select: {
			id: true,
			name: true,
			email: true,
			objectives: {
				where: { active: true },
				select: {
					title: true,
					cycles: {
						orderBy: { startDate: 'desc' },
						take: 1,
						select: {
							id: true,
							reflections: {
								where: { submittedAt: { gte: fourteenDaysAgo } },
								select: {
									effortScore: true,
									performanceScore: true,
									submittedAt: true,
									feedbacks: {
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
			}
		}
	});

	const avg = (nums: Array<number | null>) => {
		const xs = nums.filter((n): n is number => n !== null);
		return xs.length > 0 ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
	};

	let sent = 0;
	for (const user of individuals) {
		const cycle = user.objectives[0]?.cycles[0];
		const objective = user.objectives[0];
		if (!cycle || !objective) continue;

		// Partition by week window
		const reflectionsThis = cycle.reflections.filter((r) => r.submittedAt >= sevenDaysAgo);
		const reflectionsLast = cycle.reflections.filter(
			(r) => r.submittedAt < sevenDaysAgo && r.submittedAt >= fourteenDaysAgo
		);
		const feedbacksThis = cycle.reflections.flatMap((r) =>
			r.feedbacks.filter((f) => f.submittedAt >= sevenDaysAgo)
		);
		const feedbacksLast = cycle.reflections.flatMap((r) =>
			r.feedbacks.filter((f) => f.submittedAt < sevenDaysAgo && f.submittedAt >= fourteenDaysAgo)
		);

		// Both weeks need paired data to compute deltas
		const myEffortThis = avg(reflectionsThis.map((r) => r.effortScore));
		const myEffortLast = avg(reflectionsLast.map((r) => r.effortScore));
		const revEffortThis = avg(feedbacksThis.map((f) => f.effortScore));
		const revEffortLast = avg(feedbacksLast.map((f) => f.effortScore));
		const myPerfThis = avg(reflectionsThis.map((r) => r.performanceScore));
		const myPerfLast = avg(reflectionsLast.map((r) => r.performanceScore));
		const revPerfThis = avg(feedbacksThis.map((f) => f.performanceScore));
		const revPerfLast = avg(feedbacksLast.map((f) => f.performanceScore));

		const effortGapThis =
			myEffortThis !== null && revEffortThis !== null ? myEffortThis - revEffortThis : null;
		const effortGapLast =
			myEffortLast !== null && revEffortLast !== null ? myEffortLast - revEffortLast : null;
		const perfGapThis =
			myPerfThis !== null && revPerfThis !== null ? myPerfThis - revPerfThis : null;
		const perfGapLast =
			myPerfLast !== null && revPerfLast !== null ? myPerfLast - revPerfLast : null;

		const effortDelta =
			effortGapThis !== null && effortGapLast !== null
				? Math.abs(effortGapThis - effortGapLast)
				: 0;
		const perfDelta =
			perfGapThis !== null && perfGapLast !== null ? Math.abs(perfGapThis - perfGapLast) : 0;

		const maxDelta = Math.max(effortDelta, perfDelta);
		if (maxDelta < SHIFT_THRESHOLD) continue;

		// Pick the dimension that moved more — narrate that one
		const dimension = effortDelta >= perfDelta ? 'effort' : 'performance';
		const gapNow = dimension === 'effort' ? effortGapThis : perfGapThis;
		const gapBefore = dimension === 'effort' ? effortGapLast : perfGapLast;
		if (gapNow === null || gapBefore === null) continue;

		const direction: 'widening' | 'closing' =
			Math.abs(gapNow) > Math.abs(gapBefore) ? 'widening' : 'closing';

		try {
			const template = emailTemplates.scorecardShiftAlert({
				individualName: user.name || undefined,
				objectiveTitle: objective.title,
				dimension,
				direction,
				gapNow: +gapNow.toFixed(1),
				gapBefore: +gapBefore.toFixed(1),
				deltaAbs: +maxDelta.toFixed(1)
			});
			await sendEmail({ to: user.email, ...template });
			sent++;
		} catch (err) {
			console.error(`[job:notify-scorecard-shifts] Failed to send to ${user.email}`, err);
		}
	}

	console.info(`[job:notify-scorecard-shifts] Sent ${sent} shift alerts`);
};
