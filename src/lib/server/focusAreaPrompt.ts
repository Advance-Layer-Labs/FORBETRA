import prisma from '$lib/server/prisma';

export const FOCUS_AREA_PROMPT_GAP_MS = 14 * 24 * 60 * 60 * 1000;
export const LAST_SEEN_THROTTLE_MS = 15 * 60 * 1000;

export function shouldArmFocusAreaPrompt(input: {
	lastSeenAt: Date | null;
	now: Date;
	hasActiveGoal: boolean;
	hasFocusAreas: boolean;
}): boolean {
	if (!input.lastSeenAt) return false;
	if (!input.hasActiveGoal) return false;
	if (input.hasFocusAreas) return false;
	return input.now.getTime() - input.lastSeenAt.getTime() >= FOCUS_AREA_PROMPT_GAP_MS;
}

export function shouldTouchLastSeen(lastSeenAt: Date | null, now: Date): boolean {
	if (!lastSeenAt) return true;
	return now.getTime() - lastSeenAt.getTime() >= LAST_SEEN_THROTTLE_MS;
}

/** Stamp last-seen, and arm the focus-area prompt when a return is at least 14 days later. */
export async function recordLastSeen(user: { id: string; lastSeenAt: Date | null }) {
	const now = new Date();
	if (!shouldTouchLastSeen(user.lastSeenAt, now)) return;

	let armPrompt = false;
	if (user.lastSeenAt && now.getTime() - user.lastSeenAt.getTime() >= FOCUS_AREA_PROMPT_GAP_MS) {
		const goal = await prisma.goal.findFirst({
			where: { userId: user.id, active: true },
			select: {
				id: true,
				focusAreas: { where: { active: true }, select: { id: true }, take: 1 }
			}
		});
		armPrompt = shouldArmFocusAreaPrompt({
			lastSeenAt: user.lastSeenAt,
			now,
			hasActiveGoal: !!goal,
			hasFocusAreas: (goal?.focusAreas.length ?? 0) > 0
		});
	}

	await prisma.user.update({
		where: { id: user.id },
		data: {
			lastSeenAt: now,
			...(armPrompt ? { focusAreaPromptAt: now } : {})
		}
	});
}
