import prisma from '$lib/server/prisma';

export async function getActiveGoal(userId: string) {
	return prisma.goal.findFirst({
		where: { userId, active: true },
		orderBy: { createdAt: 'desc' },
		include: {
			focusAreas: { where: { active: true }, orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
			journeys: { orderBy: { startDate: 'desc' }, take: 1 },
			reviewers: { orderBy: { createdAt: 'asc' } }
		}
	});
}

export async function replaceFocusAreas(
	goalId: string,
	focusAreas: Array<{ label: string; description?: string | null }>
) {
	await prisma.focusArea.deleteMany({ where: { goalId } });
	if (focusAreas.length === 0) return [];
	await prisma.focusArea.createMany({
		data: focusAreas.map((area, index) => ({
			goalId,
			label: area.label.trim(),
			description: area.description?.trim() || null,
			order: index,
			active: true
		}))
	});
	return prisma.focusArea.findMany({
		where: { goalId, active: true },
		orderBy: { order: 'asc' }
	});
}
