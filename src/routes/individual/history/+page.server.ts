import type { PageServerLoad } from './$types';

type HistoryCheckIn = {
	id: string;
	effortScore: number;
	performanceScore: number;
	notes: string | null;
	submittedAt: string;
};

type HistoryFeedback = {
	id: string;
	reviewerName: string;
	effortScore: number | null;
	performanceScore: number | null;
	comment: string | null;
	behavioralObservation: string | null;
	suggestion: string | null;
};

export const load: PageServerLoad = async ({ parent }) => {
	const { goal, journey, checkIns, feedback } = await parent();

	const weekMap = new Map<number, { checkIns: HistoryCheckIn[]; feedbacks: HistoryFeedback[] }>();
	const bucketFor = (weekNumber: number) => {
		let bucket = weekMap.get(weekNumber);
		if (!bucket) {
			bucket = { checkIns: [], feedbacks: [] };
			weekMap.set(weekNumber, bucket);
		}
		return bucket;
	};

	for (const row of checkIns) {
		bucketFor(row.weekNumber).checkIns.push({
			id: row.id,
			effortScore: row.effortScore,
			performanceScore: row.performanceScore,
			notes: row.notes,
			submittedAt: row.submittedAt.toISOString()
		});
	}

	for (const row of feedback) {
		bucketFor(row.weekNumber).feedbacks.push({
			id: row.id,
			reviewerName: row.reviewer.name,
			effortScore: row.effortScore,
			performanceScore: row.performanceScore,
			comment: row.comment,
			behavioralObservation: row.behavioralObservation,
			suggestion: row.suggestion
		});
	}

	const weeks = Array.from(weekMap.entries())
		.map(([weekNumber, data]) => ({
			weekNumber,
			checkIns: [...data.checkIns].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt)),
			feedbacks: data.feedbacks
		}))
		.sort((a, b) => b.weekNumber - a.weekNumber);

	return {
		goalTitle: goal.title,
		cycleLabel: journey.label ?? 'Current Journey',
		weeks
	};
};
