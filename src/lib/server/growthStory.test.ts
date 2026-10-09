import { describe, it, expect } from 'vitest';
import { buildScoreTrend, selectTopComments, findKeyMoments } from './growthStory';

describe('buildScoreTrend', () => {
	it('groups checkIns by week and averages scores', () => {
		const result = buildScoreTrend([
			{ weekNumber: 1, effortScore: 6, performanceScore: 5 },
			{ weekNumber: 1, effortScore: 8, performanceScore: 7 },
			{ weekNumber: 2, effortScore: 7, performanceScore: 8 }
		]);
		expect(result).toEqual([
			{ weekNumber: 1, effort: 7, performance: 6 },
			{ weekNumber: 2, effort: 7, performance: 8 }
		]);
	});

	it('returns null for missing scores', () => {
		const result = buildScoreTrend([
			{ weekNumber: 1, effortScore: 5, performanceScore: null },
			{ weekNumber: 2, effortScore: null, performanceScore: 8 }
		]);
		expect(result).toEqual([
			{ weekNumber: 1, effort: 5, performance: null },
			{ weekNumber: 2, effort: null, performance: 8 }
		]);
	});

	it('returns empty array for no checkIns', () => {
		expect(buildScoreTrend([])).toEqual([]);
	});

	it('sorts by week number', () => {
		const result = buildScoreTrend([
			{ weekNumber: 3, effortScore: 9, performanceScore: 9 },
			{ weekNumber: 1, effortScore: 5, performanceScore: 5 }
		]);
		expect(result[0].weekNumber).toBe(1);
		expect(result[1].weekNumber).toBe(3);
	});
});

describe('selectTopComments', () => {
	it('selects longest comments up to limit', () => {
		const result = selectTopComments([
			{ comment: 'Short comment here.', reviewerName: 'Alice', weekNumber: 1 },
			{
				comment: 'This is a much longer and more detailed comment about growth.',
				reviewerName: 'Bob',
				weekNumber: 2
			},
			{
				comment: 'Medium length comment with details.',
				reviewerName: 'Carol',
				weekNumber: 3
			}
		]);
		expect(result).toHaveLength(2);
		expect(result[0].raterName).toBe('Bob');
		expect(result[1].raterName).toBe('Carol');
	});

	it('filters out null and short comments', () => {
		const result = selectTopComments([
			{ comment: null, reviewerName: 'Alice', weekNumber: 1 },
			{ comment: 'Too short', reviewerName: 'Bob', weekNumber: 2 },
			{
				comment: 'This is a valid comment with enough length.',
				reviewerName: 'Carol',
				weekNumber: 3
			}
		]);
		expect(result).toHaveLength(1);
		expect(result[0].raterName).toBe('Carol');
	});

	it('returns empty when no feedback has comments', () => {
		const result = selectTopComments([
			{ comment: null, reviewerName: 'Alice', weekNumber: 1 },
			{ comment: null, reviewerName: 'Bob', weekNumber: 2 }
		]);
		expect(result).toEqual([]);
	});
});

describe('findKeyMoments', () => {
	it('detects large effort jumps', () => {
		const result = findKeyMoments([
			{ weekNumber: 1, effort: 5, performance: 5 },
			{ weekNumber: 2, effort: 7, performance: 5.5 },
			{ weekNumber: 3, effort: 7.5, performance: 6 }
		]);
		expect(result).toHaveLength(1);
		expect(result[0].weekNumber).toBe(2);
		expect(result[0].description).toContain('Effort jumped');
	});

	it('detects performance drops', () => {
		const result = findKeyMoments([
			{ weekNumber: 1, effort: 7, performance: 8 },
			{ weekNumber: 2, effort: 7, performance: 6 }
		]);
		expect(result).toHaveLength(1);
		expect(result[0].description).toContain('Performance dropped');
	});

	it('returns empty for stable scores', () => {
		const result = findKeyMoments([
			{ weekNumber: 1, effort: 7, performance: 7 },
			{ weekNumber: 2, effort: 7.5, performance: 7.2 },
			{ weekNumber: 3, effort: 7.8, performance: 7.5 }
		]);
		expect(result).toEqual([]);
	});

	it('returns empty for fewer than 2 data points', () => {
		expect(findKeyMoments([])).toEqual([]);
		expect(findKeyMoments([{ weekNumber: 1, effort: 5, performance: 5 }])).toEqual([]);
	});
});
