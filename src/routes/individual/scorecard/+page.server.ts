import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { goal, currentWeek, journey, checkIns, feedback } = await event.parent();

	const totalWeeks = Math.max(journey.lengthWeeks, currentWeek);
	const reviewerIds = new Set(goal.reviewers.map((reviewer) => reviewer.id));
	const allFeedbacks = feedback.filter((row) => reviewerIds.has(row.reviewerId));

	// Week navigation via query param
	const weekParam = event.url.searchParams.get('week');
	const viewWeek = weekParam
		? Math.max(1, Math.min(totalWeeks, parseInt(weekParam, 10) || currentWeek))
		: currentWeek;

	// Build reviewer name map
	const reviewerNameMap = new Map<string, string>();
	for (const sh of goal.reviewers) {
		reviewerNameMap.set(sh.id, sh.name);
	}

	// Self scores: average effort/performance for viewWeek
	const selfReflections = checkIns.filter((r) => r.weekNumber === viewWeek);
	const selfEfforts = selfReflections
		.map((r) => r.effortScore)
		.filter((v): v is number => v !== null);
	const selfPerfs = selfReflections
		.map((r) => r.performanceScore)
		.filter((v): v is number => v !== null);
	const avg = (arr: number[]) =>
		arr.length > 0 ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : null;

	const myEffort = avg(selfEfforts);
	const myPerformance = avg(selfPerfs);

	// Self notes for this week
	const selfNotes = selfReflections
		.filter((r) => r.notes && r.notes.trim().length > 0)
		.map((r) => r.notes!)
		.slice(0, 3);

	// Build per-reviewer scorecard for viewWeek
	type ScorecardRow = {
		reviewerId: string;
		reviewerName: string;
		reviewerEffort: number | null;
		reviewerPerformance: number | null;
		comment: string | null;
		effortGap: number | null;
		performanceGap: number | null;
		effortGapTrend: 'widening' | 'closing' | 'stable' | null;
		performanceGapTrend: 'widening' | 'closing' | 'stable' | null;
		maxAbsGap: number;
	};

	const scorecard: ScorecardRow[] = [];

	// Group feedbacks by reviewer and week
	const shWeekMap = new Map<
		string,
		Map<number, { efforts: number[]; performances: number[]; comments: string[] }>
	>();
	for (const fb of allFeedbacks) {
		const wk = fb.weekNumber;
		const shId = fb.reviewerId;

		if (!shWeekMap.has(shId)) shWeekMap.set(shId, new Map());
		const shWeeks = shWeekMap.get(shId)!;
		if (!shWeeks.has(wk)) shWeeks.set(wk, { efforts: [], performances: [], comments: [] });
		const w = shWeeks.get(wk)!;
		if (fb.effortScore !== null) w.efforts.push(fb.effortScore);
		if (fb.performanceScore !== null) w.performances.push(fb.performanceScore);
		if (fb.comment && fb.comment.trim().length > 0) w.comments.push(fb.comment.trim());
	}

	// Self scores per week (for trend computation)
	const selfWeekMap = new Map<number, { effort: number | null; performance: number | null }>();
	for (let wk = 1; wk <= totalWeeks; wk++) {
		const refs = checkIns.filter((r) => r.weekNumber === wk);
		const effs = refs.map((r) => r.effortScore).filter((v): v is number => v !== null);
		const prfs = refs.map((r) => r.performanceScore).filter((v): v is number => v !== null);
		selfWeekMap.set(wk, { effort: avg(effs), performance: avg(prfs) });
	}

	function computeTrend(
		shWeeks: Map<number, { efforts: number[]; performances: number[] }>,
		getSelf: (wk: number) => number | null,
		getStk: (wk: number, data: { efforts: number[]; performances: number[] }) => number | null
	): 'widening' | 'closing' | 'stable' | null {
		const pairedGaps: number[] = [];
		const weeks = Array.from(shWeeks.keys()).sort((a, b) => a - b);
		for (const wk of weeks) {
			const s = getSelf(wk);
			const stk = getStk(wk, shWeeks.get(wk)!);
			if (s !== null && stk !== null) pairedGaps.push(Math.abs(s - stk));
		}
		if (pairedGaps.length < 2) return null;
		const recent = pairedGaps.slice(-3);
		let totalDelta = 0;
		for (let i = 1; i < recent.length; i++) totalDelta += recent[i] - recent[i - 1];
		const avgDelta = totalDelta / (recent.length - 1);
		if (avgDelta > 0.5) return 'widening';
		if (avgDelta < -0.5) return 'closing';
		return 'stable';
	}

	for (const sh of goal.reviewers) {
		const shWeeks = shWeekMap.get(sh.id);
		const viewData = shWeeks?.get(viewWeek);

		const stkEffort = viewData ? avg(viewData.efforts) : null;
		const stkPerf = viewData ? avg(viewData.performances) : null;
		const comment = viewData?.comments[viewData.comments.length - 1] ?? null;

		const effortGap =
			myEffort !== null && stkEffort !== null ? Number((myEffort - stkEffort).toFixed(1)) : null;
		const perfGap =
			myPerformance !== null && stkPerf !== null
				? Number((myPerformance - stkPerf).toFixed(1))
				: null;

		const effortGapTrend = shWeeks
			? computeTrend(
					shWeeks,
					(wk) => selfWeekMap.get(wk)?.effort ?? null,
					(_wk, data) => avg(data.efforts)
				)
			: null;
		const performanceGapTrend = shWeeks
			? computeTrend(
					shWeeks,
					(wk) => selfWeekMap.get(wk)?.performance ?? null,
					(_wk, data) => avg(data.performances)
				)
			: null;

		scorecard.push({
			reviewerId: sh.id,
			reviewerName: reviewerNameMap.get(sh.id) ?? sh.name,
			reviewerEffort: stkEffort,
			reviewerPerformance: stkPerf,
			comment,
			effortGap,
			performanceGap: perfGap,
			effortGapTrend,
			performanceGapTrend,
			maxAbsGap: Math.max(Math.abs(effortGap ?? 0), Math.abs(perfGap ?? 0))
		});
	}

	return {
		viewWeek,
		currentWeek,
		totalWeeks,
		myEffort,
		myPerformance,
		selfNotes,
		scorecard,
		goalTitle: goal.title
	};
};
