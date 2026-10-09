import { error, redirect, type RequestEvent } from '@sveltejs/kit';
import type { User, UserRole } from '@prisma/client';

const SIGN_IN = '/sign-in';

export function requireUser(event: RequestEvent): User {
	const session = event.locals.auth();
	if (!session.userId) {
		if (event.url.pathname.startsWith('/api/')) throw error(401, 'Authentication required');
		throw redirect(307, SIGN_IN);
	}
	const dbUser = event.locals.dbUser;
	if (!dbUser) {
		if (event.url.pathname.startsWith('/api/')) throw error(401, 'User not found');
		throw redirect(307, '/onboarding');
	}
	return dbUser;
}

export function requireAppRole(event: RequestEvent, allowed: UserRole | UserRole[]): User {
	const dbUser = requireUser(event);
	const roles = new Set(Array.isArray(allowed) ? allowed : [allowed]);
	if (!roles.has(dbUser.role)) {
		if (event.url.pathname.startsWith('/api/')) throw error(403, 'Insufficient permissions');
		throw redirect(303, '/');
	}
	return dbUser;
}
