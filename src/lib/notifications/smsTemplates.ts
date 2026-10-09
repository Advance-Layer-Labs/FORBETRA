const baseUrl =
	process.env.PUBLIC_APP_URL || process.env.VERCEL_URL
		? `https://${process.env.PUBLIC_APP_URL || process.env.VERCEL_URL}`
		: 'https://app.forbetra.com';

export const smsTemplates = {
	welcomeIndividual: (data: { individualName?: string; appUrl?: string }) => {
		const name = data.individualName || 'there';
		return `Welcome to Forbetra, ${name}! Your development journey starts now. Get started: ${data.appUrl || baseUrl}\n\nReply STOP to opt out`;
	},

	reminderBase: (data: { weekNumber: number; appUrl?: string }) => {
		const url = `${data.appUrl || baseUrl}/individual/checkin`;
		return `Forbetra: Time for your weekly check-in (Week ${data.weekNumber}). ${url}\n\nReply STOP to opt out`;
	},

	reminderOverdue: (data: { appUrl?: string }) => {
		return `Forbetra: You have overdue check-ins. Catch up now: ${data.appUrl || baseUrl}/individual/checkin\n\nReply STOP to opt out`;
	},

	welcomeReviewer: (data: {
		reviewerName?: string;
		individualName?: string;
		appUrl?: string;
	}) => {
		const name = data.individualName || 'someone';
		return `Forbetra: ${name} added you as a feedback provider. You'll occasionally be asked to rate their performance — takes <60 seconds.\n\nReply STOP to opt out`;
	},

	feedbackInvite: (data: {
		individualName?: string;
		reviewerName?: string;
		goalTitle?: string;
		feedbackLink: string;
	}) => {
		const name = data.individualName || 'your participant';
		const greeting = data.reviewerName ? `Hi ${data.reviewerName}, ` : '';
		const goal = data.goalTitle ? ` on "${data.goalTitle}"` : '';
		return `Forbetra: ${greeting}${name} needs your feedback${goal}. Takes <60 seconds: ${data.feedbackLink}\n\nReply STOP to opt out`;
	},

	reviewerFeedbackReceived: (data: { reviewerName?: string; appUrl?: string }) => {
		const name = data.reviewerName || 'A reviewer';
		return `Forbetra: ${name} just shared feedback on your progress. View insights: ${data.appUrl || baseUrl}/individual/insights\n\nReply STOP to opt out`;
	},

	reviewerThankYou: (data: { individualName?: string; weekNumber: number }) => {
		const name = data.individualName || 'your participant';
		return `Forbetra: Thanks for your Week ${data.weekNumber} feedback on ${name}. Your perspective helps them grow.\n\nReply STOP to opt out`;
	},

	reminderReviewerFeedback: (data: { individualName?: string; feedbackLink: string }) => {
		const name = data.individualName || 'your participant';
		return `Forbetra reminder: ${name} is waiting for your feedback. Any earlier link still works. Takes <60 sec: ${data.feedbackLink}\n\nReply STOP to opt out`;
	},

	reviewerImpactSummary: (data: {
		individualName?: string;
		weeksContributed: number;
		totalFeedbacks: number;
	}) => {
		const name = data.individualName || 'your participant';
		return `Forbetra: Your monthly impact on ${name} — ${data.weeksContributed} weeks, ${data.totalFeedbacks} feedbacks. Thank you!\n\nReply STOP to opt out`;
	},

	cycleCompleted: (data: { goalTitle?: string; appUrl?: string }) => {
		const obj = data.goalTitle ? ` for "${data.goalTitle}"` : '';
		return `Forbetra: Your journey${obj} is complete! View your growth report: ${data.appUrl || baseUrl}/individual/insights\n\nReply STOP to opt out`;
	},

	coachInvitation: (data: { coachName?: string; inviteUrl: string }) => {
		const coach = data.coachName || 'Your coach';
		return `Forbetra: ${coach} invited you to join their development program. Get started: ${data.inviteUrl}\n\nReply STOP to opt out`;
	},

	coachClientAccepted: (data: { clientName: string; appUrl?: string }) => {
		return `Forbetra: ${data.clientName} accepted your invitation and joined your roster. ${data.appUrl || baseUrl}/coach/roster\n\nReply STOP to opt out`;
	},

	milestoneCelebration: (data: { milestone: number; goalTitle?: string; appUrl?: string }) => {
		const goal = data.goalTitle ? ` on ${data.goalTitle}` : '';
		return `Forbetra: ${data.milestone} check-ins in a row${goal}. Keep going: ${data.appUrl || baseUrl}/individual/progress\n\nReply STOP to opt out`;
	},

	individualMonthlySummary: (data: {
		goalTitle?: string;
		checkInCount: number;
		feedbackCount: number;
		appUrl?: string;
	}) => {
		const goal = data.goalTitle ? ` on ${data.goalTitle}` : '';
		return `Forbetra: Your month${goal}: ${data.checkInCount} check-ins, ${data.feedbackCount} reviewer responses. ${data.appUrl || baseUrl}/individual/progress\n\nReply STOP to opt out`;
	},

	scorecardShiftAlert: (data: {
		dimension: string;
		direction: 'widening' | 'closing';
		appUrl?: string;
	}) => {
		return `Forbetra: Your ${data.dimension} perception gap is ${data.direction}. See the scorecard: ${data.appUrl || baseUrl}/individual/scorecard\n\nReply STOP to opt out`;
	},

	reviewerRequestedNewLink: (data: { reviewerName?: string; appUrl?: string }) => {
		const name = data.reviewerName || 'A reviewer';
		return `Forbetra: ${name} needs a new feedback link. Send one: ${data.appUrl || baseUrl}/individual/stakeholders\n\nReply STOP to opt out`;
	},

	coachReviewerFeedbackReceived: (data: {
		reviewerName?: string;
		individualName?: string;
		weekNumber?: number;
		appUrl?: string;
	}) => {
		const reviewer = data.reviewerName || 'A reviewer';
		const client = data.individualName || 'a client';
		const week = data.weekNumber != null ? ` (Week ${data.weekNumber})` : '';
		const url = `${data.appUrl || baseUrl}/coach/roster`;
		return `Forbetra: ${reviewer} submitted feedback for your client ${client}${week}. ${url}\n\nReply STOP to opt out`;
	}
};
