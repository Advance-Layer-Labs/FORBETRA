import { describe, expect, it } from 'vitest';
import { reviewerContextForTemplate } from './onboardingTemplates';
import {
	REVIEWER_RELATIONSHIPS,
	relationshipTooltipForContext,
	relationshipsForContext
} from './reviewerRelationships';

describe('relationship options by goal context', () => {
	it('lists sports roles before workplace titles for a sports goal', () => {
		const options = relationshipsForContext(reviewerContextForTemplate('sports-composure'));
		expect(options[0]).toBe('Coach');
		expect(options.indexOf('Coach')).toBeLessThan(options.indexOf('Direct Manager'));
		expect(options).toEqual(expect.arrayContaining([...REVIEWER_RELATIONSHIPS]));
		expect(relationshipTooltipForContext('sports').toLowerCase()).not.toContain('skip-level');
	});

	it('keeps workplace titles first for a business goal', () => {
		const options = relationshipsForContext(
			reviewerContextForTemplate('business-executive-presence')
		);
		expect(options[0]).toBe('Direct Manager');
		expect(relationshipTooltipForContext('business')).toContain('Skip-level');
	});

	it('lists peer and mentor ahead of workplace titles for a military goal', () => {
		const options = relationshipsForContext(
			reviewerContextForTemplate('military-situational-awareness')
		);
		expect(options[0]).toBe('Peer');
		expect(options.indexOf('Mentor')).toBeLessThan(options.indexOf('Direct Manager'));
		expect(relationshipTooltipForContext('military').toLowerCase()).not.toContain('skip-level');
	});

	it('uses neutral copy when the goal has no template', () => {
		const options = relationshipsForContext(reviewerContextForTemplate(null));
		expect(options[0]).toBe('Coach');
		expect(relationshipTooltipForContext('neutral').toLowerCase()).not.toContain('skip-level');
		expect(options).toHaveLength(REVIEWER_RELATIONSHIPS.length);
	});
});
