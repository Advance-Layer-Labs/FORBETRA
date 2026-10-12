import { describe, expect, it } from 'vitest';
import { reviewerPromptForTemplate } from './onboardingTemplates';

describe('reviewerPromptForTemplate', () => {
	it('uses the sports template roles instead of workplace titles', () => {
		const prompt = reviewerPromptForTemplate('sports-composure');
		expect(prompt.roles.join(' ')).toContain('Coach');
		expect(prompt.intro.toLowerCase()).not.toContain('direct manager');
	});

	it('falls back to context-neutral copy for a typed goal', () => {
		const prompt = reviewerPromptForTemplate(null);
		expect(prompt.intro).toContain('coach, manager, teammate, peer, or mentor');
		expect(prompt.roles).toContain('Teammate or peer');
	});
});
