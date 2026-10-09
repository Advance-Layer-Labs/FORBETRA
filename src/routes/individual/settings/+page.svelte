<script lang="ts">
	import type { PageData } from './$types';
	import { enhance } from '$app/forms';
	import { browserTimeZone } from '$lib/notifications/preferences';
	import { addToast } from '$lib/stores/toasts.svelte';
	import { Settings2, User, Bell, Mail, Smartphone, Clock } from 'lucide-svelte';

	const { data }: { data: PageData } = $props();

	// --- Profile state ---
	let isSavingProfile = $state(false);
	let profileName = $state(data.user.name);
	let profilePhone = $state(data.user.phone);
	let profileTimezone = $state(data.user.timezone);
	let notificationTime = $state(data.user.notificationTime);
	let deliveryMethod = $state(data.user.deliveryMethod);
	let extraTimezone = $state('');
	let appliedEmptyTimezone = false;
	const needsPhone = $derived(
		(deliveryMethod === 'sms' || deliveryMethod === 'both') && !profilePhone?.trim()
	);

	const timezones = [
		'America/New_York',
		'America/Chicago',
		'America/Denver',
		'America/Los_Angeles',
		'America/Anchorage',
		'Pacific/Honolulu',
		'Europe/London',
		'Europe/Paris',
		'Europe/Berlin',
		'Asia/Tokyo',
		'Asia/Shanghai',
		'Asia/Kolkata',
		'Australia/Sydney',
		'Pacific/Auckland'
	];

	const timezoneOptions = $derived(
		extraTimezone && !timezones.includes(extraTimezone) ? [extraTimezone, ...timezones] : timezones
	);

	$effect(() => {
		if (appliedEmptyTimezone || data.user.timezone) return;
		appliedEmptyTimezone = true;
		const detected = browserTimeZone();
		if (!detected) return;
		extraTimezone = detected;
		profileTimezone = detected;
	});
</script>

