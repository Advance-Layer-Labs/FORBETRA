import { createHash } from 'crypto';

/**
 * Hash a raw token value (32-byte hex from randomBytes) for storage in
 * Token.tokenHash. Always lookup tokens by passing the URL value through
 * this function first; never store or query raw values.
 *
 * Backward compatibility (PR-1 of 3): callers of the lookup site should
 * try the hashed value first, then fall back to the raw value for
 * pre-hashing tokens that are still active. After all legacy rows are
 * backfilled (PR-2) the fallback path will be dead and can be removed
 * (PR-3).
 */
export const hashToken = (token: string): string =>
	createHash('sha256').update(token).digest('hex');
