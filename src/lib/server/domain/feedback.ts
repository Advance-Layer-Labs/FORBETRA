import { Prisma } from '@prisma/client';
import prisma from '$lib/server/prisma';
import { hasDuplicateFeedback } from './gap';

export class DuplicateFeedbackError extends Error {
	constructor() {
		super('Feedback already submitted for this week.');
		this.name = 'DuplicateFeedbackError';
	}
}

export async function submitFeedback(input: {
	journeyId: string;
	reviewerId: string;
	weekNumber: number;
	effortScore?: number | null;
	performanceScore?: number | null;
	comment?: string | null;
	behavioralObservation?: string | null;
	suggestion?: string | null;
}) {
	const existing = await prisma.feedback.findMany({
		where: { journeyId: input.journeyId, reviewerId: input.reviewerId },
		select: { reviewerId: true, weekNumber: true }
	});

	if (hasDuplicateFeedback(existing, input.reviewerId, input.weekNumber)) {
		throw new DuplicateFeedbackError();
	}

	try {
		return await prisma.feedback.create({
			data: {
				journeyId: input.journeyId,
				reviewerId: input.reviewerId,
				weekNumber: input.weekNumber,
				effortScore: input.effortScore ?? null,
				performanceScore: input.performanceScore ?? null,
				comment: input.comment?.trim() ? input.comment.trim() : null,
				behavioralObservation: input.behavioralObservation?.trim()
					? input.behavioralObservation.trim()
					: null,
				suggestion: input.suggestion?.trim() ? input.suggestion.trim() : null
			}
		});
	} catch (error) {
		if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
			throw new DuplicateFeedbackError();
		}
		throw error;
	}
}
