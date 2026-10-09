import { describe, expect, it } from 'vitest';
import { hasDuplicateFeedback, weeklyGap } from './gap';
import { isReviewerDue, weekNumberForDate } from './week';

const start = new Date('2026-01-05T00:00:00.000Z');

describe('weekNumberForDate', () => {
	it('treats the start day as week 1', () => {
		expect(weekNumberForDate(start, new Date('2026-01-05T15:00:00.000Z'), 'UTC')).toBe(1);
	});

	it('derives later weeks from the timestamp', () => {
		expect(weekNumberForDate(start, new Date('2026-01-12T00:00:00.000Z'), 'UTC')).toBe(2);
		expect(weekNumberForDate(start, new Date('2026-01-18T23:00:00.000Z'), 'UTC')).toBe(2);
		expect(weekNumberForDate(start, new Date('2026-01-19T00:00:00.000Z'), 'UTC')).toBe(3);
	});

	it('keeps a US Sunday evening on the current local week', () => {
		const journeyStart = new Date('2026-01-05T18:00:00.000Z');
		const sundayEveningPacific = new Date('2026-01-12T02:00:00.000Z');
		expect(weekNumberForDate(journeyStart, sundayEveningPacific, 'UTC')).toBe(2);
		expect(weekNumberForDate(journeyStart, sundayEveningPacific, 'America/Los_Angeles')).toBe(1);
	});
});

describe('isReviewerDue', () => {
	it('prompts weekly reviewers every week', () => {
		expect(isReviewerDue('WEEKLY', 2)).toBe(true);
		expect(isReviewerDue('WEEKLY', 4)).toBe(true);
	});

	it('skips biweekly reviewers on even weeks', () => {
		expect(isReviewerDue('BIWEEKLY', 1)).toBe(true);
		expect(isReviewerDue('BIWEEKLY', 2)).toBe(false);
		expect(isReviewerDue('BIWEEKLY', 3)).toBe(true);
	});
});

describe('weeklyGap', () => {
	it('averages several check-ins inside one week', () => {
		const gaps = weeklyGap({
			journeyStart: start,
			checkIns: [
				{
					submittedAt: new Date('2026-01-06T12:00:00.000Z'),
					effortScore: 4,
					performanceScore: 6
				},
				{
					submittedAt: new Date('2026-01-08T12:00:00.000Z'),
					effortScore: 8,
					performanceScore: 10
				}
			],
			feedback: []
		});

		expect(gaps).toEqual([
			{
				weekNumber: 1,
				selfEffort: 6,
				selfPerformance: 8,
				checkInCount: 2,
				reviewerEffort: null,
				reviewerPerformance: null,
				reviewerCount: 0,
				effortGap: null,
				performanceGap: null
			}
		]);
	});

	it('counts a coach-reviewer once when a duplicate row is present', () => {
		const gaps = weeklyGap({
			journeyStart: start,
			checkIns: [
				{
					submittedAt: new Date('2026-01-06T12:00:00.000Z'),
					effortScore: 8,
					performanceScore: 8
				}
			],
			feedback: [
				{
					reviewerId: 'coach-1',
					attribution: 'COACH',
					weekNumber: 1,
					effortScore: 6,
					performanceScore: 5
				},
				{
					reviewerId: 'coach-1',
					attribution: 'COACH',
					weekNumber: 1,
					effortScore: 1,
					performanceScore: 1
				},
				{
					reviewerId: 'peer-1',
					attribution: 'REVIEWER',
					weekNumber: 1,
					effortScore: 4,
					performanceScore: 7
				}
			]
		});

		expect(gaps[0].reviewerCount).toBe(2);
		expect(gaps[0].reviewerEffort).toBe(5);
		expect(gaps[0].reviewerPerformance).toBe(6);
		expect(gaps[0].effortGap).toBe(3);
		expect(gaps[0].performanceGap).toBe(2);
	});

	it('does not invent scores for focus areas', () => {
		const gaps = weeklyGap({
			journeyStart: start,
			checkIns: [
				{
					submittedAt: new Date('2026-01-06T12:00:00.000Z'),
					effortScore: 7,
					performanceScore: 7
				}
			],
			feedback: []
		});
		expect(gaps).toHaveLength(1);
		expect(Object.keys(gaps[0])).not.toContain('focusAreaId');
	});
});

describe('hasDuplicateFeedback', () => {
	it('rejects a second submission from the same reviewer in the same week', () => {
		expect(hasDuplicateFeedback([{ reviewerId: 'r1', weekNumber: 2 }], 'r1', 2)).toBe(true);
		expect(hasDuplicateFeedback([{ reviewerId: 'r1', weekNumber: 2 }], 'r1', 3)).toBe(false);
	});
});
