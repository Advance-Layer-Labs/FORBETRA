export const BULK_INVITE_CAP = 25;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type BulkInvitePerson = { name: string; email: string };

export type ParsedBulkInviteList =
	| { ok: true; people: BulkInvitePerson[]; invalid: string[] }
	| { ok: false; error: string };

export function parseBulkInviteList(raw: string): ParsedBulkInviteList {
	const lines = raw
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line.length > 0);

	if (lines.length === 0) {
		return { ok: false, error: 'Add at least one email address.' };
	}

	if (lines.length > BULK_INVITE_CAP) {
		return {
			ok: false,
			error: `Send up to ${BULK_INVITE_CAP} people at a time. Split the list and send the rest next.`
		};
	}

	const people: BulkInvitePerson[] = [];
	const invalid: string[] = [];
	const seen = new Set<string>();

	for (const line of lines) {
		const person = parseBulkInviteLine(line);
		if (!person) {
			invalid.push(line);
			continue;
		}
		if (seen.has(person.email)) continue;
		seen.add(person.email);
		people.push(person);
	}

	return { ok: true, people, invalid };
}

function parseBulkInviteLine(line: string): BulkInvitePerson | null {
	const angle = line.match(/^(.*)<([^>]+)>\s*$/);
	if (angle) {
		const email = angle[2].trim().toLowerCase();
		const name = cleanName(angle[1]);
		if (!EMAIL_RE.test(email)) return null;
		return { name, email };
	}

	const comma = line.lastIndexOf(',');
	if (comma !== -1) {
		const email = line
			.slice(comma + 1)
			.trim()
			.toLowerCase();
		const name = cleanName(line.slice(0, comma));
		if (!EMAIL_RE.test(email)) return null;
		return { name, email };
	}

	const email = line.toLowerCase();
	if (!EMAIL_RE.test(email)) return null;
	return { name: '', email };
}

function cleanName(value: string): string {
	return value
		.trim()
		.replace(/^["']|["']$/g, '')
		.trim()
		.slice(0, 120);
}
