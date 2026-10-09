import { describe, it, expect } from 'vitest';
import { smsTemplates } from './smsTemplates';

describe('smsTemplates', () => {
	it('welcomeIndividual returns a greeting with the name', () => {
		const result = smsTemplates.welcomeIndividual({ individualName: 'Alice' });
		expect(result).toContain('Alice');
		expect(result).toContain('Forbetra');
	});

	it('welcomeIndividual uses fallback name when missing', () => {
		const result = smsTemplates.welcomeIndividual({});
		expect(result).toContain('there');
	});

	it('reminderBase includes the week and links to the check-in page', () => {
		const result = smsTemplates.reminderBase({ weekNumber: 3, appUrl: 'https://app.test' });
		expect(result).toContain('Week 3');
		expect(result).toContain('https://app.test/individual/checkin');
		expect(result).not.toContain('?type=');
	});

	it('feedbackInvite mentions the reviewer and goal when provided', () => {
		const result = smsTemplates.feedbackInvite({
			individualName: 'Alice',
			reviewerName: 'Sam',
			goalTitle: 'Lead better meetings',
			feedbackLink: 'https://test.com/f'
		});
		expect(result).toContain('Sam');
		expect(result).toContain('Lead better meetings');
		expect(result).toContain('https://test.com/f');
	});

	it('all templates return non-empty strings', () => {
		const results = [
			smsTemplates.welcomeIndividual({}),
			smsTemplates.reminderBase({ weekNumber: 1 }),
			smsTemplates.reminderOverdue({}),
			smsTemplates.welcomeReviewer({}),
			smsTemplates.feedbackInvite({ feedbackLink: 'https://test.com' }),
			smsTemplates.reviewerFeedbackReceived({}),
			smsTemplates.reviewerThankYou({ weekNumber: 2 }),
			smsTemplates.reminderReviewerFeedback({ feedbackLink: 'https://test.com' }),
			smsTemplates.reviewerImpactSummary({
				weeksContributed: 4,
				totalFeedbacks: 8
			}),
			smsTemplates.cycleCompleted({}),
			smsTemplates.coachInvitation({ inviteUrl: 'https://test.com' }),
			smsTemplates.coachClientAccepted({ clientName: 'Bob' }),
			smsTemplates.milestoneCelebration({ milestone: 7 }),
			smsTemplates.individualMonthlySummary({ checkInCount: 4, feedbackCount: 2 }),
			smsTemplates.scorecardShiftAlert({ dimension: 'effort', direction: 'closing' }),
			smsTemplates.reviewerRequestedNewLink({}),
			smsTemplates.coachReviewerFeedbackReceived({
				reviewerName: 'Sam',
				individualName: 'Alice',
				weekNumber: 2
			})
		];

		for (const result of results) {
			expect(typeof result).toBe('string');
			expect(result.length).toBeGreaterThan(0);
		}
	});

	it('coach reviewer feedback includes STOP and the client', () => {
		const result = smsTemplates.coachReviewerFeedbackReceived({
			reviewerName: 'Sam',
			individualName: 'Alice',
			weekNumber: 4,
			appUrl: 'https://app.test'
		});
		expect(result).toContain('Sam');
		expect(result).toContain('Alice');
		expect(result).toContain('Week 4');
		expect(result).toContain('https://app.test/coach/roster');
		expect(result).toContain('Reply STOP to opt out');
	});

	it('reviewerThankYou includes week number', () => {
		const result = smsTemplates.reviewerThankYou({ weekNumber: 7 });
		expect(result).toContain('Week 7');
	});

	it('uses the new vocabulary only', () => {
		const all = [
			smsTemplates.reminderBase({ weekNumber: 1 }),
			smsTemplates.reminderOverdue({}),
			smsTemplates.welcomeReviewer({}),
			smsTemplates.feedbackInvite({ feedbackLink: 'https://test.com' })
		].join('\n');
		for (const banned of [
			['Object', 'ive'].join(''),
			['Sub', 'goal'].join(''),
			['Stake', 'holder'].join(''),
			['STAKE', 'HOLDER'].join(''),
			['RATING', '_A'].join(''),
			['RATING', '_B'].join('')
		]) {
			expect(all).not.toContain(banned);
		}
	});
});
