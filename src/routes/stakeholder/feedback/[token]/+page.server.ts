import { fail, redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { stakeholderFeedbackSchema } from '$lib/validation/feedback';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import { rateLimit } from '$lib/server/rateLimit';
import { hashToken } from '$lib/server/tokenHash';
import type { Prisma } from '@prisma/client';
import type { Actions, PageServerLoad } from './$types';

const sanitizeToken = (value: string | undefined) => {
	if (!value) return null;
	return /^[a-f0-9]{64}$/i.test(value) ? value : null;
};

/**
 * Lookup a token by URL value. Hashes the URL value first and queries by
 * the hash; falls back to the raw value to keep already-emailed pre-hashing
 * links working during the rollout window (PR-1 of 3). The fallback path
 * becomes dead code after PR-2 backfills all rows and is removed in PR-3.
 */
async function findTokenByUrlValue<T extends Prisma.TokenInclude>(tokenParam: string, include: T) {
	const hashed = hashToken(tokenParam);
	const byHash = await prisma.token.findUnique({
		where: { tokenHash: hashed },
		include
	});
	if (byHash) return byHash;
	return prisma.token.findUnique({
		where: { tokenHash: tokenParam },
		include
	});
}

async function findTokenByUrlValueSelect<T extends Prisma.TokenSelect>(
	tokenParam: string,
	select: T
) {
	const hashed = hashToken(tokenParam);
	const byHash = await prisma.token.findUnique({
		where: { tokenHash: hashed },
		select
	});
	if (byHash) return byHash;
	return prisma.token.findUnique({
		where: { tokenHash: tokenParam },
		select
	});
}

export const load: PageServerLoad = async ({ params, url }) => {
	const isPreview = url.searchParams.get('preview') === 'true';
	const tokenParam = sanitizeToken(params.token);

	// Preview mode - return mock data
	if (isPreview && params.token === 'preview') {
		return {
			token: 'preview',
			stakeholder: {
				id: 'preview',
				name: 'Sample Stakeholder',
				phone: null
			},
			reflection: {
				type: 'RATING_B' as const,
				weekNumber: 3,
				checkInDate: new Date().toISOString(),
				cycleLabel: 'Q1 2026 Leadership Cycle',
				participantName: 'John Doe',
				objectiveTitle: 'Improve executive presence'
			},
			subgoals: [
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
			isFirstFeedback: true,
			previousRatings: {
				weekNumber: 2,
				effortScore: 7,
				performanceScore: 6
			},
			historicRatings: [
				{ weekNumber: 2, effortScore: 7, performanceScore: 6 },
				{ weekNumber: 1, effortScore: 6, performanceScore: 5 }
			]
		};
	}

	if (!tokenParam) {
		throw redirect(302, '/stakeholder/invalid');
	}

	const token = await findTokenByUrlValue(tokenParam, {
		stakeholder: true,
		reflection: {
			select: {
				id: true,
				reflectionType: true,
				weekNumber: true,
				checkInDate: true,
				cycleId: true,
				cycle: {
					select: {
						label: true,
						revealScores: true,
						objective: {
							select: {
								title: true,
								description: true,
								subgoals: {
									where: { active: true },
									orderBy: { createdAt: 'asc' },
									select: { id: true, label: true, description: true }
								}
							}
						}
					}
				},
				user: {
					select: {
						name: true
					}
				}
			}
		}
	});

	if (!token || !token.stakeholder || !token.reflection) {
		throw redirect(302, '/stakeholder/invalid');
	}

	const isAlreadySubmitted = !!token.usedAt;

	// Check expiry AFTER usedAt — so returning stakeholders who already submitted
	// see "already submitted" instead of a confusing "invalid link" error
	if (!isAlreadySubmitted && token.expiresAt < new Date()) {
		throw redirect(302, '/stakeholder/invalid');
	}

	// Fetch previous feedback ratings from this stakeholder (only if not Week 1)
	let previousRatings: {
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	} | null = null;
	let historicRatings: Array<{
		weekNumber: number;
		effortScore: number | null;
		performanceScore: number | null;
	}> = [];

	if (token.reflection.weekNumber > 1 && token.stakeholderId) {
		// Get all feedback submitted by this stakeholder for any reflection in the same cycle
		const allFeedbacks = await prisma.feedback.findMany({
			where: {
				stakeholderId: token.stakeholderId,
				reflection: {
					cycleId: token.reflection.cycleId,
					weekNumber: { lt: token.reflection.weekNumber }
				}
			},
			orderBy: {
				submittedAt: 'desc'
			},
			select: {
				effortScore: true,
				performanceScore: true,
				reflection: {
					select: {
						weekNumber: true
					}
				}
			}
		});

		if (allFeedbacks.length > 0) {
			// Get last feedback (most recent)
			const lastFeedback = allFeedbacks[0];
			previousRatings = {
				weekNumber: lastFeedback.reflection.weekNumber,
				effortScore: lastFeedback.effortScore,
				performanceScore: lastFeedback.performanceScore
			};

			// Build historic ratings map by week
			const historicMap = new Map<
				number,
				{ effortScore: number | null; performanceScore: number | null }
			>();

			allFeedbacks.forEach((feedback) => {
				const week = feedback.reflection.weekNumber;
				if (!historicMap.has(week)) {
					historicMap.set(week, { effortScore: null, performanceScore: null });
				}
				const weekData = historicMap.get(week)!;
				if (feedback.effortScore !== null) weekData.effortScore = feedback.effortScore;
				if (feedback.performanceScore !== null)
					weekData.performanceScore = feedback.performanceScore;
			});

			// Convert to array sorted by week number (descending)
			historicRatings = Array.from(historicMap.entries())
				.map(([weekNumber, scores]) => ({ weekNumber, ...scores }))
				.sort((a, b) => b.weekNumber - a.weekNumber);
		}
	}

	const isFirstFeedback = historicRatings.length === 0;

	// Count total feedbacks from this stakeholder (for conversion funnel)
	const feedbackCount = await prisma.feedback.count({
		where: { stakeholderId: token.stakeholderId! }
	});

	const subgoals = (token.reflection.cycle.objective?.subgoals ?? []).map((s) => ({
		label: s.label,
		description: s.description
	}));

	return {
		// Pass the URL value (plaintext) through, not the stored hash. The action
		// handler re-hashes it on submit to look up the token.
		token: tokenParam,
		stakeholder: {
			id: token.stakeholder.id,
			name: token.stakeholder.name,
			phone: token.stakeholder.phone
		},
		reflection: {
			type: token.reflection.reflectionType,
			weekNumber: token.reflection.weekNumber,
			checkInDate: token.reflection.checkInDate.toISOString(),
			cycleLabel: token.reflection.cycle.label ?? 'Cycle',
			participantName: token.reflection.user.name ?? 'Participant',
			objectiveTitle: token.reflection.cycle.objective?.title?.trim() || 'the objective'
		},
		subgoals,
		revealScores: token.reflection.cycle.revealScores,
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

		// Prevent submission in preview mode
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

		const parsed = stakeholderFeedbackSchema.safeParse(payload);

		if (!parsed.success) {
			const errors = parsed.error.flatten();
			return fail(400, {
				error:
					errors.formErrors[0] ?? errors.fieldErrors.comment?.[0] ?? 'Invalid feedback submission.'
			});
		}

		const data = parsed.data;

		const token = await findTokenByUrlValueSelect(data.token, {
			id: true,
			usedAt: true,
			expiresAt: true,
			stakeholderId: true,
			reflectionId: true
		});

		if (!token || token.usedAt || !token.reflectionId || !token.stakeholderId) {
			return fail(400, { error: 'This feedback link is no longer valid.' });
		}

		if (token.expiresAt < new Date()) {
			return fail(400, { error: 'This feedback link has expired.' });
		}

		// Fetch stakeholder and reflection details for notification
		const stakeholder = await prisma.stakeholder.findUnique({
			where: { id: token.stakeholderId! },
			select: {
				name: true,
				email: true,
				phone: true,
				individual: { select: { id: true, name: true, email: true, phone: true } }
			}
		});

		const reflection = await prisma.reflection.findUnique({
			where: { id: token.reflectionId! },
			select: {
				effortScore: true,
				performanceScore: true,
				weekNumber: true,
				user: {
					select: {
						name: true
					}
				},
				cycle: {
					select: {
						revealScores: true,
						objective: {
							select: {
								title: true
							}
						}
					}
				}
			}
		});

		await prisma.$transaction(async (tx) => {
			await tx.feedback.upsert({
				where: {
					stakeholderId_reflectionId: {
						stakeholderId: token.stakeholderId!,
						reflectionId: token.reflectionId!
					}
				},
				update: {
					effortScore: data.effortScore ?? null,
					performanceScore: data.performanceScore ?? null,
					comment: data.comment ?? null,
					behavioralObservation: data.behavioralObservation ?? null,
					suggestion: data.suggestion ?? null,
					submittedAt: new Date()
				},
				create: {
					stakeholderId: token.stakeholderId!,
					reflectionId: token.reflectionId!,
					effortScore: data.effortScore ?? null,
					performanceScore: data.performanceScore ?? null,
					comment: data.comment ?? null,
					behavioralObservation: data.behavioralObservation ?? null,
					suggestion: data.suggestion ?? null,
					submittedAt: new Date()
				}
			});

			await tx.token.update({
				where: { id: token.id },
				data: { usedAt: new Date() }
			});
		});

		// Send notification email to individual when stakeholder submits feedback
		if (stakeholder?.individual && reflection) {
			try {
				const template = emailTemplates.stakeholderFeedbackReceived({
					individualName: stakeholder.individual.name || undefined,
					stakeholderName: stakeholder.name || undefined,
					appUrl: url.origin
				});
				await sendEmail({
					to: stakeholder.individual.email,
					...template
				});
			} catch (error) {
				console.error('[email:error] Failed to send stakeholder feedback notification', error);
				// Don't fail the request if email fails
			}

			// Send SMS to individual
			await trySendSms(
				stakeholder.individual.phone,
				smsTemplates.stakeholderFeedbackReceived({
					stakeholderName: stakeholder.name || undefined,
					appUrl: url.origin
				})
			);
		}

		// Send thank-you email to stakeholder
		if (stakeholder?.email && reflection) {
			try {
				const template = emailTemplates.stakeholderThankYou({
					stakeholderName: stakeholder.name || undefined,
					individualName: reflection.user.name || undefined,
					weekNumber: reflection.weekNumber
				});
				await sendEmail({
					to: stakeholder.email,
					...template
				});
			} catch (error) {
				console.error('[email:error] Failed to send stakeholder thank-you email', error);
			}

			// Send thank-you SMS to stakeholder
			await trySendSms(
				stakeholder.phone,
				smsTemplates.stakeholderThankYou({
					individualName: reflection.user.name || undefined,
					weekNumber: reflection.weekNumber
				})
			);
		}

		// Notify coach if the individual has one
		if (stakeholder?.individual && reflection) {
			try {
				const coachClient = await prisma.coachClient.findFirst({
					where: {
						individualId: stakeholder.individual.id,
						archivedAt: null
					},
					select: {
						coach: {
							select: { email: true, name: true, phone: true }
						}
					}
				});

				if (coachClient?.coach) {
					const coachTemplate = emailTemplates.coachStakeholderFeedbackReceived({
						coachName: coachClient.coach.name ?? 'Coach',
						individualName: stakeholder.individual.name || 'a client',
						stakeholderName: stakeholder.name || undefined,
						weekNumber: reflection.weekNumber,
						appUrl: url.origin
					});
					await sendEmail({
						to: coachClient.coach.email,
						...coachTemplate
					});

					await trySendSms(
						coachClient.coach.phone,
						`Forbetra: ${stakeholder.name || 'A reviewer'} submitted feedback for your client ${stakeholder.individual.name || 'a client'} (Week ${reflection.weekNumber}). ${url.origin}/coach/roster`
					);
				}
			} catch (error) {
				console.error('[email:error] Failed to send coach feedback notification', error);
			}
		}

		// Count feedbacks for conversion funnel
		const totalFeedbacks = await prisma.feedback.count({
			where: { stakeholderId: token.stakeholderId! }
		});

		return {
			success: true,
			feedbackCount: totalFeedbacks,
			individualFirstName: reflection?.user.name?.split(' ')[0] ?? 'them',
			individualScores:
				reflection && reflection.cycle.revealScores
					? {
							effortScore: reflection.effortScore,
							performanceScore: reflection.performanceScore,
							participantName: reflection.user.name ?? 'Participant'
						}
					: null
		};
	}
};
