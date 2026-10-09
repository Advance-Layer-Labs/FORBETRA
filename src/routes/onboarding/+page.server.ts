import { fail, redirect } from '@sveltejs/kit';
import { Prisma } from '@prisma/client';
import { onboardingContexts } from '$lib/content/onboardingTemplates';
import { requireRole } from '$lib/server/auth';
import prisma from '$lib/server/prisma';
import { journeyLengthWeeks, startJourney } from '$lib/server/domain';
import { upsertReviewer } from '$lib/server/domain/reviewer';
import { replaceFocusAreas } from '$lib/server/domain/goal';
import { getActiveGoalWithJourney } from '$lib/server/individualContext';
import { getAppUrl } from '$lib/server/appUrl';
import { onboardingSchema } from '$lib/validation/onboarding';
import { sendEmail } from '$lib/notifications/email';
import { emailTemplates } from '$lib/notifications/emailTemplates';
import { wantsEmail, wantsSms } from '$lib/notifications/preferences';
import { trySendSms } from '$lib/notifications/sms';
import { smsTemplates } from '$lib/notifications/smsTemplates';
import type { Actions, PageServerLoad } from './$types';
import type { ZodIssue } from 'zod';

const formatErrors = (issues: ZodIssue[]) =>
	issues.reduce(
		(acc, issue) => {
			const path = issue.path.join('.');
			if (!acc[path]) acc[path] = [];
			acc[path].push(issue.message);
			return acc;
		},
		{} as Record<string, string[]>
	);

type InvitePayload = {
	focusAreas: Array<{ label: string; description?: string }>;
	reviewers: Array<{ name: string; email: string; relationship?: string }>;
};

function readInvitePayload(payload: unknown): InvitePayload {
	const empty = { focusAreas: [], reviewers: [] };
	if (!payload || typeof payload !== 'object') return empty;
	const record = payload as Record<string, unknown>;

	const focusAreas = Array.isArray(record.focusAreas)
		? record.focusAreas.flatMap((area) => {
				if (!area || typeof area !== 'object') return [];
				const label = String((area as { label?: unknown }).label ?? '').trim();
				if (!label) return [];
				const description = String((area as { description?: unknown }).description ?? '').trim();
				return [{ label, ...(description ? { description } : {}) }];
			})
		: [];

	const reviewers = Array.isArray(record.reviewers)
		? record.reviewers.flatMap((reviewer) => {
				if (!reviewer || typeof reviewer !== 'object') return [];
				const name = String((reviewer as { name?: unknown }).name ?? '').trim();
				const email = String((reviewer as { email?: unknown }).email ?? '')
					.trim()
					.toLowerCase();
				if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return [];
				const relationship = String(
					(reviewer as { relationship?: unknown }).relationship ?? ''
				).trim();
				return [{ name, email, ...(relationship ? { relationship } : {}) }];
			})
		: [];

	return { focusAreas, reviewers };
}

async function applyInvitePrefill(userId: string, email: string, goalId: string) {
	const invite = await prisma.coachInvite.findFirst({
		where: {
			email: email.toLowerCase(),
			acceptedAt: { not: null },
			payload: { not: Prisma.DbNull }
		},
		orderBy: { updatedAt: 'desc' },
		select: { payload: true }
	});
	if (!invite) return;

	const { focusAreas, reviewers } = readInvitePayload(invite.payload);
	if (focusAreas.length > 0) {
		await replaceFocusAreas(goalId, focusAreas);
	}
	for (const reviewer of reviewers) {
		await upsertReviewer({
			individualId: userId,
			goalId,
			name: reviewer.name,
			email: reviewer.email,
			relationship: reviewer.relationship ?? null
		});
	}
}

async function activeJourney(userId: string) {
	const context = await getActiveGoalWithJourney(userId);
	if (!context?.journey) return null;
	return context;
}

