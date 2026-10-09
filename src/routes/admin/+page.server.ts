import { redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { weekNumberForDate } from '$lib/server/domain';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['ADMIN', 'ORG_ADMIN']);

	if (dbUser.role === 'ORG_ADMIN') {
		throw redirect(303, '/admin/organizations');
	}

	const [
		userCounts,
		goalCount,
		activeCycleCount,
		reflectionCount,
		feedbackCount,
		reviewerCount,
		recentUsers,
		recentReflections,
		recentFeedback
	] = await Promise.all([
		prisma.user.groupBy({
			by: ['role'],
			_count: { id: true }
		}),
		prisma.goal.count(),
		prisma.journey.count({ where: { status: 'ACTIVE' } }),
		prisma.checkIn.count(),
		prisma.feedback.count(),
		prisma.reviewer.count(),
		prisma.user.findMany({
			orderBy: { createdAt: 'desc' },
			take: 5,
			select: { id: true, name: true, email: true, role: true, createdAt: true }
		}),
		prisma.checkIn.findMany({
			orderBy: { submittedAt: 'desc' },
			take: 5,
			select: {
				id: true,
				submittedAt: true,
				user: { select: { name: true, email: true, timezone: true } },
				journey: { select: { startDate: true } }
			}
		}),
		prisma.feedback.findMany({
			orderBy: { submittedAt: 'desc' },
			take: 5,
			select: {
				id: true,
				submittedAt: true,
				weekNumber: true,
				reviewer: { select: { name: true, individual: { select: { name: true } } } }
			}
		})
	]);

	const roleCounts: Record<string, number> = {};
	let totalUsers = 0;
	for (const entry of userCounts) {
		roleCounts[entry.role] = entry._count.id;
		totalUsers += entry._count.id;
	}

	return {
		stats: {
			totalUsers,
			roleCounts,
			goalCount,
			activeCycleCount,
			reflectionCount,
			feedbackCount,
			reviewerCount
		},
		recentActivity: {
			users: recentUsers,
			checkIns: recentReflections.map(({ journey, ...checkIn }) => ({
				...checkIn,
				weekNumber: weekNumberForDate(journey.startDate, checkIn.submittedAt, checkIn.user.timezone)
			})),
			feedback: recentFeedback
		}
	};
};
