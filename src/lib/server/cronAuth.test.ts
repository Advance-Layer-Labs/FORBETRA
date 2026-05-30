import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createCronJobHandler } from './cronAuth';

vi.mock('./rateLimit', () => ({
	rateLimit: vi.fn(async () => true)
}));

const buildEvent = (headers: Record<string, string> = {}, pathname = '/api/jobs/test') =>
	({
		request: new Request(`https://x${pathname}`, { headers }),
		url: new URL(`https://x${pathname}`)
	}) as unknown as Parameters<ReturnType<typeof createCronJobHandler>>[0];

describe('createCronJobHandler', () => {
	const ORIGINAL_ENV = { ...process.env };
	let jobFn: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		jobFn = vi.fn(async () => ({ ok: true }));
	});

	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
	});

	it('rejects request with no secret env vars set', async () => {
		delete process.env.CRON_SECRET;
		delete process.env.JOB_SECRET_TOKEN;
		const handler = createCronJobHandler('test', jobFn);
		const res = await handler(buildEvent({ authorization: 'Bearer anything' }));
		expect(res.status).toBe(401);
		expect(jobFn).not.toHaveBeenCalled();
	});

	it('rejects request with no Authorization header', async () => {
		process.env.JOB_SECRET_TOKEN = 'secret123';
		const handler = createCronJobHandler('test', jobFn);
		const res = await handler(buildEvent());
		expect(res.status).toBe(401);
		expect(jobFn).not.toHaveBeenCalled();
	});

	it('rejects request with wrong secret', async () => {
		process.env.JOB_SECRET_TOKEN = 'secret123';
		const handler = createCronJobHandler('test', jobFn);
		const res = await handler(buildEvent({ authorization: 'Bearer wrong' }));
		expect(res.status).toBe(401);
		expect(jobFn).not.toHaveBeenCalled();
	});

	it('accepts request with matching JOB_SECRET_TOKEN', async () => {
		process.env.JOB_SECRET_TOKEN = 'secret123';
		const handler = createCronJobHandler('test', jobFn);
		const res = await handler(buildEvent({ authorization: 'Bearer secret123' }));
		expect(res.status).toBe(200);
		expect(jobFn).toHaveBeenCalledOnce();
	});

	it('accepts request with matching CRON_SECRET (Vercel native cron path)', async () => {
		delete process.env.JOB_SECRET_TOKEN;
		process.env.CRON_SECRET = 'vercel-secret';
		const handler = createCronJobHandler('test', jobFn);
		const res = await handler(buildEvent({ authorization: 'Bearer vercel-secret' }));
		expect(res.status).toBe(200);
		expect(jobFn).toHaveBeenCalledOnce();
	});

	it('prefers CRON_SECRET when both are set', async () => {
		process.env.CRON_SECRET = 'cron-wins';
		process.env.JOB_SECRET_TOKEN = 'job-secret';
		const handler = createCronJobHandler('test', jobFn);
		const ok = await handler(buildEvent({ authorization: 'Bearer cron-wins' }));
		expect(ok.status).toBe(200);

		const bad = await handler(buildEvent({ authorization: 'Bearer job-secret' }));
		expect(bad.status).toBe(401);
	});

	it('returns 500 when the job function throws', async () => {
		process.env.JOB_SECRET_TOKEN = 'secret123';
		const failing = vi.fn(async () => {
			throw new Error('boom');
		});
		const handler = createCronJobHandler('test', failing);
		const res = await handler(buildEvent({ authorization: 'Bearer secret123' }));
		expect(res.status).toBe(500);
		const body = await res.json();
		expect(body.status).toBe('error');
	});

	it('merges object result into the success response', async () => {
		process.env.JOB_SECRET_TOKEN = 'secret123';
		const fn = vi.fn(async () => ({ completed: 3, failed: 0 }));
		const handler = createCronJobHandler('test', fn);
		const res = await handler(buildEvent({ authorization: 'Bearer secret123' }));
		const body = await res.json();
		expect(body).toEqual({ status: 'success', completed: 3, failed: 0 });
	});

	it('handles void return from job function', async () => {
		process.env.JOB_SECRET_TOKEN = 'secret123';
		const fn = vi.fn(async () => undefined);
		const handler = createCronJobHandler('test', fn);
		const res = await handler(buildEvent({ authorization: 'Bearer secret123' }));
		const body = await res.json();
		expect(body).toEqual({ status: 'success' });
	});
});
