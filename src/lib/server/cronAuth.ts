import { timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from '@sveltejs/kit';
import { rateLimit } from './rateLimit';

const constantTimeStringEqual = (a: string, b: string): boolean => {
	const bufA = Buffer.from(a);
	const bufB = Buffer.from(b);
	if (bufA.length !== bufB.length) return false;
	return timingSafeEqual(bufA, bufB);
};

const isAuthorized = (request: Request): boolean => {
	const secret = process.env.CRON_SECRET || process.env.JOB_SECRET_TOKEN;
	if (!secret) return false;

	const header = request.headers.get('authorization');
	if (!header) return false;

	const expected = `Bearer ${secret}`;
	return constantTimeStringEqual(header, expected);
};

const json = (status: number, body: unknown): Response =>
	new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' }
	});

export const createCronJobHandler = (
	jobName: string,
	jobFn: () => Promise<unknown | void>
): RequestHandler => {
	return async ({ request, url }) => {
		if (!isAuthorized(request)) {
			return new Response('Unauthorized', { status: 401 });
		}

		if (!(await rateLimit(`job:${url.pathname}`, 1, 60_000))) {
			return new Response('Too many requests', { status: 429 });
		}

		try {
			const result = await jobFn();
			return json(200, {
				status: 'success',
				...(result && typeof result === 'object' ? result : {})
			});
		} catch (error) {
			console.error(`[job:${jobName}] Failed`, error);
			return json(500, { status: 'error', error: String(error) });
		}
	};
};
