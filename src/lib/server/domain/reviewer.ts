import type { ReviewerAttribution, ReviewerCadence } from '@prisma/client';
import prisma from '$lib/server/prisma';

export async function upsertReviewer(input: {
	individualId: string;
	goalId?: string | null;
	userId?: string | null;
	invitedById?: string | null;
	name: string;
	email: string;
	phone?: string | null;
	relationship?: string | null;
	cadence?: ReviewerCadence;
	attribution?: ReviewerAttribution;
}) {
	const email = input.email.trim().toLowerCase();
	return prisma.reviewer.upsert({
		where: { individualId_email: { individualId: input.individualId, email } },
		update: {
			name: input.name.trim(),
			goalId: input.goalId ?? undefined,
			userId: input.userId ?? undefined,
			phone: input.phone ?? undefined,
			relationship: input.relationship ?? undefined,
			cadence: input.cadence,
			attribution: input.attribution
		},
		create: {
			individualId: input.individualId,
			goalId: input.goalId ?? null,
			userId: input.userId ?? null,
			invitedById: input.invitedById ?? null,
			name: input.name.trim(),
			email,
			phone: input.phone ?? null,
			relationship: input.relationship ?? null,
			cadence: input.cadence ?? 'WEEKLY',
			attribution: input.attribution ?? 'REVIEWER'
		}
	});
}
