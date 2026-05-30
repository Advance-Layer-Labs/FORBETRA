import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getAppUrl } from './appUrl';

describe('getAppUrl', () => {
	const ORIGINAL_ENV = { ...process.env };

	beforeEach(() => {
		delete process.env.PUBLIC_APP_URL;
		delete process.env.VERCEL_URL;
	});

	afterEach(() => {
		process.env = { ...ORIGINAL_ENV };
	});

	it('falls back to production URL when PUBLIC_APP_URL is unset', () => {
		expect(getAppUrl()).toBe('https://app.forbetra.com');
	});

	it('uses PUBLIC_APP_URL when set as a bare hostname', () => {
		process.env.PUBLIC_APP_URL = 'staging.forbetra.com';
		expect(getAppUrl()).toBe('https://staging.forbetra.com');
	});

	it('uses PUBLIC_APP_URL when set with https:// prefix', () => {
		process.env.PUBLIC_APP_URL = 'https://staging.forbetra.com';
		expect(getAppUrl()).toBe('https://staging.forbetra.com');
	});

	it('never uses VERCEL_URL (preview URLs would break canonical email links)', () => {
		process.env.VERCEL_URL = 'forbetra-abc123.vercel.app';
		expect(getAppUrl()).toBe('https://app.forbetra.com');
		expect(getAppUrl()).not.toContain('vercel.app');
	});
});
