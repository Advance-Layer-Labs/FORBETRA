<script lang="ts">
	import type { ActionData, PageData } from './$types';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	const formatDate = (value: string | null | undefined) => {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};

	const ctaMessage = () => {
		if (data.status === 'invalid') return 'This invitation link is invalid.';
		if (data.status === 'expired') return 'This invitation has expired.';
		if (data.status === 'cancelled') return 'This invitation has been cancelled.';
		if (data.status === 'accepted') return 'This invitation has already been accepted.';
		return null;
	};

	const showAcceptForm = () => {
		if (data.status !== 'valid') return false;
		if (!data.user) return false;
		if (data.user.role !== 'INDIVIDUAL') return false;
		if (form?.success) return false;
		return true;
	};
</script>

<svelte:head>
	<title>Accept Invitation | Forbetra</title>
</svelte:head>

<section class="mx-auto flex min-h-[70vh] max-w-3xl flex-col gap-6 px-4 py-12">
	<header class="space-y-2 text-center">
		<h1 class="text-3xl font-semibold text-text-primary">Join your coach</h1>
		{#if data.invite}
			<p class="text-sm text-text-tertiary">
				{data.invite.coach.name} has invited you to collaborate in Forbetra.
			</p>
		{:else}
			<p class="text-sm text-text-tertiary">We couldn't find this invitation.</p>
		{/if}
	</header>

	{#if ctaMessage()}
		<div
			class="rounded-xl border border-border-strong bg-warning-muted px-4 py-3 text-sm text-warning"
		>
			{ctaMessage()}
		</div>
	{/if}

	{#if data.invite}
		<section class="glass-raised space-y-4 rounded-2xl border border-border-default p-6">
			<div class="space-y-2">
				<p class="text-xs tracking-[0.35em] text-text-muted uppercase">Invitation details</p>
				<p class="text-sm text-text-tertiary">
					Sent to <span class="font-semibold text-text-secondary">{data.invite.email}</span> ·
					Expires
					{formatDate(data.invite.expiresAt)}
				</p>
				{#if data.invite.message}
					<div
						class="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-secondary"
					>
						<p class="font-semibold text-text-secondary">Message from your coach</p>
						<p class="text-xs text-text-tertiary">{data.invite.message}</p>
					</div>
				{/if}
			</div>

			<section
				class="space-y-2 rounded-xl border border-border-default bg-surface-raised px-4 py-3"
			>
				<p class="text-xs font-semibold tracking-[0.3em] text-text-tertiary uppercase">Coach</p>
				<p class="text-lg font-semibold text-text-primary">{data.invite.coach.name}</p>
				<p class="text-sm text-text-tertiary">{data.invite.coach.email}</p>
			</section>

			{#if !data.user}
				<div
					class="space-y-3 rounded-xl border border-accent/30 bg-accent-muted px-4 py-3 text-sm text-accent"
				>
					<div>
						<p class="font-semibold text-accent">Almost there</p>
						<p>
							Sign in or create an account to accept this invitation. Use the email above if your
							coach asked you to.
						</p>
					</div>
					<div class="flex flex-wrap gap-2">
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href="/sign-in?redirect=/coach/invite/{data.token}"
							class="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover"
						>
							Sign in
						</a>
						<a
							href="/sign-up?redirect=/coach/invite/{data.token}"
							class="inline-flex items-center justify-center rounded-lg border border-accent px-4 py-2 text-xs font-semibold text-accent transition hover:bg-accent-muted"
						>
							Create account
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					</div>
				</div>
			{:else if data.user.role !== 'INDIVIDUAL'}
				<div class="rounded-xl border border-error/50 bg-error-muted px-4 py-3 text-sm text-error">
					<p class="font-semibold text-error">Role not supported</p>
					<p>
						This invitation links an individual account with a coach. You're currently signed in as
						a
						{data.user.role.toLowerCase()}. Please use an individual account.
					</p>
				</div>
			{/if}

			{#if form?.error}
				<div class="rounded-xl border border-error/50 bg-error-muted px-4 py-2 text-sm text-error">
					{form.error}
				</div>
			{/if}

			{#if form?.success}
				<div
					class="space-y-2 rounded-xl border border-success/50 bg-success-muted px-4 py-3 text-sm text-success"
				>
					<p class="font-semibold text-success">You're connected!</p>
					<p>
						We've linked your account with {data.invite.coach.name}. Return to
						<!-- eslint-disable svelte/no-navigation-without-resolve --><a
							href="/individual/today"
							class="font-semibold text-success underline"
						>
							Today</a
						><!-- eslint-enable svelte/no-navigation-without-resolve --> to keep going.
					</p>
				</div>
			{/if}

			{#if showAcceptForm()}
				<form method="post" action="?/accept" class="space-y-4">
					<input type="hidden" name="token" value={data.token} />
					<button
						type="submit"
						class="inline-flex w-full items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
					>
						Accept invitation
					</button>
					<p class="text-center text-xs text-text-muted">
						Need help? Reach out to {data.invite.coach.email}.
					</p>
				</form>
			{:else if data.status === 'valid' && !form?.success}
				<div
					class="rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-secondary"
				>
					{#if !data.user}
						<p>
							Please sign in first. Use the button in the top-right corner to log in with the email
							your coach invited.
						</p>
					{:else if data.user.role !== 'INDIVIDUAL'}
						<p>Switch to an individual account to accept this invitation.</p>
					{/if}
				</div>
			{/if}
		</section>
	{/if}
</section>
