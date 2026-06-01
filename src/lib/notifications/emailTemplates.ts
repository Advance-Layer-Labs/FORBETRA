export type EmailTemplateData = {
	individualName?: string;
	stakeholderName?: string;
	objectiveTitle?: string;
	cycleLabel?: string;
	feedbackLink?: string;
	weekNumber?: number;
	reflectionType?: string;
	appUrl?: string;
	currentStreak?: number;
};

export type MilestoneCelebrationData = {
	individualName: string;
	milestone: number;
	objectiveTitle?: string;
	appUrl?: string;
};

export type CoachInvitationData = {
	coachName: string;
	recipientName?: string;
	message?: string;
	inviteUrl: string;
};

export type CoachClientAcceptedData = {
	coachName: string;
	clientName: string;
	clientEmail: string;
	appUrl?: string;
};

export type CoachStakeholderFeedbackReceivedData = {
	coachName: string;
	individualName: string;
	stakeholderName?: string;
	weekNumber?: number;
	appUrl?: string;
};

const escapeHtml = (str: string) =>
	str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const baseUrl =
	process.env.PUBLIC_APP_URL || process.env.VERCEL_URL
		? `https://${process.env.PUBLIC_APP_URL || process.env.VERCEL_URL}`
		: 'https://app.forbetra.com';

const emailFooter = (settingsUrl?: string) => {
	const url = settingsUrl || `${baseUrl}/settings`;
	return `<div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
		<p style="font-size: 12px; color: #94a3b8; margin: 0;">Forbetra &mdash; You. And Improved.</p>
		<p style="font-size: 11px; color: #94a3b8; margin: 8px 0 0 0;">
			<a href="${url}" style="color: #94a3b8; text-decoration: underline;">Manage notification preferences</a>
		</p>
		<p style="font-size: 10px; color: #94a3b8; margin: 8px 0 0 0;">2358 University Ave., #265, San Diego, CA 92104</p>
	</div>`;
};

const textFooter = (settingsUrl?: string) => {
	const url = settingsUrl || `${baseUrl}/settings`;
	return `\n---\nForbetra — You. And Improved.\nManage notification preferences: ${url}\n2358 University Ave., #265, San Diego, CA 92104`;
};

