import { fail, redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { reviewerFeedbackSchema } from '$lib/validation/feedback';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { rateLimit } from '$lib/server/rateLimit';
import { hashToken } from '$lib/server/tokenHash';
import {
	average,
	DuplicateFeedbackError,
	submitFeedback,
	weekNumberForDate
} from '$lib/server/domain';
import type { Actions, PageServerLoad } from './$types';

const INVALID_PATH = '/stakeholder/invalid';

const sanitizeToken = (value: string | undefined) => {
	if (!value) return null;
	return /^[a-f0-9]{64}$/i.test(value) ? value : null;
};

const roundOne = (value: number | null) => (value === null ? null : Math.round(value * 10) / 10);

export const load: PageServerLoad = async ({ params, url }) => {
	const isPreview = url.searchParams.get('preview') === 'true';

	if (isPreview && params.token === 'preview') {
		return {
			token: 'preview',
			reviewer: {
				id: 'preview',
				name: 'Sample Reviewer',
				phone: null as string | null
			},
			invite: {
				weekNumber: 3,
				journeyLabel: 'Q1 2026 Leadership Journey',
				participantName: 'John Doe',
				goalTitle: 'Improve executive presence'
			},
			focusAreas: [
				{
					label: 'Active listening in meetings',
					description: 'Make eye contact, paraphrase others, ask clarifying questions'
				},
				{
					label: 'Confident presentations',
					description: 'Speak with clear structure and conviction in team updates'
				}
			],
			isPreview: true,
			isAlreadySubmitted: false,
			isFirstFeedback: true,
			previousRatings: {
				weekNumber: 2,
				effortScore: 7 as number | null,
				performanceScore: 6 as number | null
			},
			historicRatings: [
				{ weekNumber: 2, effortScore: 7 as number | null, performanceScore: 6 as number | null },
				{ weekNumber: 1, effortScore: 6 as number | null, performanceScore: 5 as number | null }
			],
			feedbackCount: 0
		};
	}

	const tokenParam = sanitizeToken(params.token);
	if (!tokenParam) {
		throw redirect(302, INVALID_PATH);
	}

	const token = await prisma.token.findUnique({
		where: { tokenHash: hashToken(tokenParam) },
		include: {
			reviewer: true,
			journey: {
				include: {
					user: { select: { name: true } },
					goal: {
						include: {
							focusAreas: {
								where: { active: true },
								orderBy: [{ order: 'asc' }, { createdAt: 'asc' }]
							}
						}
					}
				}
			}
		}
	});

	if (
		!token ||
		token.type !== 'FEEDBACK_INVITE' ||
		!token.reviewer ||
		!token.journey ||
		!token.reviewerId ||
		!token.journeyId ||
		token.weekNumber === null
	) {
		throw redirect(302, INVALID_PATH);
	}

	const weekNumber = token.weekNumber;

	const existingFeedback = await prisma.feedback.findUnique({
		where: {
			reviewerId_journeyId_weekNumber: {
				reviewerId: token.reviewerId,
				journeyId: token.journeyId,
				weekNumber
			}
		},
		select: { id: true }
	});

	const isAlreadySubmitted = !!token.usedAt || !!existingFeedback;

	// Expiry is checked after the submitted state so returning reviewers see
	// "already submitted" instead of an invalid-link page.
	if (!isAlreadySubmitted && token.expiresAt < new Date()) {
		throw redirect(302, INVALID_PATH);
	}

	const priorFeedback = await prisma.feedback.findMany({
		where: {
			reviewerId: token.reviewerId,
			journeyId: token.journeyId,
			weekNumber: { lt: weekNumber }
		},
		orderBy: { weekNumber: 'desc' },
		select: { weekNumber: true, effortScore: true, performanceScore: true }
	});

	const historicRatings = priorFeedback.map((feedback) => ({
		weekNumber: feedback.weekNumber,
		effortScore: feedback.effortScore,
		performanceScore: feedback.performanceScore
	}));
	const previousRatings = historicRatings[0] ?? null;
	const isFirstFeedback = historicRatings.length === 0;

	const feedbackCount = await prisma.feedback.count({
		where: { reviewerId: token.reviewerId }
	});

	const focusAreas = token.journey.goal.focusAreas.map((focusArea) => ({
		label: focusArea.label,
		description: focusArea.description
	}));

	return {
		// Pass the URL value (plaintext) through, not the stored hash. The action
		// re-hashes it on submit to look up the token.
		token: tokenParam,
		reviewer: {
			id: token.reviewer.id,
			name: token.reviewer.name,
			phone: token.reviewer.phone
		},
		invite: {
			weekNumber,
			journeyLabel: token.journey.label ?? 'Journey',
			participantName: token.journey.user.name ?? 'Participant',
			goalTitle: token.journey.goal.title?.trim() || 'the goal'
		},
		focusAreas,
		isPreview: false,
		isAlreadySubmitted,
		isFirstFeedback,
		previousRatings,
		historicRatings,
		feedbackCount
	};
};

export const actions: Actions = {
	default: async ({ params, request, url, getClientAddress }) => {
		const clientIP = getClientAddress();
		if (!(await rateLimit(`feedback:${clientIP}`, 10, 60_000))) {
			return fail(429, { error: 'Too many requests. Please try again later.' });
		}

		const isPreview = url.searchParams.get('preview') === 'true';
		if (isPreview && params.token === 'preview') {
			return fail(400, { error: 'Preview mode - submissions are disabled.' });
		}

		const tokenParam = sanitizeToken(params.token);
		if (!tokenParam) {
			return fail(400, { error: 'Invalid or expired feedback token.' });
		}

		const formData = await request.formData();
		const payload = Object.fromEntries(formData) as Record<string, string>;
		payload.token = tokenParam;

		const parsed = reviewerFeedbackSchema.safeParse(payload);
		if (!parsed.success) {
			const errors = parsed.error.flatten();
			return fail(400, {
				error:
					errors.formErrors[0] ?? errors.fieldErrors.comment?.[0] ?? 'Invalid feedback submission.'
			});
		}

		const data = parsed.data;

		const token = await prisma.token.findUnique({
			where: { tokenHash: hashToken(data.token) },
			select: {
				id: true,
				type: true,
				usedAt: true,
				expiresAt: true,
				reviewerId: true,
				journeyId: true,
				weekNumber: true
			}
		});

		if (
			!token ||
			token.type !== 'FEEDBACK_INVITE' ||
			!token.reviewerId ||
			!token.journeyId ||
			token.weekNumber === null
		) {
			return fail(400, { error: 'This feedback link is no longer valid.' });
		}

		if (token.usedAt) {
			return fail(409, { alreadySubmitted: true });
		}

		if (token.expiresAt < new Date()) {
			return fail(400, {
				error: 'This feedback link has expired.',
				expired: true
			});
		}

		const reviewerId = token.reviewerId;
		const journeyId = token.journeyId;
		const weekNumber = token.weekNumber;

		try {
			await submitFeedback({
				journeyId,
				reviewerId,
				weekNumber,
				effortScore: data.effortScore ?? null,
				performanceScore: data.performanceScore ?? null,
				comment: data.comment ?? null,
				behavioralObservation: data.behavioralObservation ?? null,
				suggestion: data.suggestion ?? null
			});
		} catch (error) {
			if (error instanceof DuplicateFeedbackError) {
				await prisma.token.update({ where: { id: token.id }, data: { usedAt: new Date() } });
				return fail(409, { alreadySubmitted: true });
			}
			throw error;
		}

		await prisma.token.update({
			where: { id: token.id },
			data: { usedAt: new Date() }
		});

		const [reviewer, journey] = await Promise.all([
			prisma.reviewer.findUnique({
				where: { id: reviewerId },
				select: {
					name: true,
					email: true,
					phone: true,
					individual: {
						select: { id: true, name: true, email: true, phone: true, deliveryMethod: true }
					}
				}
			}),
			prisma.journey.findUnique({
				where: { id: journeyId },
				select: {
					startDate: true,
					user: { select: { name: true, timezone: true } },
					checkIns: {
						select: { effortScore: true, performanceScore: true, submittedAt: true }
					}
				}
			})
		]);

		const participantName = journey?.user.name ?? 'Participant';

		// Send notification email to individual when reviewer submits feedback
		if (reviewer?.individual && wantsEmail(reviewer.individual.deliveryMethod)) {
			try {
				const template = emailTemplates.reviewerFeedbackReceived({
					individualName: reviewer.individual.name || undefined,
					reviewerName: reviewer.name || undefined,
					appUrl: url.origin
				});
				await sendEmail({
					to: reviewer.individual.email,
					...template
				});
			} catch (error) {
				console.error('[email:error] Failed to send reviewer feedback notification', error);
			}
		}

		if (reviewer?.individual && wantsSms(reviewer.individual.deliveryMethod)) {
			await trySendSms(
				reviewer.individual.phone,
				smsTemplates.reviewerFeedbackReceived({
					reviewerName: reviewer.name || undefined,
					appUrl: url.origin
				})
			);
		}

		// Send thank-you email to reviewer
		if (reviewer?.email) {
			try {
				const template = emailTemplates.reviewerThankYou({
					reviewerName: reviewer.name || undefined,
					individualName: journey?.user.name || undefined,
					weekNumber
				});
				await sendEmail({
					to: reviewer.email,
					...template
				});
			} catch (error) {
				console.error('[email:error] Failed to send reviewer thank-you email', error);
			}

			await trySendSms(
				reviewer.phone,
				smsTemplates.reviewerThankYou({
					individualName: journey?.user.name || undefined,
					weekNumber
				})
			);
		}

		// Notify every active coach linked to this individual
		if (reviewer?.individual) {
			try {
				const coachClients = await prisma.coachClient.findMany({
					where: {
						individualId: reviewer.individual.id,
						archivedAt: null
					},
					select: {
						coach: {
							select: { email: true, name: true, phone: true, deliveryMethod: true }
						}
					}
				});

				for (const coachClient of coachClients) {
					const coach = coachClient.coach;
					if (wantsEmail(coach.deliveryMethod)) {
						const coachTemplate = emailTemplates.coachReviewerFeedbackReceived({
							coachName: coach.name ?? 'Coach',
							individualName: reviewer.individual.name || 'a client',
							reviewerName: reviewer.name || undefined,
							weekNumber,
							appUrl: url.origin
						});
						await sendEmail({
							to: coach.email,
							...coachTemplate
						});
					}

					if (wantsSms(coach.deliveryMethod)) {
						await trySendSms(
							coach.phone,
							smsTemplates.coachReviewerFeedbackReceived({
								reviewerName: reviewer.name || undefined,
								individualName: reviewer.individual.name || undefined,
								weekNumber,
								appUrl: url.origin
							})
						);
					}
				}
			} catch (error) {
				console.error('[email:error] Failed to send coach feedback notification', error);
			}
		}

		const totalFeedbacks = await prisma.feedback.count({
			where: { reviewerId }
		});

		const weekCheckIns = journey
			? journey.checkIns.filter(
					(checkIn) =>
						weekNumberForDate(journey.startDate, checkIn.submittedAt, journey.user.timezone) ===
						weekNumber
				)
			: [];

		const individualScores =
			weekCheckIns.length > 0
				? {
						effortScore: roundOne(average(weekCheckIns.map((checkIn) => checkIn.effortScore))),
						performanceScore: roundOne(
							average(weekCheckIns.map((checkIn) => checkIn.performanceScore))
						),
						checkInCount: weekCheckIns.length,
						participantName
					}
				: null;

		return {
			success: true,
			feedbackCount: totalFeedbacks,
			individualFirstName: journey?.user.name?.split(' ')[0] ?? 'them',
			individualScores
		};
	}
};
