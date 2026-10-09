import { describe, it, expect } from 'vitest';
import { reviewerFeedbackSchema } from './feedback';

const validToken = 'a'.repeat(64);

describe('reviewerFeedbackSchema', () => {
	it('accepts a complete valid submission', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '7',
			performanceScore: '8',
			comment: 'Great progress this week'
		});
		expect(result.success).toBe(true);
	});

	it('accepts effort score only', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '5'
		});
		expect(result.success).toBe(true);
	});

	it('accepts performance score only', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			performanceScore: '8'
		});
		expect(result.success).toBe(true);
	});

	it('accepts comment only', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			comment: 'Doing well'
		});
		expect(result.success).toBe(true);
	});

	it('rejects submission with no scores and no comment', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken
		});
		expect(result.success).toBe(false);
	});

	it('rejects invalid token (wrong length)', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: 'short',
			effortScore: '5'
		});
		expect(result.success).toBe(false);
	});

	it('rejects scores above 10', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '11'
		});
		expect(result.success).toBe(false);
	});

	it('rejects negative scores', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			performanceScore: '-1'
		});
		expect(result.success).toBe(false);
	});

	it('rejects comments over 500 characters', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			comment: 'x'.repeat(501)
		});
		expect(result.success).toBe(false);
	});

	it('accepts behavioral observation and suggestion alongside a score', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '6',
			behavioralObservation: 'Ran a tight stand-up',
			suggestion: 'Share the agenda earlier'
		});
		expect(result.success).toBe(true);
	});

	it('rejects behavioral observation over 500 characters', () => {
		const result = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '6',
			behavioralObservation: 'x'.repeat(501)
		});
		expect(result.success).toBe(false);
	});

	it('accepts boundary scores (0 and 10)', () => {
		const zeroResult = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '0'
		});
		expect(zeroResult.success).toBe(true);

		const tenResult = reviewerFeedbackSchema.safeParse({
			token: validToken,
			effortScore: '10'
		});
		expect(tenResult.success).toBe(true);
	});
});
