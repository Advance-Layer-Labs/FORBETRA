import { describe, it, expect } from 'vitest';
import { hashToken } from './tokenHash';

describe('hashToken', () => {
	it('produces a stable 64-char hex SHA-256 hash', () => {
		const out = hashToken('a'.repeat(64));
		expect(out).toMatch(/^[a-f0-9]{64}$/);
		expect(hashToken('a'.repeat(64))).toBe(out);
	});

	it('different inputs produce different hashes', () => {
		expect(hashToken('foo')).not.toBe(hashToken('bar'));
	});

	it('does not return the input', () => {
		const raw = 'b'.repeat(64);
		expect(hashToken(raw)).not.toBe(raw);
	});
});
