import { createHash } from 'crypto';

/**
 * Hash a raw token value (32-byte hex from randomBytes) for storage in
 * Token.tokenHash. Look up tokens by hashing the URL value. Never store the
 * raw token, and never put tokenHash in a URL — it will not match.
 */
export const hashToken = (token: string): string =>
	createHash('sha256').update(token).digest('hex');
