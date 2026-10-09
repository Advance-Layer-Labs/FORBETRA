import type { JourneyStatus } from '@prisma/client';
import prisma from '$lib/server/prisma';

const ALLOWED_LENGTHS = new Set([6, 12, 16]);

export function journeyLengthWeeks(lengthWeeks: number | undefined, isFirstJourney: boolean): number {
	if (isFirstJourney) return 12;
	if (lengthWeeks && ALLOWED_LENGTHS.has(lengthWeeks)) return lengthWeeks;
	return 12;
}

export function journeyEndDate(startDate: Date, lengthWeeks: number): Date {
	const end = new Date(startDate);
	end.setDate(end.getDate() + lengthWeeks * 7);
	return end;
}

export async function startJourney(input: {
	userId: string;
	goalId: string;
	startDate: Date;
	lengthWeeks: number;
	label?: string | null;
	status?: JourneyStatus;
}) {
	const lengthWeeks = input.lengthWeeks;
	return prisma.journey.create({
		data: {
			userId: input.userId,
			goalId: input.goalId,
			label: input.label?.trim() || null,
			startDate: input.startDate,
			endDate: journeyEndDate(input.startDate, lengthWeeks),
			lengthWeeks,
			status: input.status ?? 'ACTIVE'
		}
	});
}
