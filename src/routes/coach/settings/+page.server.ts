import { fail } from '@sveltejs/kit';
import prisma from '$lib/server/prisma';
import { requireRole } from '$lib/server/auth';
import { clerkClient } from 'svelte-clerk/server';
import type { Actions, PageServerLoad } from './$types';
import { validatePhone, normalizePhone } from '$lib/utils/phone';

export const load: PageServerLoad = async (event) => {
	const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

	return {
		user: {
			name: dbUser.name ?? '',
			email: dbUser.email,
			phone: dbUser.phone ?? '',
			timezone: dbUser.timezone ?? '',
			deliveryMethod: dbUser.deliveryMethod ?? 'email',
			role: dbUser.role,
			coachingFocus: dbUser.coachingFocus ?? '',
			practiceName: dbUser.practiceName ?? '',
			practiceDescription: dbUser.practiceDescription ?? ''
		}
	};
};

export const actions: Actions = {
	default: async (event) => {
		const { dbUser } = requireRole(event, ['COACH', 'ADMIN']);

		const formData = await event.request.formData();
		const name = formData.get('name')?.toString().trim() ?? '';
		const phone = formData.get('phone')?.toString().trim() ?? '';
		const timezone = formData.get('timezone')?.toString().trim() ?? '';
		const deliveryMethod = formData.get('deliveryMethod')?.toString().trim() ?? 'email';
		const method = deliveryMethod === 'sms' || deliveryMethod === 'both' ? deliveryMethod : 'email';
		const coachingFocus = formData.get('coachingFocus')?.toString().trim() ?? '';
		const practiceName = formData.get('practiceName')?.toString().trim() ?? '';
		const practiceDescription = formData.get('practiceDescription')?.toString().trim() ?? '';

		if (!name) {
			return fail(400, { error: 'Display name is required.' });
		}

		if (name.length > 100) {
			return fail(400, { error: 'Display name must be 100 characters or fewer.' });
		}

		if (phone && !validatePhone(phone)) {
			return fail(400, {
				error: 'Enter a valid phone number (7\u201315 digits, e.g. +1 555 123 4567).'
			});
		}

		if ((method === 'sms' || method === 'both') && !phone) {
			return fail(400, { error: 'Add a phone number to receive SMS.' });
		}

		if (coachingFocus && (coachingFocus.length < 2 || coachingFocus.length > 80)) {
			return fail(400, { error: 'Coaching focus must be 2–80 characters.' });
		}

		if (practiceName && (practiceName.length < 2 || practiceName.length > 80)) {
			return fail(400, { error: 'Practice name must be 2–80 characters.' });
		}

		if (practiceDescription.length > 160) {
			return fail(400, { error: 'Practice description must be 160 characters or fewer.' });
		}

		try {
			const updatedUser = await prisma.user.update({
				where: { id: dbUser.id },
				data: {
					name: name || null,
					phone: phone ? normalizePhone(phone) : null,
					timezone: timezone || null,
					deliveryMethod: method,
					coachingFocus: coachingFocus || null,
					practiceName: practiceName || null,
					practiceDescription: practiceDescription || null
				}
			});

			if (updatedUser.clerkUserId && name) {
				try {
					await clerkClient.users.updateUser(updatedUser.clerkUserId, {
						firstName: name.split(' ')[0],
						lastName: name.split(' ').slice(1).join(' ') || undefined
					});
				} catch (error) {
					console.warn('Failed to sync name to Clerk', error);
				}
			}

			return { success: true, message: 'Settings saved.' };
		} catch (error) {
			console.error('Failed to update settings', error);
			return fail(500, { error: 'Unable to save settings. Please try again.' });
		}
	}
};
