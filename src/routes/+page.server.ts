import { fail, redirect } from '@sveltejs/kit';
import { getOptionalAuth } from '$lib/server/auth';
import prisma from '$lib/server/prisma';
import { clerkClient } from 'svelte-clerk/server';
import type { Actions, PageServerLoad } from './$types';
import type { UserRole } from '@prisma/client';

export const load: PageServerLoad = async (event) => {
	const { session, dbUser } = getOptionalAuth(event);

	if (dbUser) {
		// Check if user is brand-new: default INDIVIDUAL role, no goals, no coach onboarding
		if (dbUser.role === 'INDIVIDUAL' && !dbUser.coachOnboardingCompletedAt) {
			const goalCount = await prisma.goal.count({
				where: { userId: dbUser.id }
			});

			if (goalCount === 0) {
				return {
					showRoleSelection: true,
					userId: session.userId,
					dbUser
				};
			}
		}

		// Redirect individuals to their hub
		if (dbUser.role === 'INDIVIDUAL') {
			throw redirect(303, '/individual/today');
		}

		// Redirect coaches to their hub
		if (dbUser.role === 'COACH') {
			throw redirect(303, '/coach');
		}

		// Redirect admins to their dashboard
		if (dbUser.role === 'ADMIN') {
			throw redirect(303, '/admin');
		}

		if (dbUser.role === 'ORG_ADMIN') {
			throw redirect(303, '/admin/organizations');
		}

		// Reviewers use tokenized feedback links — no authenticated hub to redirect to
	}

	return {
		showRoleSelection: false,
		userId: session.userId,
		dbUser
	};
};

export const actions: Actions = {
	selectRole: async (event) => {
		const { dbUser } = getOptionalAuth(event);

		if (!dbUser) {
			return fail(401, { error: 'You must be signed in.' });
		}

		const formData = await event.request.formData();
		const role = formData.get('role');

		if (role !== 'INDIVIDUAL' && role !== 'COACH') {
			return fail(400, { error: 'Invalid role selection.' });
		}

		const normalizedRole = role as UserRole;

		try {
			const updatedUser = await prisma.user.update({
				where: { id: dbUser.id },
				data: { role: normalizedRole }
			});

			if (updatedUser.clerkUserId) {
				await clerkClient.users.updateUser(updatedUser.clerkUserId, {
					publicMetadata: {
						role: normalizedRole
					}
				});
			}
		} catch (error) {
			console.error('Failed to update user role', error);
			return fail(500, { error: 'Unable to update role. Please try again.' });
		}

		if (normalizedRole === 'COACH') {
			throw redirect(303, '/coach');
		}

		throw redirect(303, '/individual/today');
	}
};
