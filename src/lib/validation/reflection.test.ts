import { describe, it, expect } from 'vitest';
import { reflectionEntrySchema, checkInEntrySchema } from './reflection';

const validCuid = 'cjld2cyuq0000t3rmniod1foy';

describe('reflectionEntrySchema', () => {
	it('accepts a valid entry', () => {
		const result = reflectionEntrySchema.safeParse({
			subgoalId: validCuid,
			score: 7,
			notes: 'Good week'
		});
		expect(result.success).toBe(true);
	});

	it('accepts entry without notes', () => {
		const result = reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: 5 });
		expect(result.success).toBe(true);
	});

	it('coerces string score to number', () => {
		const result = reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: '8' });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.score).toBe(8);
	});

	it('rejects non-cuid subgoalId', () => {
		const result = reflectionEntrySchema.safeParse({ subgoalId: 'not-a-cuid', score: 5 });
		expect(result.success).toBe(false);
	});

	it('rejects score below 0', () => {
		const result = reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: -1 });
		expect(result.success).toBe(false);
	});

	it('rejects score above 10', () => {
		const result = reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: 11 });
		expect(result.success).toBe(false);
	});

	it('accepts boundary scores (0 and 10)', () => {
		expect(reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: 0 }).success).toBe(true);
		expect(reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: 10 }).success).toBe(true);
	});

	it('rejects non-integer score', () => {
		const result = reflectionEntrySchema.safeParse({ subgoalId: validCuid, score: 5.5 });
		expect(result.success).toBe(false);
	});

	it('rejects notes over 1000 characters', () => {
		const result = reflectionEntrySchema.safeParse({
			subgoalId: validCuid,
			score: 5,
			notes: 'x'.repeat(1001)
		});
		expect(result.success).toBe(false);
	});
});

describe('checkInEntrySchema', () => {
	it('accepts valid effort + performance', () => {
		const result = checkInEntrySchema.safeParse({ effortScore: 6, performanceScore: 7 });
		expect(result.success).toBe(true);
	});

	it('requires both scores', () => {
		expect(checkInEntrySchema.safeParse({ effortScore: 5 }).success).toBe(false);
		expect(checkInEntrySchema.safeParse({ performanceScore: 5 }).success).toBe(false);
	});

	it('coerces string scores', () => {
		const result = checkInEntrySchema.safeParse({ effortScore: '8', performanceScore: '6' });
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.effortScore).toBe(8);
			expect(result.data.performanceScore).toBe(6);
		}
	});

	it('rejects scores outside 0–10', () => {
		expect(checkInEntrySchema.safeParse({ effortScore: -1, performanceScore: 5 }).success).toBe(
			false
		);
		expect(checkInEntrySchema.safeParse({ effortScore: 5, performanceScore: 11 }).success).toBe(
			false
		);
	});

	it('accepts boundary scores (0 and 10)', () => {
		expect(checkInEntrySchema.safeParse({ effortScore: 0, performanceScore: 10 }).success).toBe(
			true
		);
	});

	it('rejects notes over 1000 characters', () => {
		const result = checkInEntrySchema.safeParse({
			effortScore: 5,
			performanceScore: 5,
			notes: 'x'.repeat(1001)
		});
		expect(result.success).toBe(false);
	});
});
