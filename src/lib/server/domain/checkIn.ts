import type { CheckIn } from '@prisma/client';
import prisma from '$lib/server/prisma';
import { weekNumberForDate } from './week';

export async function recordCheckIn(input: {
	journeyId: string;
	userId: string;
	effortScore: number;
	performanceScore: number;
	notes?: string | null;
	submittedAt?: Date;
}): Promise<CheckIn> {
	return prisma.checkIn.create({
		data: {
			journeyId: input.journeyId,
			userId: input.userId,
			effortScore: input.effortScore,
			performanceScore: input.performanceScore,
			notes: input.notes?.trim() ? input.notes.trim() : null,
			submittedAt: input.submittedAt ?? new Date()
		}
	});
}

export async function listCheckIns(journeyId: string): Promise<CheckIn[]> {
	return prisma.checkIn.findMany({
		where: { journeyId },
		orderBy: { submittedAt: 'asc' }
	});
}

export function checkInWeek(
	journeyStart: Date,
	checkIn: { submittedAt: Date },
	timeZone?: string | null
): number {
	return weekNumberForDate(journeyStart, checkIn.submittedAt, timeZone);
}
