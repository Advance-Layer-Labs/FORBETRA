import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { clerkClient } from 'svelte-clerk/server';
import type { Actions, PageServerLoad } from './$types';
import type { UserRole } from '@prisma/client';

const ALLOWED_ROLES: UserRole[] = ['INDIVIDUAL', 'COACH', 'ADMIN', 'ORG_ADMIN'];

export const load: PageServerLoad = async (event) => {
	requireRole(event, 'ADMIN');

	const users = await prisma.user.findMany({
		orderBy: { createdAt: 'asc' },
		select: {
			id: true,
			email: true,
			name: true,
			role: true,
			clerkUserId: true,
			createdAt: true,
			updatedAt: true
		}
	});

	return {
		users,
		roles: ALLOWED_ROLES
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { dbUser } = requireRole(event, 'ADMIN');

		const formData = await event.request.formData();
		const intent = formData.get('intent');
		const userId = formData.get('userId');

		if (typeof userId !== 'string') {
			return fail(400, { error: 'Invalid submission payload.' });
		}

		if (intent === 'delete') {
			if (userId === dbUser.id) {
				return fail(400, { error: 'You cannot delete your own account.' });
			}

			try {
				const existingUser = await prisma.user.findUnique({
					where: { id: userId },
					include: {
						goals: true,
						coachNotesAuthored: true,
						coachNotesReceived: true
					}
				});

				if (!existingUser) {
					return fail(404, { error: 'User not found. It may have already been removed.' });
				}

				// Delete related records first to avoid foreign key constraints
				await prisma.$transaction(async (tx) => {
					const goalIds = existingUser.goals.map((g) => g.id);

					// Journeys cascade to their check-ins, feedback, and tokens
					await tx.journey.deleteMany({
						where: { OR: [{ userId }, { goalId: { in: goalIds } }] }
					});

					// Delete focusAreas linked to goals
					await tx.focusArea.deleteMany({ where: { goalId: { in: goalIds } } });

					// Delete goals
					await tx.goal.deleteMany({ where: { userId: userId } });

					// Delete coach notes
					await tx.coachNote.deleteMany({
						where: {
							OR: [{ coachId: userId }, { individualId: userId }]
						}
					});

					// Delete other related records
					await tx.coachClient.deleteMany({
						where: { OR: [{ coachId: userId }, { individualId: userId }] }
					});
					await tx.coachInvite.deleteMany({
						where: { OR: [{ coachId: userId }, { individualId: userId }] }
					});
					await tx.reviewer.deleteMany({
						where: { OR: [{ individualId: userId }, { invitedById: userId }] }
					});
					await tx.insight.deleteMany({ where: { userId: userId } });
					await tx.token.deleteMany({ where: { userId: userId } });

					// Finally delete the user
					await tx.user.delete({ where: { id: userId } });
				});

				// Delete from Clerk if linked
				if (existingUser.clerkUserId) {
					try {
						await clerkClient.users.deleteUser(existingUser.clerkUserId);
					} catch (error) {
						console.warn('Clerk user deletion failed or user already removed', {
							clerkUserId: existingUser.clerkUserId,
							error
						});
					}
				}

				return { success: true, message: 'User deleted successfully.' };
			} catch (error) {
				console.error('Failed to delete user', error);
				return fail(500, {
					error: 'Unable to delete user. Please try again or check server logs.'
				});
			}
		}

		const role = formData.get('role');

		if (typeof role !== 'string') {
			return fail(400, { error: 'Invalid submission payload.' });
		}

		const normalizedRole = role.toUpperCase() as UserRole;

		if (!ALLOWED_ROLES.includes(normalizedRole)) {
			return fail(400, { error: 'Unsupported role selection.' });
		}

		try {
			const updatedUser = await prisma.user.update({
				where: { id: userId },
				data: { role: normalizedRole }
			});

			if (updatedUser.clerkUserId) {
				await clerkClient.users.updateUser(updatedUser.clerkUserId, {
					publicMetadata: {
						role: normalizedRole
					}
				});
			}

			return { success: true, message: 'Role updated successfully.' };
		} catch (error) {
			console.error('Failed to update user role', error);
			return fail(500, { error: 'Unable to update role. Please try again.' });
		}
	}
};
