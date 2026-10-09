import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import prisma from '$lib/server/prisma';
import { clerkClient, withClerkHandler } from 'svelte-clerk/server';
import { dev } from '$app/environment';
import type { Handle } from '@sveltejs/kit';
import type { Prisma, UserRole } from '@prisma/client';
import { env } from '$env/dynamic/private';
import { recordLastSeen } from '$lib/server/focusAreaPrompt';
import { notifyCoachClientAccepted } from '$lib/notifications/notifyCoach';

if (env.SENTRY_DSN) {
	Sentry.init({
		dsn: env.SENTRY_DSN,
		tracesSampleRate: 0
	});
}

const DEFAULT_ROLE: UserRole = 'INDIVIDUAL';
const ALLOWED_ROLES = new Set<UserRole>(['INDIVIDUAL', 'COACH', 'ADMIN', 'ORG_ADMIN']);

const FORM_CONTENT_TYPES = new Set([
	'application/x-www-form-urlencoded',
	'multipart/form-data',
	'text/plain'
]);

/** Same origin check SvelteKit applies, except the Twilio inbound SMS webhook has no Origin. */
const csrfHandle: Handle = async ({ event, resolve }) => {
	if (dev || event.url.pathname === '/api/webhooks/twilio') return resolve(event);

	const method = event.request.method;
	if (method !== 'POST' && method !== 'PUT' && method !== 'PATCH' && method !== 'DELETE') {
		return resolve(event);
	}

	const contentType = event.request.headers.get('content-type')?.split(';', 1)[0]?.trim() ?? '';
	if (!FORM_CONTENT_TYPES.has(contentType)) return resolve(event);

	const origin = event.request.headers.get('origin');
	if (origin === event.url.origin) return resolve(event);

	return new Response(`Cross-site ${method} form submissions are forbidden`, { status: 403 });
};

const clerkHandle = withClerkHandler();

const linkPendingCoachInvites = async (user: {
	id: string;
	email: string;
	name: string | null;
	role: UserRole;
}) => {
	if (user.role !== 'INDIVIDUAL') return;

	const pendingInvites = await prisma.coachInvite.findMany({
		where: {
			email: user.email.toLowerCase(),
			acceptedAt: null,
			cancelledAt: null,
			expiresAt: {
				gt: new Date()
			}
		},
		select: {
			id: true,
			coachId: true,
			tokenHash: true
		}
	});

	if (pendingInvites.length === 0) return;

	await prisma.$transaction(async (tx) => {
		for (const invite of pendingInvites) {
			await tx.coachInvite.update({
				where: { id: invite.id },
				data: {
					acceptedAt: new Date(),
					individualId: user.id
				}
			});

			await tx.coachClient.upsert({
				where: {
					coachId_individualId: {
						coachId: invite.coachId,
						individualId: user.id
					}
				},
				update: {
					archivedAt: null
				},
				create: {
					coachId: invite.coachId,
					individualId: user.id
				}
			});

			await tx.token.updateMany({
				where: {
					tokenHash: invite.tokenHash,
					type: 'COACH_INVITE'
				},
				data: {
					usedAt: new Date()
				}
			});
		}
	});

	for (const invite of pendingInvites) {
		try {
			await notifyCoachClientAccepted({
				coachId: invite.coachId,
				clientName: user.name ?? user.email,
				clientEmail: user.email
			});
		} catch (error) {
			console.warn('[coach:notify] Failed to notify coach of auto-accepted invite', error);
		}
	}
};

const IMPERSONATE_COOKIE = 'forbetra_impersonate';

