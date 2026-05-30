import { describe, it, expect } from 'vitest';
import { onboardingSchema } from './onboarding';

const baseValid = {
	objectiveTitle: 'Improve focus during meetings',
	subgoals: [{ label: 'Prepare an agenda before each meeting' }],
	stakeholders: [{ name: 'Sam', email: 'sam@example.com' }],
	cycleStartDate: '2026-06-01',
	cycleDurationWeeks: 12,
	stakeholderCadence: 'weekly'
};

describe('onboardingSchema', () => {
	it('accepts a complete valid payload', () => {
		const result = onboardingSchema.safeParse(baseValid);
		expect(result.success).toBe(true);
	});

	it('rejects objective title shorter than 3 characters', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, objectiveTitle: 'xy' });
		expect(result.success).toBe(false);
	});

	it('rejects objective title over 200 characters', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, objectiveTitle: 'x'.repeat(201) });
		expect(result.success).toBe(false);
	});

	it('rejects more than 5 subgoals', () => {
		const subgoals = Array.from({ length: 6 }, (_, i) => ({ label: `Subgoal ${i + 1}` }));
		const result = onboardingSchema.safeParse({ ...baseValid, subgoals });
		expect(result.success).toBe(false);
	});

	it('rejects more than 10 stakeholders', () => {
		const stakeholders = Array.from({ length: 11 }, (_, i) => ({
			name: `Person ${i}`,
			email: `p${i}@example.com`
		}));
		const result = onboardingSchema.safeParse({ ...baseValid, stakeholders });
		expect(result.success).toBe(false);
	});

	it('rejects stakeholder with invalid email', () => {
		const result = onboardingSchema.safeParse({
			...baseValid,
			stakeholders: [{ name: 'Sam', email: 'not-an-email' }]
		});
		expect(result.success).toBe(false);
	});

	it('rejects cycleDurationWeeks below 4', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, cycleDurationWeeks: 3 });
		expect(result.success).toBe(false);
	});

	it('rejects cycleDurationWeeks above 26', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, cycleDurationWeeks: 27 });
		expect(result.success).toBe(false);
	});

	it('accepts boundary cycleDurationWeeks (4 and 26)', () => {
		expect(onboardingSchema.safeParse({ ...baseValid, cycleDurationWeeks: 4 }).success).toBe(true);
		expect(onboardingSchema.safeParse({ ...baseValid, cycleDurationWeeks: 26 }).success).toBe(true);
	});

	it('accepts stakeholderCadence "weekly", "biweekly", and "custom:N"', () => {
		for (const cadence of ['weekly', 'biweekly', 'custom:1', 'custom:14']) {
			const result = onboardingSchema.safeParse({ ...baseValid, stakeholderCadence: cadence });
			expect(result.success, `cadence ${cadence}`).toBe(true);
		}
	});

	it('rejects malformed custom cadence', () => {
		for (const bad of ['custom:', 'custom:abc', 'custom:-3', 'weekly2', 'random']) {
			const result = onboardingSchema.safeParse({ ...baseValid, stakeholderCadence: bad });
			expect(result.success, `cadence ${bad} should be rejected`).toBe(false);
		}
	});

	it('rejects invalid cycleStartDate', () => {
		const result = onboardingSchema.safeParse({ ...baseValid, cycleStartDate: 'not-a-date' });
		expect(result.success).toBe(false);
	});

	it('applies defaults for missing optional fields', () => {
		const result = onboardingSchema.safeParse({
			objectiveTitle: 'Build a daily writing habit'
		});
		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.subgoals).toEqual([]);
			expect(result.data.stakeholders).toEqual([]);
			expect(result.data.cycleDurationWeeks).toBe(12);
			expect(result.data.stakeholderCadence).toBe('weekly');
		}
	});
});
