import { describe, it, expect } from 'vitest';
import { rateLimit } from './rateLimit';

describe('rateLimit', () => {
	it('allows every request when Upstash is not configured', async () => {
		const key = 'test-open';
		for (let i = 0; i < 5; i++) {
			expect(await rateLimit(key, 1, 60_000)).toBe(true);
		}
	});

	it('does not share a fake limit across keys', async () => {
		expect(await rateLimit('test-key-a', 1, 60_000)).toBe(true);
		expect(await rateLimit('test-key-b', 1, 60_000)).toBe(true);
	});
});