export const load: PageServerLoad = async (event) => {
	const isPreview = event.url.searchParams.get('preview') === 'true';
	const { dbUser } = requireRole(event, isPreview ? ['INDIVIDUAL', 'ADMIN'] : 'INDIVIDUAL');

	if (!isPreview && (await activeJourney(dbUser.id))) {
		throw redirect(303, '/individual/today');
	}

	let prefill: { goalTitle: string; goalDescription: string } | null = null;

	if (!isPreview) {
		const coachInvite = await prisma.coachInvite.findFirst({
			where: {
				email: dbUser.email.toLowerCase(),
				acceptedAt: { not: null },
				payload: { not: Prisma.DbNull }
			},
			orderBy: { updatedAt: 'desc' },
			select: { payload: true }
		});

		if (coachInvite?.payload && typeof coachInvite.payload === 'object') {
			const p = coachInvite.payload as Record<string, unknown>;
			const nestedGoal =
				p.goal && typeof p.goal === 'object' ? (p.goal as Record<string, unknown>) : null;
			const title =
				(typeof p.goalTitle === 'string' && p.goalTitle) ||
				(typeof nestedGoal?.title === 'string' ? nestedGoal.title : '');
			const description =
				(typeof p.goalDescription === 'string' && p.goalDescription) ||
				(typeof nestedGoal?.description === 'string' ? nestedGoal.description : '');
			if (title) {
				prefill = { goalTitle: title, goalDescription: description };
			}
		}
	}

	return {
		isPreview,
		userName: dbUser.name,
		contexts: onboardingContexts,
		prefill
	};
};

export const actions: Actions = {
	default: async (event) => {
		const isPreview = event.url.searchParams.get('preview') === 'true';
		const { dbUser } = requireRole(event, isPreview ? ['INDIVIDUAL', 'ADMIN'] : 'INDIVIDUAL');

		const current = await activeJourney(dbUser.id);
		if (current) {
			throw redirect(303, '/individual/today');
		}

		const formData = await event.request.formData();
		const goalTitle = (formData.get('goalTitle') ?? '').toString();
		const rawDescription = (formData.get('goalDescription') ?? '').toString().trim();
		const values = {
			goalTitle,
			goalDescription: rawDescription
		};

		const parsed = onboardingSchema.safeParse({
			goalTitle,
			goalDescription: rawDescription.length > 0 ? rawDescription : undefined
		});

		if (!parsed.success) {
			return fail(400, { errors: formatErrors(parsed.error.issues), values });
		}

		const data = parsed.data;

		try {
			const existingGoal = await prisma.goal.findFirst({
				where: { userId: dbUser.id, active: true },
				orderBy: { createdAt: 'desc' },
				select: { id: true }
			});

			const goal = existingGoal
				? await prisma.goal.update({
						where: { id: existingGoal.id },
						data: {
							title: data.goalTitle,
							description: data.goalDescription || null
						}
					})
				: await prisma.goal.create({
						data: {
							userId: dbUser.id,
							title: data.goalTitle,
							description: data.goalDescription || null,
							active: true
						}
					});

			const label = dbUser.name ? `${dbUser.name} — ${data.goalTitle}` : data.goalTitle;
			await startJourney({
				userId: dbUser.id,
				goalId: goal.id,
				startDate: new Date(),
				lengthWeeks: journeyLengthWeeks(undefined, true),
				label: label.slice(0, 80),
				status: 'ACTIVE'
			});

			await applyInvitePrefill(dbUser.id, dbUser.email, goal.id);
		} catch (error) {
			console.error('[onboarding:error] Failed to save:', error);
			return fail(500, {
				errors: { form: ['Failed to save your goal. Please try again.'] },
				values
			});
		}

		if (wantsEmail(dbUser.deliveryMethod)) {
			try {
				const template = emailTemplates.welcomeIndividual({
					individualName: dbUser.name || undefined,
					appUrl: getAppUrl()
				});
				await sendEmail({ to: dbUser.email, ...template });
			} catch (error) {
				console.error('[email:error] Failed to send welcome email', error);
			}
		}

		if (wantsSms(dbUser.deliveryMethod)) {
			await trySendSms(
				dbUser.phone,
				smsTemplates.welcomeIndividual({
					individualName: dbUser.name || undefined,
					appUrl: event.url.origin
				})
			);
		}

		throw redirect(303, '/individual/today');
	}
};