export const emailTemplates = {
	welcomeIndividual: (data: EmailTemplateData) => {
		const name = escapeHtml(data.individualName || 'there');
		return {
			subject: 'Welcome to Forbetra',
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">Your development journey starts now</div>
				<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Welcome to Forbetra</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
					<p style="font-size: 16px;">You're all set! Your development journey starts now.</p>
					<p style="font-size: 16px;">Forbetra helps you turn development goals into measurable behaviors through structured check-ins and reviewer feedback.</p>
					<div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
						<p style="margin: 0; font-size: 14px; color: #64748b;"><strong>What's next?</strong></p>
						<ul style="margin: 12px 0 0 0; padding-left: 20px; font-size: 14px; color: #64748b;">
							<li>Complete your onboarding to set up your first goal</li>
							<li>Add reviewers who can provide feedback</li>
							<li>Start your weekly check-in journey</li>
						</ul>
					</div>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.appUrl || baseUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Get Started</a>
					</div>
					<p style="font-size: 14px; color: #64748b; margin-top: 30px;">Questions? Just reply to this email.</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `Welcome to Forbetra!\n\nHi ${data.individualName || 'there'},\n\nYou're all set! Your development journey starts now.\n\nForbetra helps you turn development goals into measurable behaviors through structured check-ins and reviewer feedback.\n\nWhat's next?\n- Complete your onboarding to set up your first goal\n- Add reviewers who can provide feedback\n- Start your weekly check-in journey\n\nGet started: ${data.appUrl || baseUrl}\n\nQuestions? Just reply to this email.${textFooter()}`
		};
	},

	welcomeStakeholder: (data: EmailTemplateData) => {
		const indName = escapeHtml(data.individualName || 'Someone');
		const shName = escapeHtml(data.stakeholderName || 'there');
		return {
			subject: `You've been invited to support ${data.individualName || 'someone'}'s growth journey`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">Help track development with quick feedback</div>
				<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">You're Invited</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${shName},</p>
					<p style="font-size: 16px;"><strong>${indName}</strong> has invited you to be a feedback provider in their development journey.</p>
					<p style="font-size: 16px;">Your role is simple: each time they check in, you'll receive a quick link to share feedback on their progress. It takes less than 60 seconds.</p>
					<div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
						<p style="margin: 0; font-size: 14px; color: #64748b;"><strong>What to expect:</strong></p>
						<ul style="margin: 12px 0 0 0; padding-left: 20px; font-size: 14px; color: #64748b;">
							<li>Brief feedback requests (2 quick questions)</li>
							<li>No account creation required</li>
							<li>Your feedback helps them track real progress</li>
						</ul>
					</div>
					<p style="font-size: 16px;">You'll receive your first feedback request when ${indName} submits their first check-in.</p>
					<p style="font-size: 14px; color: #64748b; margin-top: 30px;">Thank you for supporting their growth!</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `You've been invited to support ${data.individualName || 'someone'}'s growth journey\n\nHi ${data.stakeholderName || 'there'},\n\n${data.individualName || 'Someone'} has invited you to be a feedback provider in their development journey.\n\nYour role is simple: each time they check in, you'll receive a quick link to share feedback on their progress. It takes less than 60 seconds.\n\nWhat to expect:\n- Brief feedback requests (2 quick questions)\n- No account creation required\n- Your feedback helps them track real progress\n\nYou'll receive your first feedback request when ${data.individualName || 'they'} submits their first reflection.\n\nThank you for supporting their growth!${textFooter()}`
		};
	},

	feedbackInvite: (data: EmailTemplateData) => {
		const indName = escapeHtml(data.individualName || 'Your participant');
		const shName = escapeHtml(data.stakeholderName || 'there');
		const objTitle = data.objectiveTitle ? escapeHtml(data.objectiveTitle) : '';
		return {
			subject: `60-Second Feedback: How's ${data.individualName || 'Your Participant'} Doing?`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">Takes less than 60 seconds</div>
				<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Quick Feedback Request</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${shName},</p>
					<p style="font-size: 16px;"><strong>${indName}</strong> just completed a check-in and would love your feedback.</p>
					${objTitle ? `<p style="font-size: 14px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 20px 0;"><strong>Objective:</strong> ${objTitle}</p>` : ''}
					<p style="font-size: 16px;">This will take less than 60 seconds — just two quick questions about effort and progress.</p>
					<p style="font-size: 13px; color: #64748b; margin-top: 16px;">Forbetra is a secure coaching platform. Your feedback is shared only with ${indName} and their coach — never sold or used for any other purpose.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.feedbackLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Share Feedback</a>
					</div>
					<p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">This link expires in 10 days</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `60-Second Feedback: How's ${data.individualName || 'Your Participant'} Doing?\n\nHi ${data.stakeholderName || 'there'},\n\n${data.individualName || 'Your participant'} just completed a check-in and would love your feedback.\n\n${data.objectiveTitle ? `Objective: ${data.objectiveTitle}\n\n` : ''}This will take less than 60 seconds — just two quick questions about effort and progress.\n\nForbetra is a secure coaching platform. Your feedback is shared only with ${data.individualName || 'them'} and their coach — never sold or used for any other purpose.\n\nShare feedback: ${data.feedbackLink}\n\nThis link expires in 10 days${textFooter()}`
		};
	},

	stakeholderFeedbackReceived: (data: EmailTemplateData) => {
		const indName = escapeHtml(data.individualName || 'there');
		const shName = escapeHtml(data.stakeholderName || 'A reviewer');
		return {
			subject: `${data.stakeholderName || 'A reviewer'} shared feedback on your progress`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">See how your self-assessment aligns</div>
				<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Feedback Received</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${indName},</p>
					<p style="font-size: 16px;"><strong>${shName}</strong> just shared feedback on your progress.</p>
					<p style="font-size: 16px;">View your updated insights and see how your self-assessment aligns with their perspective.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.appUrl || baseUrl}/individual/insights" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Insights</a>
					</div>
					<p style="font-size: 14px; color: #64748b; margin-top: 30px;">Keep up the great work!</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `${data.stakeholderName || 'A reviewer'} shared feedback on your progress\n\nHi ${data.individualName || 'there'},\n\n${data.stakeholderName || 'A reviewer'} just shared feedback on your progress.\n\nView your updated insights and see how your self-assessment aligns with their perspective.\n\nView insights: ${data.appUrl || baseUrl}/individual/insights\n\nKeep up the great work!${textFooter()}`
		};
	},

	reminderBase: (data: EmailTemplateData) => {
		const dayLabel = data.reflectionType?.toUpperCase() === 'RATING_A' ? 'Wednesday' : 'Friday';
		const name = escapeHtml(data.individualName || 'there');
		const objTitle = data.objectiveTitle ? escapeHtml(data.objectiveTitle) : '';
		return {
			subject: `Reminder: Time for your ${dayLabel} check-in`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">A quick check-in on your progress</div>
					<div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Time for Your Check-in</h1>
					</div>
					<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
						<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
						<p style="font-size: 16px;">It's ${dayLabel} — time for your weekly check-in!</p>
						${objTitle ? `<p style="font-size: 14px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 20px 0;"><strong>Objective:</strong> ${objTitle}</p>` : ''}
						${data.currentStreak && data.currentStreak >= 3 ? `<p style="font-size: 16px; color: #c2410c; font-weight: 600;">You're on a ${data.currentStreak} check-in streak — keep it going!</p>` : ''}
						<p style="font-size: 16px;">Take a moment to check in on your effort and progress this week.</p>
						<div style="text-align: center; margin: 30px 0;">
							<a href="${data.appUrl || baseUrl}/individual/checkin?type=${(data.reflectionType ?? 'RATING_A').toUpperCase()}" style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Complete Check-in</a>
						</div>
						<p style="font-size: 14px; color: #64748b; margin-top: 30px;">Staying consistent helps you track your growth.</p>
					</div>
				${emailFooter()}
				</body>
				</html>
			`,
			text: `Reminder: Time for your ${dayLabel} check-in\n\nHi ${data.individualName || 'there'},\n\nIt's ${dayLabel} — time for your weekly check-in!\n\n${data.currentStreak && data.currentStreak >= 3 ? `You're on a ${data.currentStreak} check-in streak — keep it going!\n\n` : ''}${data.objectiveTitle ? `Objective: ${data.objectiveTitle}\n\n` : ''}Take a moment to check in on your effort and progress this week.\n\nComplete check-in: ${data.appUrl || baseUrl}/individual/checkin?type=${(data.reflectionType ?? 'RATING_A').toUpperCase()}\n\nThis helps you stay consistent and track your growth.${textFooter()}`
		};
	},

	reminderOverdue: (data: EmailTemplateData) => {
		const name = escapeHtml(data.individualName || 'there');
		const objTitle = data.objectiveTitle ? escapeHtml(data.objectiveTitle) : '';
		return {
			subject: `Reminder: You have overdue reflections`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">You have reflections waiting</div>
				<div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Overdue Reflections</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
					${data.currentStreak && data.currentStreak >= 3 ? `<p style="font-size: 16px; color: #c2410c; font-weight: 600;">You have a ${data.currentStreak} streak on the line — don't break it!</p>` : ''}
					<p style="font-size: 16px;">You have some overdue reflections that need your attention.</p>
					${objTitle ? `<p style="font-size: 14px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 20px 0;"><strong>Objective:</strong> ${objTitle}</p>` : ''}
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.appUrl || baseUrl}/individual" style="display: inline-block; background: #ef4444; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Dashboard</a>
					</div>
					<p style="font-size: 14px; color: #64748b; margin-top: 30px;">Catching up helps maintain your progress tracking.</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `Reminder: You have overdue reflections\n\nHi ${data.individualName || 'there'},\n\n${data.currentStreak && data.currentStreak >= 3 ? `You have a ${data.currentStreak} streak on the line — don't break it!\n\n` : ''}You have some overdue reflections that need your attention.\n\n${data.objectiveTitle ? `Objective: ${data.objectiveTitle}\n\n` : ''}View dashboard: ${data.appUrl || baseUrl}/individual\n\nCatching up helps maintain your progress tracking.${textFooter()}`
		};
	},

	cycleCompleted: (data: EmailTemplateData) => {
		const name = escapeHtml(data.individualName || 'there');
		const objTitle = data.objectiveTitle ? escapeHtml(data.objectiveTitle) : '';
		const cycle = data.cycleLabel ? escapeHtml(data.cycleLabel) : '';
		return {
			subject: 'Your journey is complete — your growth report is ready',
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">Your growth report is ready</div>
				<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Journey Complete!</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
					<p style="font-size: 16px;">Congratulations — you've completed your journey${cycle ? ` <strong>${cycle}</strong>` : ''}!</p>
					${objTitle ? `<p style="font-size: 14px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 20px 0;"><strong>Objective:</strong> ${objTitle}</p>` : ''}
					<p style="font-size: 16px;">Your growth report is ready — it summarizes your progress, key patterns, and areas for continued development.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.appUrl || baseUrl}/individual/insights" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">See Your Growth Report</a>
					</div>
					<p style="font-size: 14px; color: #64748b; margin-top: 30px;">When you're ready, start a new journey to keep growing.</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `Your cycle is complete — your growth report is ready\n\nHi ${data.individualName || 'there'},\n\nCongratulations — you've completed your cycle${data.cycleLabel ? ` "${data.cycleLabel}"` : ''}!\n\n${data.objectiveTitle ? `Objective: ${data.objectiveTitle}\n\n` : ''}Your growth report is ready — it summarizes your progress, key patterns, and areas for continued development.\n\nSee your growth report: ${data.appUrl || baseUrl}/individual/insights\n\nWhen you're ready, start a new journey to keep growing.${textFooter()}`
		};
	},

	reminderStakeholderFeedback: (data: EmailTemplateData) => {
		const indName = escapeHtml(data.individualName || 'your participant');
		return {
			subject: `Quick feedback for ${data.individualName || 'your participant'}`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
					<p style="font-size: 16px; margin: 0 0 16px 0;">${indName} would value your perspective this week.</p>
					<div style="text-align: center; margin: 16px 0;">
						<a href="${data.feedbackLink}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Rate now &rarr;</a>
					</div>
					<p style="font-size: 12px; color: #94a3b8; text-align: center; margin: 8px 0 0 0;">Takes ~30 seconds</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `Quick feedback for ${data.individualName || 'your participant'}\n\n${data.individualName || 'Your participant'} would value your perspective this week.\n\nRate now: ${data.feedbackLink}\n\nTakes ~30 seconds${textFooter()}`
		};
	},

	stakeholderThankYou: (data: EmailTemplateData) => {
		const indName = escapeHtml(data.individualName || 'your participant');
		const shName = escapeHtml(data.stakeholderName || 'there');
		return {
			subject: `Your feedback is now shaping ${data.individualName || 'your participant'}'s insights`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">Your perspective makes a difference</div>
				<div style="background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Thank You!</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${shName},</p>
					<p style="font-size: 16px;">Your Week ${data.weekNumber ?? ''} feedback for <strong>${indName}</strong> has been recorded.</p>
					<p style="font-size: 16px;">Your perspective matters — it helps reveal blind spots and validate progress that might otherwise go unnoticed.</p>
					<div style="background: #f5f3ff; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
						<p style="margin: 0; font-size: 14px; color: #6d28d9;">The gap between self-perception and external feedback is the most powerful growth signal.</p>
					</div>
					<p style="font-size: 14px; color: #64748b;">You'll receive the next feedback request when ${indName} completes their next check-in.</p>
				</div>
			${emailFooter(baseUrl)}
			</body>
			</html>
		`,
			text: `Your feedback is now shaping ${data.individualName || 'your participant'}'s insights\n\nHi ${data.stakeholderName || 'there'},\n\nYour Week ${data.weekNumber ?? ''} feedback for ${data.individualName || 'your participant'} has been recorded.\n\nYour perspective matters — it helps reveal blind spots and validate progress that might otherwise go unnoticed.\n\nYou'll receive the next feedback request when ${data.individualName || 'they'} completes their next check-in.${textFooter(baseUrl)}`
		};
	},

	stakeholderImpactSummary: (data: {
		stakeholderName?: string;
		individualName?: string;
		weeksContributed: number;
		totalFeedbacks: number;
		effortTrend: 'up' | 'down' | 'stable';
		performanceTrend: 'up' | 'down' | 'stable';
	}) => {
		const trendIcon = (trend: string) => (trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→');
		const trendLabel = (trend: string) =>
			trend === 'up' ? 'trending up' : trend === 'down' ? 'trending down' : 'stable';
		const indName = escapeHtml(data.individualName || 'your participant');
		const shName = escapeHtml(data.stakeholderName || 'there');
		return {
			subject: `Your impact on ${data.individualName || 'your participant'}'s growth — monthly summary`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">See your contribution this month</div>
					<div style="background: linear-gradient(135deg, #0891b2 0%, #06b6d4 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Your Impact Summary</h1>
					</div>
					<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
						<p style="font-size: 16px; margin-top: 0;">Hi ${shName},</p>
						<p style="font-size: 16px;">Here's a snapshot of your contribution to <strong>${indName}'s</strong> development this month.</p>
						<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin: 24px 0;">
							<tr>
								<td width="50%" style="padding-right: 6px;" valign="top">
									<div style="background: #f0fdfa; padding: 16px; border-radius: 8px; text-align: center;">
										<p style="margin: 0; font-size: 28px; font-weight: 700; color: #0d9488;">${data.weeksContributed}</p>
										<p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Weeks contributed</p>
									</div>
								</td>
								<td width="50%" style="padding-left: 6px;" valign="top">
									<div style="background: #f5f3ff; padding: 16px; border-radius: 8px; text-align: center;">
										<p style="margin: 0; font-size: 28px; font-weight: 700; color: #7c3aed;">${data.totalFeedbacks}</p>
										<p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Total feedbacks</p>
									</div>
								</td>
							</tr>
						</table>
						<div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
							<p style="margin: 0 0 12px 0; font-size: 14px; font-weight: 600; color: #334155;">Trends (based on your ratings):</p>
							<p style="margin: 0 0 6px 0; font-size: 14px; color: #64748b;">${trendIcon(data.effortTrend)} Effort: ${trendLabel(data.effortTrend)}</p>
							<p style="margin: 0; font-size: 14px; color: #64748b;">${trendIcon(data.performanceTrend)} Performance: ${trendLabel(data.performanceTrend)}</p>
						</div>
						<p style="font-size: 14px; color: #64748b;">Your continued feedback helps ${indName} stay accountable and see the full picture of their growth. Thank you!</p>
						<div style="background: #f0fdfa; padding: 20px; border-radius: 8px; margin: 24px 0; text-align: center;">
							<p style="font-size: 14px; color: #0d9488; font-weight: 600; margin: 0;">Keep the momentum going — when ${indName}'s next feedback request arrives, your response makes a real difference.</p>
						</div>
					</div>
				${emailFooter(baseUrl)}
				</body>
				</html>
			`,
			text: `Your impact on ${data.individualName || 'your participant'}'s growth — monthly summary\n\nHi ${data.stakeholderName || 'there'},\n\nHere's a snapshot of your contribution to ${data.individualName || 'your participant'}'s development this month.\n\nWeeks contributed: ${data.weeksContributed}\nTotal feedbacks: ${data.totalFeedbacks}\n\nTrends (based on your ratings):\n${trendIcon(data.effortTrend)} Effort: ${trendLabel(data.effortTrend)}\n${trendIcon(data.performanceTrend)} Performance: ${trendLabel(data.performanceTrend)}\n\nYour continued feedback helps ${data.individualName || 'them'} stay accountable and see the full picture of their growth. Thank you!${textFooter(baseUrl)}`
		};
	},

	coachInvitation: (data: CoachInvitationData) => {
		const coach = escapeHtml(data.coachName);
		const recipient = escapeHtml(data.recipientName || 'there');
		const msg = data.message ? escapeHtml(data.message) : '';
		return {
			subject: `${data.coachName} invited you to join Forbetra`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">Join a structured development program</div>
				<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">You're Invited</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${recipient},</p>
					<p style="font-size: 16px;"><strong>${coach}</strong> has invited you to join Forbetra — a platform for structured personal development.</p>
					${msg ? `<div style="background: #f1f5f9; padding: 16px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #6366f1;"><p style="margin: 0; font-size: 14px; color: #475569; font-style: italic;">"${msg}"</p><p style="margin: 8px 0 0 0; font-size: 13px; color: #64748b;">— ${coach}</p></div>` : ''}
					<div style="background: #f1f5f9; padding: 20px; border-radius: 8px; margin: 24px 0;">
						<p style="margin: 0; font-size: 14px; color: #64748b;"><strong>What to expect:</strong></p>
						<ul style="margin: 12px 0 0 0; padding-left: 20px; font-size: 14px; color: #64748b;">
							<li>Set a development goal and break it into observable behaviors</li>
							<li>Track your effort and performance with weekly check-ins</li>
							<li>Get feedback from stakeholders who see your work</li>
							<li>Receive AI-powered insights and coaching from ${coach}</li>
						</ul>
					</div>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1, #3b82f6); color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Accept Invitation</a>
					</div>
					<p style="font-size: 12px; color: #94a3b8; text-align: center; margin-top: 20px;">This invitation is valid for 30 days</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `${data.coachName} invited you to join Forbetra\n\nHi ${data.recipientName || 'there'},\n\n${data.coachName} has invited you to join Forbetra — a platform for structured personal development.\n\n${data.message ? `"${data.message}"\n— ${data.coachName}\n\n` : ''}What to expect:\n- Set a development goal and break it into observable behaviors\n- Track your effort and performance with weekly check-ins\n- Get feedback from stakeholders who see your work\n- Receive AI-powered insights and coaching from ${data.coachName}\n\nAccept invitation: ${data.inviteUrl}\n\nThis invitation is valid for 30 days${textFooter()}`
		};
	},

	coachClientAccepted: (data: CoachClientAcceptedData) => {
		const coach = escapeHtml(data.coachName);
		const client = escapeHtml(data.clientName);
		const clientEmail = escapeHtml(data.clientEmail);
		return {
			subject: `${data.clientName} accepted your Forbetra invitation`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">A new client has joined your roster</div>
				<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">New Client Joined</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${coach},</p>
					<p style="font-size: 16px;"><strong>${client}</strong> (${clientEmail}) has accepted your invitation and joined Forbetra.</p>
					<p style="font-size: 16px;">They'll now appear in your roster. Once they complete onboarding, you'll be able to view their reflections and generate coaching insights.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.appUrl || baseUrl}/coach/roster" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Roster</a>
					</div>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `${data.clientName} accepted your Forbetra invitation\n\nHi ${data.coachName},\n\n${data.clientName} (${data.clientEmail}) has accepted your invitation and joined Forbetra.\n\nThey'll now appear in your roster. Once they complete onboarding, you'll be able to view their reflections and generate coaching insights.\n\nView roster: ${data.appUrl || baseUrl}/coach/roster${textFooter()}`
		};
	},

	coachStakeholderFeedbackReceived: (data: CoachStakeholderFeedbackReceivedData) => {
		const coach = escapeHtml(data.coachName);
		const client = escapeHtml(data.individualName);
		const stakeholder = escapeHtml(data.stakeholderName || 'A reviewer');
		const week = data.weekNumber ? ` (Week ${data.weekNumber})` : '';
		return {
			subject: `Reviewer feedback received for ${data.individualName}${week}`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">New reviewer feedback for your client</div>
				<div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Reviewer Feedback Received</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${coach},</p>
					<p style="font-size: 16px;"><strong>${stakeholder}</strong> just submitted feedback for your client <strong>${client}</strong>${week}.</p>
					<p style="font-size: 16px;">Check your coaching dashboard to review updated insights and identify coaching opportunities.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${data.appUrl || baseUrl}/coach/roster" style="display: inline-block; background: #10b981; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Dashboard</a>
					</div>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `Reviewer feedback received for ${data.individualName}${week}\n\nHi ${data.coachName},\n\n${data.stakeholderName || 'A reviewer'} just submitted feedback for your client ${data.individualName}${week}.\n\nCheck your coaching dashboard to review updated insights and identify coaching opportunities.\n\nView dashboard: ${data.appUrl || baseUrl}/coach/roster${textFooter()}`
		};
	},

	milestoneCelebration: (data: MilestoneCelebrationData) => {
		const name = escapeHtml(data.individualName || 'there');
		const milestoneMessages: Record<number, { emoji: string; headline: string; body: string }> = {
			3: {
				emoji: '🔥',
				headline: 'First Streak!',
				body: "You've checked in 3 times in a row. Consistency is the first step to real growth."
			},
			7: {
				emoji: '⚡',
				headline: 'One Week Strong!',
				body: "7 consecutive check-ins. You're building a habit that compounds over time."
			},
			14: {
				emoji: '🏆',
				headline: 'Two-Week Powerhouse!',
				body: '14 straight check-ins — your commitment to growth is showing up in the data.'
			},
			21: {
				emoji: '🌟',
				headline: 'Three Weeks of Momentum!',
				body: '21 check-ins without missing a beat. Research says habits form around this mark.'
			},
			30: {
				emoji: '💎',
				headline: 'A Full Month!',
				body: '30 consecutive check-ins. Your dedication to self-improvement is exceptional.'
			},
			50: {
				emoji: '👑',
				headline: 'Elite Commitment!',
				body: '50 straight check-ins — you are in rare company. Keep leading by example.'
			}
		};
		const m = milestoneMessages[data.milestone] ?? {
			emoji: '🎉',
			headline: `${data.milestone} Check-in Streak!`,
			body: `You've hit ${data.milestone} consecutive check-ins. Keep the momentum going!`
		};
		const objLine = data.objectiveTitle
			? `<p style="font-size: 14px; color: #64748b; background: #f1f5f9; padding: 12px; border-radius: 6px; margin: 20px 0;"><strong>Goal:</strong> ${escapeHtml(data.objectiveTitle)}</p>`
			: '';

		return {
			subject: `${m.emoji} ${m.headline} — ${data.milestone} check-ins in a row!`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #ffffff;">${m.headline} — ${data.milestone} consecutive check-ins</div>
					<div style="background: linear-gradient(135deg, #f59e0b 0%, #ef4444 100%); padding: 40px 30px; text-align: center; border-radius: 12px 12px 0 0;">
						<p style="font-size: 48px; margin: 0 0 10px 0;">${m.emoji}</p>
						<h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">${m.headline}</h1>
						<p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 16px;">${data.milestone} consecutive check-ins</p>
					</div>
					<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
						<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
						<p style="font-size: 16px;">${m.body}</p>
						${objLine}
						<div style="text-align: center; margin: 30px 0;">
							<a href="${data.appUrl || baseUrl}/individual" style="display: inline-block; background: #f59e0b; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">View Your Progress</a>
						</div>
					</div>
				${emailFooter()}
				</body>
				</html>
			`,
			text: `${m.emoji} ${m.headline}\n\nHi ${data.individualName},\n\n${m.body}\n\n${data.objectiveTitle ? `Goal: ${data.objectiveTitle}\n\n` : ''}View your progress: ${data.appUrl || baseUrl}/individual${textFooter()}`
		};
	},

	stakeholderRequestedNewLink: (data: EmailTemplateData) => {
		const indName = escapeHtml(data.individualName || 'there');
		const shName = escapeHtml(data.stakeholderName || 'A reviewer');
		const stakeholdersUrl = `${data.appUrl || baseUrl}/individual/stakeholders`;
		return {
			subject: `${data.stakeholderName || 'A reviewer'} requested a new feedback link`,
			html: `
			<!DOCTYPE html>
			<html>
			<head>
				<meta charset="utf-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
			</head>
			<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
				<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
					<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">A reviewer needs a fresh link</h1>
				</div>
				<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
					<p style="font-size: 16px; margin-top: 0;">Hi ${indName},</p>
					<p style="font-size: 16px;"><strong>${shName}</strong> tried to use a feedback link that had expired or already been used.</p>
					<p style="font-size: 16px;">They're ready to give you feedback — you just need to send them a new link from your reviewer settings.</p>
					<div style="text-align: center; margin: 30px 0;">
						<a href="${stakeholdersUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">Manage reviewers</a>
					</div>
					<p style="font-size: 14px; color: #64748b;">If this reviewer is no longer relevant, you can archive them on the same page.</p>
				</div>
			${emailFooter()}
			</body>
			</html>
		`,
			text: `A reviewer needs a fresh feedback link\n\nHi ${data.individualName || 'there'},\n\n${data.stakeholderName || 'A reviewer'} tried to use a feedback link that had expired or already been used. They're ready to give you feedback — you just need to send them a new link from your reviewer settings.\n\nManage reviewers: ${stakeholdersUrl}\n\nIf this reviewer is no longer relevant, you can archive them on the same page.${textFooter()}`
		};
	},

	individualMonthlySummary: (data: {
		individualName?: string;
		objectiveTitle: string;
		checkInCount: number;
		feedbackCount: number;
		myEffortThis: number | null;
		myPerfThis: number | null;
		reviewerEffortThis: number | null;
		reviewerPerfThis: number | null;
		gapDelta: number | null; // positive = gap widening, negative = closing
	}) => {
		const name = escapeHtml(data.individualName || 'there');
		const obj = escapeHtml(data.objectiveTitle);
		const hubUrl = `${baseUrl}/individual`;

		const trendLine = (() => {
			if (data.gapDelta === null) return null;
			const abs = Math.abs(data.gapDelta).toFixed(1);
			if (data.gapDelta < -0.3) return `Your perception gap closed by ${abs} this month.`;
			if (data.gapDelta > 0.3)
				return `Your perception gap widened by ${abs} this month — worth a look.`;
			return `Your perception gap held steady this month.`;
		})();

		const statRow = (label: string, value: string | null) =>
			value === null
				? ''
				: `<tr><td style="padding: 4px 12px 4px 0; color: #64748b; font-size: 13px;">${label}</td><td style="padding: 4px 0; color: #0f172a; font-size: 14px; font-weight: 600;">${value}</td></tr>`;

		return {
			subject: `Your Forbetra month — ${data.checkInCount} check-in${data.checkInCount === 1 ? '' : 's'}, ${data.feedbackCount} reviewer response${data.feedbackCount === 1 ? '' : 's'}`,
			html: `
				<!DOCTYPE html>
				<html>
				<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 24px; font-weight: 600;">Your month in motion</h1>
						<p style="color: rgba(255,255,255,0.85); margin: 6px 0 0; font-size: 14px;">A snapshot of the last 30 days on Forbetra</p>
					</div>
					<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
						<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
						<p style="font-size: 16px;">Here's what happened this month on <strong>${obj}</strong>.</p>
						<div style="background: #f1f5f9; padding: 18px 20px; border-radius: 8px; margin: 20px 0;">
							<table style="width: 100%; border-collapse: collapse;">
								${statRow('Check-ins completed', String(data.checkInCount))}
								${statRow('Reviewer responses received', String(data.feedbackCount))}
								${statRow('Your effort (avg)', data.myEffortThis !== null ? data.myEffortThis.toFixed(1) : null)}
								${statRow('Your performance (avg)', data.myPerfThis !== null ? data.myPerfThis.toFixed(1) : null)}
								${statRow('Reviewer effort (avg)', data.reviewerEffortThis !== null ? data.reviewerEffortThis.toFixed(1) : null)}
								${statRow('Reviewer performance (avg)', data.reviewerPerfThis !== null ? data.reviewerPerfThis.toFixed(1) : null)}
							</table>
						</div>
						${trendLine ? `<p style="font-size: 15px; color: #334155; margin: 16px 0;">${escapeHtml(trendLine)}</p>` : ''}
						<div style="text-align: center; margin: 28px 0;">
							<a href="${hubUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">Open your hub</a>
						</div>
						<p style="font-size: 13px; color: #64748b;">Keep showing up. The compounding is real.</p>
					</div>
				${emailFooter()}
				</body>
				</html>
			`,
			text: `Your Forbetra month\n\nHi ${data.individualName || 'there'},\n\nHere's what happened this month on ${data.objectiveTitle}.\n\n• Check-ins completed: ${data.checkInCount}\n• Reviewer responses: ${data.feedbackCount}\n${data.myEffortThis !== null ? `• Your effort (avg): ${data.myEffortThis.toFixed(1)}\n` : ''}${data.myPerfThis !== null ? `• Your performance (avg): ${data.myPerfThis.toFixed(1)}\n` : ''}${data.reviewerEffortThis !== null ? `• Reviewer effort (avg): ${data.reviewerEffortThis.toFixed(1)}\n` : ''}${data.reviewerPerfThis !== null ? `• Reviewer performance (avg): ${data.reviewerPerfThis.toFixed(1)}\n` : ''}${trendLine ? `\n${trendLine}\n` : ''}\nOpen your hub: ${hubUrl}\n\nKeep showing up. The compounding is real.${textFooter()}`
		};
	},

	scorecardShiftAlert: (data: {
		individualName?: string;
		objectiveTitle: string;
		dimension: 'effort' | 'performance';
		direction: 'widening' | 'closing';
		gapNow: number;
		gapBefore: number;
		deltaAbs: number;
	}) => {
		const name = escapeHtml(data.individualName || 'there');
		const obj = escapeHtml(data.objectiveTitle);
		const feedbackUrl = `${baseUrl}/individual/feedback`;
		const dim = data.dimension;
		const dir = data.direction;
		const sign = (n: number) => (n > 0 ? '+' : '') + n.toFixed(1);
		const narrative =
			dir === 'widening'
				? `Your ${dim} gap widened from ${sign(data.gapBefore)} to ${sign(data.gapNow)} this week — your view of yourself and your reviewers' view are drifting apart.`
				: `Your ${dim} gap closed from ${sign(data.gapBefore)} to ${sign(data.gapNow)} this week — you and your reviewers are converging on what's happening.`;
		const sub =
			dir === 'widening'
				? `Your scorecard gap on ${dim} just widened ${data.deltaAbs.toFixed(1)} points`
				: `Your scorecard gap on ${dim} just closed ${data.deltaAbs.toFixed(1)} points`;
		return {
			subject: sub,
			html: `
				<!DOCTYPE html>
				<html>
				<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #334155; max-width: 600px; margin: 0 auto; padding: 20px;">
					<div style="background: linear-gradient(135deg, #3b82f6 0%, #6366f1 100%); padding: 30px; text-align: center; border-radius: 12px 12px 0 0;">
						<h1 style="color: white; margin: 0; font-size: 22px; font-weight: 600;">Your scorecard shifted this week</h1>
					</div>
					<div style="background: white; padding: 30px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
						<p style="font-size: 16px; margin-top: 0;">Hi ${name},</p>
						<p style="font-size: 16px;">Something interesting happened in <strong>${obj}</strong> this week.</p>
						<p style="font-size: 16px;">${escapeHtml(narrative)}</p>
						<div style="text-align: center; margin: 28px 0;">
							<a href="${feedbackUrl}" style="display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">See what changed</a>
						</div>
						<p style="font-size: 13px; color: #64748b;">Positive gap (your score &gt; reviewers') usually means you see yourself more favorably than they do. Negative means the reverse.</p>
					</div>
				${emailFooter()}
				</body>
				</html>
			`,
			text: `${sub}\n\nHi ${data.individualName || 'there'},\n\nSomething interesting happened in ${data.objectiveTitle} this week.\n\n${narrative}\n\nSee what changed: ${feedbackUrl}\n\nPositive gap (your score > reviewers') usually means you see yourself more favorably than they do. Negative means the reverse.${textFooter()}`
		};
	}
};
