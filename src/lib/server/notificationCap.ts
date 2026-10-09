import prisma from '$lib/server/prisma';
import { rateLimit } from '$lib/server/rateLimit';

const useUpstash = !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN);

/**
 * True when another send is allowed.
 * Uses Upstash when it is configured. Otherwise counts rows in NotificationCap,
 * so a missing Redis config still enforces the weekly reminder cap.
 */
export async function allowNotification(
	key: string,
	max: number,
	windowMs: number
): Promise<boolean> {
	if (useUpstash) return rateLimit(key, max, windowMs);

	const since = new Date(Date.now() - windowMs);
	await prisma.notificationCap.deleteMany({
		where: { key, createdAt: { lt: since } }
	});
	const recent = await prisma.notificationCap.count({
		where: { key, createdAt: { gte: since } }
	});
	if (recent >= max) return false;
	await prisma.notificationCap.create({ data: { key } });
	return true;
}
