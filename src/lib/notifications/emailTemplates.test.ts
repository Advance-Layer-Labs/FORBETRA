import { describe, it, expect } from 'vitest';
import { emailTemplates } from './emailTemplates';

describe('emailTemplates', () => {
	it('welcomeIndividual returns subject and html', () => {
		const result = emailTemplates.welcomeIndividual({ individualName: 'Alice' });
		expect(result.subject).toBe('Welcome to Forbetra');
		expect(result.html).toContain('Alice');
		expect(result.text).toContain('Alice');
	});

	it('welcomeIndividual handles missing name gracefully', () => {
		const result = emailTemplates.welcomeIndividual({});
		expect(result.html).toContain('there');
		expect(result.text).toContain('there');
	});

	it('feedbackInvite includes the individual name in subject', () => {
		const result = emailTemplates.feedbackInvite({
			individualName: 'Bob',
			feedbackLink: 'https://example.com/feedback'
		});
		expect(result.subject).toContain('Bob');
		expect(result.html).toContain('https://example.com/feedback');
	});

	it('feedbackInvite greets the reviewer and shows the goal', () => {
		const result = emailTemplates.feedbackInvite({
			individualName: 'Bob',
			reviewerName: 'Sam',
			goalTitle: 'Lead better meetings',
			feedbackLink: 'https://example.com/feedback'
		});
		expect(result.html).toContain('Sam');
		expect(result.html).toContain('Lead better meetings');
		expect(result.text).toContain('Goal: Lead better meetings');
	});

	it('reminderBase links to the check-in page without a type param', () => {
		const result = emailTemplates.reminderBase({ weekNumber: 4, appUrl: 'https://app.test' });
		expect(result.html).toContain('https://app.test/individual/checkin"');
		expect(result.text).toContain('https://app.test/individual/checkin');
		expect(result.html).not.toContain('?type=');
		expect(result.subject).not.toMatch(/Wednesday|Friday/);
	});

	it('reviewerFeedbackReceived produces valid output', () => {
		const result = emailTemplates.reviewerFeedbackReceived({
			individualName: 'Carol',
			reviewerName: 'Dave'
		});
		expect(result.subject).toContain('Dave');
		expect(result.html).toContain('Carol');
		expect(result.html).toContain('Dave');
	});

	it('all templates return non-empty subject and html', () => {
		const templates = [
			emailTemplates.welcomeIndividual({}),
			emailTemplates.welcomeReviewer({}),
			emailTemplates.feedbackInvite({ feedbackLink: 'https://test.com' }),
			emailTemplates.reviewerFeedbackReceived({}),
			emailTemplates.reminderBase({}),
			emailTemplates.reminderOverdue({}),
			emailTemplates.cycleCompleted({}),
			emailTemplates.reminderReviewerFeedback({ feedbackLink: 'https://test.com' }),
			emailTemplates.reviewerThankYou({ weekNumber: 3 }),
			emailTemplates.coachInvitation({
				coachName: 'Coach',
				inviteUrl: 'https://test.com'
			}),
			emailTemplates.coachClientAccepted({
				coachName: 'Coach',
				clientName: 'Client',
				clientEmail: 'c@test.com'
			}),
			emailTemplates.coachReviewerFeedbackReceived({
				coachName: 'Coach',
				individualName: 'Client'
			})
		];

		for (const template of templates) {
			expect(template.subject.length).toBeGreaterThan(0);
			expect(template.html.length).toBeGreaterThan(0);
			expect(template.text.length).toBeGreaterThan(0);
			for (const banned of [
				['Object', 'ive'].join(''),
				['Sub', 'goal'].join(''),
				['Stake', 'holder'].join(''),
				['STAKE', 'HOLDER'].join(''),
				['RATING', '_A'].join(''),
				['RATING', '_B'].join(''),
				['Reflection', 'Type'].join('')
			]) {
				expect(template.html).not.toContain(banned);
				expect(template.text).not.toContain(banned);
			}
		}
	});

	it('escapes HTML in user-provided names', () => {
		const result = emailTemplates.welcomeIndividual({
			individualName: '<script>alert("xss")</script>'
		});
		expect(result.html).not.toContain('<script>');
		expect(result.html).toContain('&lt;script&gt;');
	});
});
