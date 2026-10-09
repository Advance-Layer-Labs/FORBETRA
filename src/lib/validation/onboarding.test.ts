import { describe, it, expect } from 'vitest';
import { newJourneySchema, onboardingSchema } from './onboarding';

const baseValid = {
	goalTitle: 'Improve focus during meetings',
	goalDescription: 'Stay present and contribute in every meeting'
};

describe('onboardingSchema', () => {
	it('accepts a goal title and optional description', () => {
		const result = onboardingSchema.safeParse(baseValid);
		expect(result.success).toBe(true);
	});

	it('accepts a title with no description', () => {
		const result = onboardingSchema.safeParse({ goalTitle: 'Build a daily writing habit' });
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.goalDescription).toBeUndefined();
	});

	it('rejects goal title shorter than 3 characters', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, goalTitle: 'xy' });
		expect(result.success).toBe(false);
	});

	it('rejects goal title over 200 characters', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, goalTitle: 'x'.repeat(201) });
		expect(result.success).toBe(false);
	});

	it('rejects goal description over 1000 characters', () => {
		const result = onboardingSchema.safeParse({
			...baseValid,
			goalDescription: 'x'.repeat(1001)
		});
		expect(result.success).toBe(false);
	});
});

describe('newJourneySchema', () => {
	const journey = {
		...baseValid,
		journeyLabel: 'Q3 focus',
		journeyStartDate: '2026-06-01'
	};

	it('accepts lengthWeeks of 6, 12, and 16', () => {
		for (const lengthWeeks of [6, 12, 16]) {
			const result = newJourneySchema.safeParse({ ...journey, lengthWeeks });
			expect(result.success, `lengthWeeks ${lengthWeeks}`).toBe(true);
		}
	});

	it('rejects other lengthWeeks values', () => {
		for (const lengthWeeks of [4, 8, 26]) {
			const result = newJourneySchema.safeParse({ ...journey, lengthWeeks });
			expect(result.success, `lengthWeeks ${lengthWeeks} should be rejected`).toBe(false);
		}
	});

	it('defaults lengthWeeks to 12', () => {
		const result = newJourneySchema.safeParse(journey);
		expect(result.success).toBe(true);
		if (result.success) expect(result.data.lengthWeeks).toBe(12);
	});

	it('rejects journey label over 80 characters', () => {
		const result = newJourneySchema.safeParse({ ...journey, journeyLabel: 'x'.repeat(81) });
		expect(result.success).toBe(false);
	});

	it('rejects invalid journeyStartDate', () => {
		const result = newJourneySchema.safeParse({ ...journey, journeyStartDate: 'not-a-date' });
		expect(result.success).toBe(false);
	});

	it('strips focus areas and reviewers that used to ride along', () => {
		const result = newJourneySchema.safeParse({
			...journey,
			focusAreas: [{ label: 'Prepare an agenda' }],
			reviewers: [{ name: 'Sam', email: 'sam@example.com' }]
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).not.toHaveProperty('focusAreas');
			expect(result.data).not.toHaveProperty('reviewers');
		}
	});
});