<svelte:head>
	<title>Profile & Notifications | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-2xl flex-col gap-6 p-4 pb-12">
	<header>
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<nav aria-label="Breadcrumb" class="mb-2">
			<ol class="flex items-center gap-1.5 text-sm text-text-tertiary">
				<li>
					<a
						href="/individual"
						class="rounded transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
						>Journeys</a
					>
				</li>
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li><span class="font-medium text-text-primary">Settings</span></li>
			</ol>
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<div class="flex items-center gap-2">
			<Settings2 class="h-5 w-5 text-accent" />
			<h1 class="text-2xl font-bold text-text-primary">Profile & Notifications</h1>
		</div>
		<p class="mt-1 text-sm text-text-muted">Manage your profile and notification preferences.</p>
	</header>

	<!-- Profile & Notifications -->
	<form
		method="POST"
		action="?/updateProfile"
		use:enhance={() => {
			isSavingProfile = true;
			return async ({
				result,
				update
			}: {
				result: { type: string; data?: Record<string, unknown> };
				update: () => Promise<void>;
			}) => {
				isSavingProfile = false;
				if (result.type === 'redirect') {
					addToast('Session expired — please sign in again.', 'error');
					return;
				}
				if (result.type === 'error') {
					addToast('Something went wrong. Please try again.', 'error');
					return;
				}
				if (result.type === 'failure' && result.data?.error) {
					addToast(result.data.error as string, 'error');
					return;
				}
				if (result.type === 'success' && result.data?.success) {
					addToast(result.data.message as string, 'success');
				}
				await update();
				profileName = data.user.name;
				profilePhone = data.user.phone;
				profileTimezone = data.user.timezone;
				notificationTime = data.user.notificationTime;
				deliveryMethod = data.user.deliveryMethod;
			};
		}}
		class="space-y-5 rounded-xl border border-border-default bg-surface-raised p-5"
	>
		<div class="flex items-center gap-2">
			<User class="h-4 w-4 text-accent" />
			<h2 class="text-sm font-semibold tracking-wide text-text-tertiary uppercase">Profile</h2>
		</div>

		<div class="space-y-4">
			<div>
				<label for="name" class="mb-1.5 block text-sm font-medium text-text-secondary"
					>Display Name</label
				>
				<input
					id="name"
					name="name"
					type="text"
					bind:value={profileName}
					required
					class="w-full rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
				/>
			</div>

			<div>
				<label for="email" class="mb-1.5 block text-sm font-medium text-text-secondary">Email</label
				>
				<input
					id="email"
					type="email"
					value={data.user.email}
					disabled
					class="w-full rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-muted"
				/>
				<p class="mt-1 text-xs text-text-muted">Managed through your login provider.</p>
			</div>

			<div>
				<label for="phone" class="mb-1.5 block text-sm font-medium text-text-secondary"
					>Phone <span class="text-text-muted">(optional)</span></label
				>
				<input
					id="phone"
					name="phone"
					type="tel"
					bind:value={profilePhone}
					class="w-full rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
				/>
			</div>

			<div>
				<label for="timezone" class="mb-1.5 block text-sm font-medium text-text-secondary"
					>Timezone</label
				>
				<select
					id="timezone"
					name="timezone"
					bind:value={profileTimezone}
					class="w-full rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
				>
					<option value="">UTC</option>
					{#each timezoneOptions as tz (tz)}
						<option value={tz}>{tz.replace(/_/g, ' ')}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Notifications -->
		<div class="border-t border-border-default pt-5">
			<div class="mb-3 flex items-center gap-2">
				<Bell class="h-4 w-4 text-accent" />
				<span class="text-sm font-semibold tracking-wide text-text-tertiary uppercase"
					>Notifications</span
				>
			</div>

			<div class="space-y-4">
				<div>
					<label for="notificationTime" class="mb-1.5 block text-sm font-medium text-text-secondary"
						>Reminder Time</label
					>
					<div class="flex items-center gap-3">
						<Clock class="h-4 w-4 text-text-muted" />
						<input
							id="notificationTime"
							name="notificationTime"
							type="time"
							bind:value={notificationTime}
							class="w-40 rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
						/>
					</div>
				</div>

				<div>
					<p class="mb-1.5 text-sm font-medium text-text-secondary">Delivery Method</p>
					<div class="flex gap-2">
						<button
							type="button"
							onclick={() => (deliveryMethod = 'email')}
							class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors {deliveryMethod ===
							'email'
								? 'border-accent bg-accent/10 text-accent'
								: 'border-border-default bg-surface-subtle text-text-secondary hover:border-border-strong'}"
						>
							<Mail class="h-4 w-4" /> Email
						</button>
						<button
							type="button"
							onclick={() => (deliveryMethod = 'sms')}
							class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors {deliveryMethod ===
							'sms'
								? 'border-accent bg-accent/10 text-accent'
								: 'border-border-default bg-surface-subtle text-text-secondary hover:border-border-strong'}"
						>
							<Smartphone class="h-4 w-4" /> SMS
						</button>
						<button
							type="button"
							onclick={() => (deliveryMethod = 'both')}
							class="flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors {deliveryMethod ===
							'both'
								? 'border-accent bg-accent/10 text-accent'
								: 'border-border-default bg-surface-subtle text-text-secondary hover:border-border-strong'}"
						>
							Both
						</button>
					</div>
					<input type="hidden" name="deliveryMethod" value={deliveryMethod} />
					{#if deliveryMethod === 'sms' || deliveryMethod === 'both'}
						<p class="mt-2 text-xs leading-relaxed text-text-muted">
							By enabling SMS, you agree to receive automated text messages from Forbetra. ~1–4
							msgs/week. Msg & data rates may apply. Reply STOP to opt out.
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							<a href="/sms-terms" target="_blank" class="text-accent underline">SMS Terms</a>
							·
							<a href="/privacy" target="_blank" class="text-accent underline">Privacy</a>
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</p>
					{/if}
				</div>
			</div>
		</div>

		{#if needsPhone}
			<p
				class="rounded-lg border border-warning/30 bg-warning-muted px-4 py-2.5 text-sm text-warning"
			>
				Please enter a phone number above to use SMS delivery.
			</p>
		{/if}

		<div class="flex justify-end">
			<button
				type="submit"
				disabled={isSavingProfile || needsPhone}
				class="rounded-lg bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
			>
				{isSavingProfile ? 'Saving...' : 'Save'}
			</button>
		</div>
	</form>

</section>
