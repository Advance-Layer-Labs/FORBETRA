import { describe, expect, it } from 'vitest';
import { BULK_INVITE_CAP, parseBulkInviteList } from './coachBulkInvites';

describe('parseBulkInviteList', () => {
	it('parses emails and names, and drops blank lines and duplicates', () => {
		const result = parseBulkInviteList(
			'\n alex@example.com \nAlex Jensen, alex@example.com\nSam Lee <sam@example.com>\nnot-an-email\n'
		);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.people).toEqual([
			{ name: '', email: 'alex@example.com' },
			{ name: 'Sam Lee', email: 'sam@example.com' }
		]);
		expect(result.invalid).toEqual(['not-an-email']);
	});

	it('rejects a list longer than the cap', () => {
		const lines = Array.from({ length: BULK_INVITE_CAP + 1 }, (_, i) => `person${i}@example.com`);
		const result = parseBulkInviteList(lines.join('\n'));
		expect(result).toEqual({
			ok: false,
			error: `Send up to ${BULK_INVITE_CAP} people at a time. Split the list and send the rest next.`
		});
	});

	it('asks for an address when the box is empty', () => {
		expect(parseBulkInviteList('  \n  ')).toEqual({
			ok: false,
			error: 'Add at least one email address.'
		});
	});
});
