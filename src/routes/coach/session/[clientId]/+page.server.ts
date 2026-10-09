import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { error, fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { buildClientSummary } from '$lib/server/buildClientSummary';
import {
	checkInsWithWeek,
	clientSelect,
	currentGoal,
	currentJourney,
	feedbackByReviewer,
	goalReviewers,
	toSummaryInput
} from '../../clientData';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
	const clientId = event.params.clientId;

	// Verify coach-client relationship
	const relationship = await prisma.coachClient.findUnique({
		where: {
			coachId_individualId: {
				coachId: dbUser.id,
				individualId: clientId
			}
		}
	});

	if (!relationship) {
		throw error(404, 'Client not found');
	}

	// Load individual data + insight queries in parallel
	const [individual, coachPrep] = await Promise.all([
		prisma.user.findUnique({
			where: { id: clientId },
			select: clientSelect(dbUser.id)
		}),
		prisma.insight.findFirst({
			where: { userId: clientId, type: 'COACH_PREP', status: 'COMPLETED' },
			orderBy: { createdAt: 'desc' },
			select: { id: true, content: true, createdAt: true }
		})
	]);

	if (!individual) {
		throw error(404, 'Client not found');
	}

	const client = buildClientSummary(
		{
			id: relationship.id,
			individualId: relationship.individualId,
			createdAt: relationship.createdAt,
			archivedAt: relationship.archivedAt
		},
		toSummaryInput(individual)
	);

	if (!client) {
		throw error(404, 'Client not found');
	}

	const journey = currentJourney(individual);

	// Determine AI prep freshness (has new data arrived since prep was generated?)
	let prepFreshness: { isStale: boolean; newDataSince: number } | null = null;
	if (coachPrep) {
		const prepTime = coachPrep.createdAt.getTime();
		const newCheckIns = (journey?.checkIns ?? []).filter(
			(r) => r.submittedAt.getTime() > prepTime
		).length;
		const newFeedbacks = (journey?.feedback ?? []).filter(
			(f) => f.submittedAt.getTime() > prepTime
		).length;

		prepFreshness = {
			isStale: newCheckIns + newFeedbacks > 0,
			newDataSince: newCheckIns + newFeedbacks
		};
	}

	// Load ALL coach notes (not limited to 3)
	const allCoachNotes = journey
		? await prisma.coachNote.findMany({
				where: {
					coachId: dbUser.id,
					individualId: clientId,
					journeyId: journey.id
				},
				orderBy: { createdAt: 'desc' },
				select: {
					id: true,
					content: true,
					weekNumber: true,
					createdAt: true
				}
			})
		: [];

	// Load all checkIns for the current journey
	const allReflections = journey
		? checkInsWithWeek(journey, individual.timezone).map((r) => ({
				id: r.id,
				weekNumber: r.weekNumber,
				submittedAt: r.submittedAt.toISOString(),
				effortScore: r.effortScore,
				performanceScore: r.performanceScore,
				notes: r.notes
			}))
		: [];

	// Focus areas are unscored hints on the goal
	const focusAreas = currentGoal(individual)?.focusAreas ?? [];

	// Extract reviewer feedback trends (last 2 per reviewer)
	const reviewerTrends = goalReviewers(individual).map((s) => {
		const [latest = null, previous = null] = feedbackByReviewer(journey, s.id, 2);
		return {
			name: s.name,
			latestEffort: latest?.effortScore ?? null,
			latestPerformance: latest?.performanceScore ?? null,
			previousEffort: previous?.effortScore ?? null,
			previousPerformance: previous?.performanceScore ?? null
		};
	});

	// Load sibling client list for prev/next navigation
	const siblingClients = await prisma.coachClient.findMany({
		where: { coachId: dbUser.id, archivedAt: null },
		select: { individualId: true, individual: { select: { name: true } } },
		orderBy: { individual: { name: 'asc' } }
	});
	const siblingList = siblingClients.map((s) => ({
		id: s.individualId,
		name: s.individual.name ?? 'Client'
	}));
	const currentIndex = siblingList.findIndex((s) => s.id === clientId);
	const prevClient = currentIndex > 0 ? siblingList[currentIndex - 1] : null;
	const nextClient = currentIndex < siblingList.length - 1 ? siblingList[currentIndex + 1] : null;

	return {
		client,
		focusAreas,
		reviewerTrends,
		prevClient,
		nextClient,
		coachPrep: coachPrep
			? {
					id: coachPrep.id,
					content: coachPrep.content,
					createdAt: coachPrep.createdAt.toISOString()
				}
			: null,
		prepFreshness,
		allReflections,
		allCoachNotes: allCoachNotes.map((n) => ({
			id: n.id,
			content: n.content,
			weekNumber: n.weekNumber,
			createdAt: n.createdAt.toISOString()
		})),
		journeyId: journey?.id ?? null
	};
};

export const actions: Actions = {
	createNote: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const clientId = event.params.clientId;

		const formData = await event.request.formData();
		const journeyId = String(formData.get('journeyId') ?? '').trim();
		const weekNumberRaw = String(formData.get('weekNumber') ?? '').trim();
		const content = String(formData.get('content') ?? '').trim();

		if (!content || content.length < 10) {
			return fail(400, { noteError: 'Note content must be at least 10 characters.' });
		}

		// Verify coach-client relationship
		const relationship = await prisma.coachClient.findUnique({
			where: {
				coachId_individualId: {
					coachId: dbUser.id,
					individualId: clientId
				}
			}
		});

		if (!relationship) {
			return fail(403, { noteError: 'You do not have access to this client.' });
		}

		const weekNumber = weekNumberRaw ? parseInt(weekNumberRaw, 10) : null;

		// Verify journey exists if provided
		if (journeyId) {
			const journey = await prisma.journey.findUnique({ where: { id: journeyId } });
			if (!journey) {
				return fail(400, { noteError: 'Journey no longer exists.' });
			}
		}

		await prisma.coachNote.create({
			data: {
				coachId: dbUser.id,
				individualId: clientId,
				journeyId: journeyId || null,
				weekNumber,
				content
			}
		});

		return { noteSuccess: true, noteAction: 'created' as const };
	},

	editNote: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const noteId = String(formData.get('noteId') ?? '').trim();
		const content = String(formData.get('content') ?? '').trim();

		if (!noteId) return fail(400, { noteError: 'Missing note ID.' });
		if (!content || content.length < 10) {
			return fail(400, { noteError: 'Note content must be at least 10 characters.' });
		}

		const note = await prisma.coachNote.findUnique({ where: { id: noteId } });
		if (!note || note.coachId !== dbUser.id) {
			return fail(403, { noteError: 'You cannot edit this note.' });
		}

		await prisma.coachNote.update({
			where: { id: noteId },
			data: { content }
		});

		return { noteSuccess: true, noteAction: 'updated' as const };
	},

	deleteNote: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);
		const formData = await event.request.formData();
		const noteId = String(formData.get('noteId') ?? '').trim();

		if (!noteId) return fail(400, { noteError: 'Missing note ID.' });

		const note = await prisma.coachNote.findUnique({ where: { id: noteId } });
		if (!note || note.coachId !== dbUser.id) {
			return fail(403, { noteError: 'You cannot delete this note.' });
		}

		await prisma.coachNote.delete({ where: { id: noteId } });

		return { noteSuccess: true, noteAction: 'deleted' as const };
	}
};
