import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const useUpstash = !!(UPSTASH_URL && UPSTASH_TOKEN);

const upstashInstances = new Map<string, Ratelimit>();

function getUpstashLimiter(maxRequests: number, windowMs: number): Ratelimit {
	const configKey = `${maxRequests}:${windowMs}`;
	let limiter = upstashInstances.get(configKey);
	if (!limiter) {
		limiter = new Ratelimit({
			redis: new Redis({ url: UPSTASH_URL!, token: UPSTASH_TOKEN! }),
			limiter: Ratelimit.slidingWindow(maxRequests, `${Math.round(windowMs / 1000)} s`),
			prefix: 'forbetra_rl'
		});
		upstashInstances.set(configKey, limiter);
	}
	return limiter;
}

/**
 * Returns true when the request is allowed.
 * Without Upstash, every request is allowed. An in-memory counter would not
 * hold on Vercel, so it is not used as a stand-in limit.
 */
export async function rateLimit(
	key: string,
	maxRequests: number,
	windowMs: number
): Promise<boolean> {
	if (!useUpstash) return true;

	try {
		const limiter = getUpstashLimiter(maxRequests, windowMs);
		const result = await limiter.limit(key);
		return result.success;
	} catch (err) {
		console.error('[rateLimit] Upstash error, allowing request', err);
		return true;
	}
}
