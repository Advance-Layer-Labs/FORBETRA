import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const reviewers = await prisma.reviewer.findMany({
		orderBy: { createdAt: 'desc' },
		include: {
			individual: { select: { id: true, name: true, email: true } },
			goal: { select: { id: true, title: true } },
			_count: { select: { feedback: true } },
			feedback: {
				orderBy: { submittedAt: 'desc' },
				take: 1,
				select: { submittedAt: true }
			}
		}
	});

	return { reviewers };
};