const impersonateHandle: Handle = async ({ event, resolve }) => {
	event.locals.realUser = null;

	// Stamp the signed-in user before any impersonation swap, so an admin
	// preview does not look like the individual came back after two weeks.
	if (event.locals.dbUser) {
		try {
			await recordLastSeen(event.locals.dbUser);
		} catch (error) {
			console.error('[auth:last-seen] Failed to record last seen', error);
		}
	}

	// Never impersonate on admin routes — admin always sees real data
	const isAdminRoute =
		event.url.pathname.startsWith('/admin') || event.url.pathname.startsWith('/api/admin');
	const targetUserId = event.cookies.get(IMPERSONATE_COOKIE);
	if (targetUserId && event.locals.dbUser?.role === 'ADMIN' && !isAdminRoute) {
		const targetUser = await prisma.user.findUnique({ where: { id: targetUserId } });
		if (targetUser) {
			event.locals.realUser = event.locals.dbUser;
			event.locals.dbUser = targetUser;
		} else {
			// Target user no longer exists — clear stale cookie
			event.cookies.delete(IMPERSONATE_COOKIE, { path: '/' });
		}
	}

	return resolve(event);
};

export const handle = sequence(
	csrfHandle,
	clerkHandle,
	async ({ event, resolve }) => {
		const auth = event.locals.auth();

		if (!auth.userId) {
			event.locals.dbUser = null;
			return resolve(event);
		}

		try {
			const existingUser = await prisma.user.findUnique({
				where: { clerkUserId: auth.userId }
			});

			const clerkUser = await clerkClient.users.getUser(auth.userId);
			const primaryEmail =
				clerkUser.emailAddresses.find((email) => email.id === clerkUser.primaryEmailAddressId)
					?.emailAddress ??
				clerkUser.emailAddresses[0]?.emailAddress ??
				'';

			const fullName = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ') || null;
			const metadataRoleRaw = clerkUser.publicMetadata?.role;
			const metadataRole =
				typeof metadataRoleRaw === 'string' ? (metadataRoleRaw.toUpperCase() as UserRole) : null;
			const resolvedRole =
				(metadataRole && ALLOWED_ROLES.has(metadataRole) ? metadataRole : undefined) ??
				existingUser?.role ??
				DEFAULT_ROLE;

			if (!primaryEmail) {
				console.error('Clerk user is missing an email address', { clerkUserId: auth.userId });
				event.locals.dbUser = existingUser ?? null;
				return resolve(event);
			}

			if (!existingUser) {
				// Check if user exists by email (e.g., from seed script) but without clerkUserId
				const userByEmail = await prisma.user.findUnique({
					where: { email: primaryEmail.toLowerCase() }
				});

				if (userByEmail) {
					// User exists but not linked to Clerk - link them now
					// Preserve existing role (database is source of truth) unless Clerk metadata has a valid role
					const finalRole =
						metadataRole && ALLOWED_ROLES.has(metadataRole) ? metadataRole : userByEmail.role;

					try {
						const dbUser = await prisma.user.update({
							where: { id: userByEmail.id },
							data: {
								clerkUserId: auth.userId,
								name: fullName ?? userByEmail.name,
								role: finalRole
							}
						});

						try {
							await linkPendingCoachInvites(dbUser);
						} catch (linkError) {
							console.error(
								'[auth:error] Failed to link pending coach invites',
								{ userId: dbUser.id, email: dbUser.email },
								linkError
							);
							// Don't fail the request if linking invites fails
						}

						event.locals.dbUser = dbUser;
						return resolve(event);
					} catch (updateError: unknown) {
						const ue = updateError instanceof Error ? updateError : new Error(String(updateError));
						console.error('[auth:error] Failed to update user with Clerk ID', {
							userId: userByEmail.id,
							email: userByEmail.email,
							clerkUserId: auth.userId,
							error: ue.message
						});
						// If update fails (e.g., constraint violation), return existing user
						event.locals.dbUser = userByEmail;
						return resolve(event);
					}
				}

				// No user exists - create new one
				try {
					const dbUser = await prisma.user.create({
						data: {
							clerkUserId: auth.userId,
							email: primaryEmail.toLowerCase(),
							name: fullName,
							role: resolvedRole
						}
					});

					try {
						await linkPendingCoachInvites(dbUser);
					} catch (linkError) {
						console.error(
							'[auth:error] Failed to link pending coach invites',
							{ userId: dbUser.id, email: dbUser.email },
							linkError
						);
					}

					// Domain-based organization auto-assignment
					try {
						const emailDomain = primaryEmail.toLowerCase().split('@')[1];
						if (emailDomain) {
							const org = await prisma.organization.findUnique({
								where: { domain: emailDomain }
							});
							if (org) {
								await prisma.organizationMember.upsert({
									where: {
										organizationId_userId: {
											organizationId: org.id,
											userId: dbUser.id
										}
									},
									update: {},
									create: {
										organizationId: org.id,
										userId: dbUser.id,
										role: 'MEMBER'
									}
								});
							}
						}
					} catch (orgError) {
						console.error('[auth:error] Failed to auto-assign organization', {
							userId: dbUser.id,
							email: dbUser.email,
							error: orgError
						});
					}

					event.locals.dbUser = dbUser;
					return resolve(event);
				} catch (createError: unknown) {
					const ce = createError instanceof Error ? createError : new Error(String(createError));
					console.error('[auth:error] Failed to create user', {
						email: primaryEmail.toLowerCase(),
						clerkUserId: auth.userId,
						error: ce.message
					});
					// If create fails, try to return existing user by email as fallback
					const fallbackUser = await prisma.user.findUnique({
						where: { email: primaryEmail.toLowerCase() }
					});
					event.locals.dbUser = fallbackUser ?? null;
					return resolve(event);
				}
			}

			const updates: Prisma.UserUpdateInput = {};

			if (existingUser.email.toLowerCase() !== primaryEmail.toLowerCase()) {
				updates.email = primaryEmail.toLowerCase();
			}

			if (existingUser.name !== fullName) {
				updates.name = fullName;
			}

			if (existingUser.role !== resolvedRole) {
				updates.role = resolvedRole;
			}

			if (Object.keys(updates).length === 0) {
				try {
					await linkPendingCoachInvites(existingUser);
				} catch (linkError) {
					console.error(
						'[auth:error] Failed to link pending coach invites',
						{ userId: existingUser.id, email: existingUser.email },
						linkError
					);
					// Don't fail the request if linking invites fails
				}

				event.locals.dbUser = existingUser;
				return resolve(event);
			}

			try {
				const dbUser = await prisma.user.update({
					where: { id: existingUser.id },
					data: updates
				});

				try {
					await linkPendingCoachInvites(dbUser);
				} catch (linkError) {
					console.error(
						'[auth:error] Failed to link pending coach invites',
						{ userId: dbUser.id, email: dbUser.email },
						linkError
					);
					// Don't fail the request if linking invites fails
				}

				event.locals.dbUser = dbUser;
				return resolve(event);
			} catch (updateError: unknown) {
				const ue2 = updateError instanceof Error ? updateError : new Error(String(updateError));
				console.error('[auth:error] Failed to update user', {
					userId: existingUser.id,
					email: existingUser.email,
					updates,
					error: ue2.message
				});
				// If update fails, return existing user as fallback
				event.locals.dbUser = existingUser;
				return resolve(event);
			}
		} catch (error: unknown) {
			const err = error instanceof Error ? error : new Error(String(error));
			console.error('[auth:error] Unexpected error in authentication hook', {
				clerkUserId: auth.userId,
				error: err.message,
				stack: err.stack
			});
			// Try to get existing user as fallback
			try {
				const fallbackUser = await prisma.user.findUnique({
					where: { clerkUserId: auth.userId }
				});
				event.locals.dbUser = fallbackUser ?? null;
			} catch {
				event.locals.dbUser = null;
			}
			return resolve(event);
		}
	},
	impersonateHandle
);

export const handleError = Sentry.handleErrorWithSentry();
