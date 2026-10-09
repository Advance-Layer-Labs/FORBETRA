import { fail, redirect } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { weekNumberForDate } from '$lib/server/domain';
import { clerkClient } from 'svelte-clerk/server';
import type { Actions, PageServerLoad } from './$types';
import type { UserRole } from '@prisma/client';

const ALLOWED_ROLES: UserRole[] = ['INDIVIDUAL', 'COACH', 'ADMIN', 'ORG_ADMIN'];

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const { id } = event.params;

	const user = await prisma.user.findUnique({
		where: { id },
		include: {
			goals: {
				include: {
					focusAreas: { orderBy: [{ order: 'asc' }, { createdAt: 'asc' }] },
					journeys: {
						orderBy: { startDate: 'desc' },
						include: {
							checkIns: {
								orderBy: { submittedAt: 'desc' },
								take: 20,
								select: {
									id: true,
									effortScore: true,
									performanceScore: true,
									submittedAt: true
								}
							},
							coachNotes: {
								orderBy: { createdAt: 'desc' },
								take: 10,
								select: {
									id: true,
									content: true,
									weekNumber: true,
									createdAt: true,
									coach: { select: { name: true } }
								}
							},
							_count: { select: { checkIns: true } }
						}
					}
				}
			},
			reviewers: {
				orderBy: { createdAt: 'asc' },
				include: {
					_count: { select: { feedback: true } }
				}
			},
			coachClientsManaged: {
				include: { individual: { select: { id: true, name: true, email: true } } }
			},
			coachClientsOwned: {
				include: { coach: { select: { name: true, email: true } } }
			}
		}
	});

	if (!user) {
		throw redirect(303, '/admin/users');
	}

	const { reviewers, ...rest } = user;
	return {
		user: {
			...rest,
			goals: rest.goals.map((goal) => ({
				...goal,
				journeys: goal.journeys.map((journey) => ({
					...journey,
					checkIns: journey.checkIns.map((checkIn) => ({
						...checkIn,
						weekNumber: weekNumberForDate(journey.startDate, checkIn.submittedAt, user.timezone)
					}))
				})),
				reviewers: reviewers.filter((r) => !r.goalId || r.goalId === goal.id)
			}))
		},
		roles: ALLOWED_ROLES
	};
};

export const actions: Actions = {
	updateUser: async (event) => {
		requireRole(event, 'ADMIN');
		const { id } = event.params;
		const formData = await event.request.formData();

		const name = (formData.get('name') as string)?.trim() || null;
		const email = (formData.get('email') as string)?.trim();
		const roleRaw = formData.get('role');

		if (!email) {
			return fail(400, { error: 'Email is required.' });
		}

		if (!roleRaw || typeof roleRaw !== 'string') {
			return fail(400, { error: 'Role is required.' });
		}

		const role = roleRaw.toUpperCase() as UserRole;
		if (!ALLOWED_ROLES.includes(role)) {
			return fail(400, { error: 'Invalid role.' });
		}

		try {
			const updated = await prisma.user.update({
				where: { id },
				data: { name, email, role }
			});

			if (updated.clerkUserId) {
				try {
					await clerkClient.users.updateUser(updated.clerkUserId, {
						publicMetadata: { role }
					});
				} catch {
					// Clerk sync failure is non-fatal
				}
			}

			return { success: true, message: 'User updated.' };
		} catch (error: unknown) {
			if (
				typeof error === 'object' &&
				error !== null &&
				'code' in error &&
				(error as { code: string }).code === 'P2002'
			) {
				return fail(400, { error: 'A user with this email already exists.' });
			}
			return fail(500, { error: 'Failed to update user.' });
		}
	}
};
