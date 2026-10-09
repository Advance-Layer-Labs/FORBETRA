<script lang="ts">
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toasts.svelte';
	import {
		Mail,
		AlertTriangle,
		CircleCheck,
		Lightbulb,
		Inbox,
		Send,
		Copy,
		Check,
		Smartphone,
		ChevronDown,
		Target,
		Plus,
		X
	} from 'lucide-svelte';
	import type { PageData, ActionData } from './$types';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	let copiedInviteUrl = $state(false);

	async function copyInviteUrl(url: string) {
		try {
			await navigator.clipboard.writeText(url);
			copiedInviteUrl = true;
			setTimeout(() => {
				copiedInviteUrl = false;
			}, 2000);
		} catch {
			addToast('Could not copy to clipboard.', 'error');
		}
	}

	const defaultInviteMessage =
		`Hi there—I'd love for you to join me in Forbetra so we can track your progress together. ` +
		`The link above will guide you through creating your account and connecting with me as your coach.`;

	const formatDateTime = (value: string | null | undefined) => {
		if (!value) return '—';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};

	let emailError = $state('');
	const validateEmail = (email: string) => {
		if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			emailError = 'Please enter a valid email address.';
		} else {
			emailError = '';
		}
	};

	// Per-index email errors for pre-fill reviewer rows
	let reviewerEmailErrors = $state<string[]>([]);
	const validateReviewerEmail = (email: string, index: number) => {
		const errors = [...reviewerEmailErrors];
		if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
			errors[index] = 'Please enter a valid email address.';
		} else {
			errors[index] = '';
		}
		reviewerEmailErrors = errors;
	};

	const formatTimeFromNow = (value: string | null | undefined) => {
		if (!value) return '—';
		const diff = new Date(value).getTime() - Date.now();
		const days = Math.ceil(diff / (24 * 60 * 60 * 1000));
		if (days <= 0) return 'Expired';
		if (days === 1) return '1 day left';
		return `${days} days left`;
	};

	// --- Status helpers ---
	type InviteStatus = 'accepted' | 'cancelled' | 'expired' | 'pending';

	function getInviteStatus(invite: {
		acceptedAt: string | null;
		cancelledAt: string | null;
		expiresAt: string;
	}): InviteStatus {
		if (invite.acceptedAt) return 'accepted';
		if (invite.cancelledAt) return 'cancelled';
		if (new Date(invite.expiresAt).getTime() < Date.now()) return 'expired';
		return 'pending';
	}

	const statusConfig: Record<InviteStatus, { label: string; class: string; dotColor: string }> = {
		accepted: { label: 'Accepted', class: 'text-success', dotColor: 'bg-success' },
		cancelled: { label: 'Cancelled', class: 'text-text-tertiary', dotColor: 'bg-text-muted' },
		expired: { label: 'Expired', class: 'text-error', dotColor: 'bg-error' },
		pending: { label: 'Pending', class: 'text-warning', dotColor: 'bg-warning' }
	};

	// --- Filter tabs ---
	type FilterTab = 'all' | 'pending' | 'accepted' | 'cancelled';
	let activeFilter = $state<FilterTab>('all');

	const filteredInvitations = $derived.by(() => {
		if (activeFilter === 'all') return data.invitations;
		return data.invitations.filter((invite) => {
			const status = getInviteStatus(invite);
			if (activeFilter === 'cancelled') return status === 'cancelled' || status === 'expired';
			return status === activeFilter;
		});
	});

	function countByFilter(filter: FilterTab): number {
		if (filter === 'all') return data.invitations.length;
		return data.invitations.filter((invite) => {
			const status = getInviteStatus(invite);
			if (filter === 'cancelled') return status === 'cancelled' || status === 'expired';
			return status === filter;
		}).length;
	}

	// --- Loading states ---
	let submittingCreate = $state(false);
	let submittingCancel = $state<string | null>(null);
	let submittingResend = $state<string | null>(null);
	let smsEnabled = $state(false);
	let showPrefill = $state(false);
	let prefillFocusAreas = $state([{ label: '', description: '' }]);
	let prefillReviewers = $state([{ name: '', email: '' }]);

	// --- Toast on form success ---
	let toastShownForForm: typeof form = null;
	$effect(() => {
		if (!form || form === toastShownForForm) return;
		toastShownForForm = form;
		if (form.action === 'cancelInvite' && form.success) {
			addToast('Invitation cancelled', 'success');
		} else if (form.action === 'resendInvite' && form.success) {
			addToast(`Invitation resent to ${form.email}`, 'success');
		} else if (form.error) {
			addToast(form.error, 'error');
		}
	});

	const filterTabs: { key: FilterTab; label: string }[] = [
		{ key: 'all', label: 'All' },
		{ key: 'pending', label: 'Pending' },
		{ key: 'accepted', label: 'Accepted' },
		{ key: 'cancelled', label: 'Cancelled' }
	];
</script>

<svelte:head>
	<title>Invitations | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-12">
	<!-- Email mode banner -->
	{#if data.emailMode === 'mock'}
		<div class="rounded-xl border border-accent/30 bg-accent-muted px-4 py-3 text-sm text-accent">
			<p class="font-semibold">
				Dev mode — emails are logged to the console but not actually sent.
			</p>
		</div>
	{/if}

	<!-- Header -->
	<header>
		<nav aria-label="Breadcrumb" class="mb-2">
			<ol class="flex items-center gap-1.5 text-sm text-text-tertiary">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<li>
					<a
						href="/coach"
						class="rounded transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
						>Dashboard</a
					>
				</li>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li><span class="font-medium text-text-primary">Invitations</span></li>
			</ol>
		</nav>
		<h1 class="text-2xl font-bold text-text-primary">Invite a Client</h1>
		<p class="mt-1 text-sm text-text-muted">Send a secure invite link via email</p>
	</header>

	<!-- Duplicate warning -->
	{#if form?.duplicate && form?.existingInvite}
		<div
			class="space-y-3 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm text-warning"
		>
			<div class="flex items-center gap-2">
				<AlertTriangle class="h-4 w-4" />
				<p class="font-semibold">Active invitation exists for {form.existingInvite.email}</p>
			</div>
			<div class="flex gap-2">
				<form
					method="post"
					action="?/resendInvite"
					use:enhance={() => {
						submittingResend = form?.existingInvite?.id ?? null;
						return async ({ result, update }) => {
							submittingResend = null;
							if (result.type === 'redirect' || result.type === 'error') {
								addToast('Something went wrong. Please try again.', 'error');
								return;
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="inviteId" value={form.existingInvite.id} />
					<button
						type="submit"
						disabled={submittingResend === form.existingInvite.id}
						class="rounded-lg bg-accent px-4 py-2 text-xs font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50"
					>
						{submittingResend === form.existingInvite.id ? 'Resending...' : 'Resend'}
					</button>
				</form>
				<form
					method="post"
					action="?/cancelInvite"
					use:enhance={() => {
						submittingCancel = form?.existingInvite?.id ?? null;
						return async ({ result, update }) => {
							submittingCancel = null;
							if (result.type === 'redirect' || result.type === 'error') {
								addToast('Something went wrong. Please try again.', 'error');
								return;
							}
							await update();
						};
					}}
				>
					<input type="hidden" name="inviteId" value={form.existingInvite.id} />
					<button
						type="submit"
						disabled={submittingCancel === form.existingInvite.id}
						class="rounded-lg border border-border-strong bg-surface-raised px-4 py-2 text-xs font-semibold text-warning transition hover:bg-surface-subtle disabled:opacity-50"
					>
						{submittingCancel === form.existingInvite.id ? 'Cancelling...' : 'Cancel'}
					</button>
				</form>
			</div>
		</div>
	{:else if form?.action === 'createInvite' && form?.success}
		<div
			class="space-y-3 rounded-xl border border-success/50 bg-success-muted px-4 py-3 text-sm text-success"
		>
			<div class="flex items-center gap-2">
				<CircleCheck class="h-4 w-4" />
				<p class="font-semibold">Invitation sent to {form.email}!</p>
			</div>
			{#if form.emailFailed}
				<div
					class="rounded-lg border border-warning/30 bg-warning-muted px-4 py-2 text-xs text-warning"
				>
					Email could not be sent. Share the link below directly.
				</div>
			{/if}
			{#if form.inviteUrl}
				<div
					class="flex items-center gap-2 rounded-lg border border-success/30 bg-surface-raised px-3 py-2"
				>
					<p class="flex-1 font-mono text-xs break-all">{form.inviteUrl}</p>
					<button
						type="button"
						onclick={() => copyInviteUrl(form?.inviteUrl ?? '')}
						class="shrink-0 rounded-md border border-success/30 p-1.5 text-success transition-all hover:bg-success/20"
						aria-label="Copy invite link"
					>
						{#if copiedInviteUrl}
							<Check class="h-4 w-4" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</button>
				</div>
				<p class="text-xs">
					<Lightbulb class="inline h-3.5 w-3.5 text-text-muted" /> Expires in 30 days.
				</p>
			{/if}
		</div>
	{:else if form?.error}
		<div class="rounded-xl border border-error/50 bg-error-muted px-4 py-3 text-sm text-error">
			<AlertTriangle class="inline h-4 w-4" />
			{form.error}
		</div>
	{/if}

	<!-- Invite Form -->
	<form
		method="post"
		action="?/createInvite"
		use:enhance={() => {
			submittingCreate = true;
			return async ({ result, update }) => {
				submittingCreate = false;
				if (result.type === 'redirect' || result.type === 'error') {
					addToast('Something went wrong. Please try again.', 'error');
					return;
				}
				await update();
				if (result.type === 'success') {
					emailError = '';
				}
			};
		}}
		class="space-y-4 rounded-xl border border-border-default bg-surface-raised p-5"
	>
		<div class="grid gap-3 sm:grid-cols-2">
			<label class="space-y-1 text-sm">
				<span class="font-semibold text-text-secondary">Email</span>
				<input
					type="email"
					name="email"
					class="w-full rounded-lg border bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none {emailError
						? 'border-error'
						: 'border-border-default'}"
					placeholder="alex@example.com"
					required
					value={form?.success ? '' : (form?.values?.email ?? '')}
					onblur={(e) => validateEmail(e.currentTarget.value)}
					oninput={(e) => {
						if (emailError) validateEmail(e.currentTarget.value);
					}}
				/>
				{#if emailError}
					<p class="text-xs text-error">{emailError}</p>
				{/if}
			</label>
			<label class="space-y-1 text-sm">
				<span class="font-semibold text-text-secondary">Name (optional)</span>
				<input
					type="text"
					name="name"
					class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					placeholder="Alex Jensen"
					value={form?.success ? '' : (form?.values?.name ?? '')}
				/>
			</label>
		</div>
		<!-- Delivery Method -->
		<div class="space-y-3">
			<p class="text-sm font-semibold text-text-secondary">Delivery</p>
			<div class="flex gap-3">
				<div
					class="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent-muted px-3 py-2 text-sm font-medium text-accent"
				>
					<Mail class="h-4 w-4" /> Email
				</div>
				<button
					type="button"
					onclick={() => (smsEnabled = !smsEnabled)}
					class="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all {smsEnabled
						? 'border-accent/30 bg-accent-muted text-accent'
						: 'border-border-default bg-surface-subtle text-text-tertiary hover:text-text-secondary'}"
				>
					<Smartphone class="h-4 w-4" /> SMS {smsEnabled ? 'on' : 'off'}
				</button>
			</div>
			{#if smsEnabled}
				<label class="space-y-1 text-sm">
					<span class="font-semibold text-text-secondary">Phone number</span>
					<input
						type="tel"
						name="phone"
						class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
						placeholder="+1 555 123 4567"
						value={form?.success ? '' : (form?.values?.phone ?? '')}
						required
					/>
				</label>
			{/if}
		</div>
		<label class="space-y-1 text-sm">
			<span class="font-semibold text-text-secondary">Message (optional)</span>
			<textarea
				name="message"
				rows="3"
				class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
				placeholder="Add context for why you're inviting them."
				>{form?.success
					? defaultInviteMessage
					: (form?.values?.message ?? defaultInviteMessage)}</textarea
			>
		</label>
		<!-- Pre-fill section -->
		<div class="border-t border-border-default pt-4">
			<button
				type="button"
				onclick={() => (showPrefill = !showPrefill)}
				class="flex w-full items-center gap-2 text-sm font-semibold text-text-secondary transition-colors hover:text-text-primary"
			>
				<Target class="h-4 w-4 text-accent" />
				Pre-fill their setup
				<span class="text-xs font-normal text-text-muted">(optional)</span>
				<ChevronDown
					class="ml-auto h-4 w-4 transition-transform {showPrefill ? 'rotate-180' : ''}"
				/>
			</button>
			<p class="mt-1 text-xs text-text-muted">
				Set their goal, focus areas, and reviewers. They'll review and confirm during onboarding.
			</p>

			{#if showPrefill}
				<div class="mt-4 space-y-4">
					<!-- Goal -->
					<label class="space-y-1 text-sm">
						<span class="font-semibold text-text-secondary">Goal Title</span>
						<input
							type="text"
							name="goalTitle"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							placeholder="e.g. Develop executive presence"
							maxlength="200"
						/>
					</label>
					<label class="space-y-1 text-sm">
						<span class="font-semibold text-text-secondary"
							>Goal Description <span class="font-normal text-text-muted">(optional)</span></span
						>
						<textarea
							name="goalDescription"
							rows="2"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							placeholder="What does success look like?"
							maxlength="1000"
						></textarea>
					</label>

					<!-- FocusAreas -->
					<div class="space-y-2">
						<span class="text-sm font-semibold text-text-secondary"
							>Focus Areas <span class="font-normal text-text-muted">(optional)</span></span
						>
						{#each prefillFocusAreas as focusArea, i (i)}
							<div class="flex gap-2">
								<input
									type="text"
									name="focusAreaLabel{i + 1}"
									bind:value={focusArea.label}
									class="flex-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
									placeholder="e.g. Active listening"
									maxlength="200"
								/>
								{#if prefillFocusAreas.length > 1}
									<button
										type="button"
										onclick={() =>
											(prefillFocusAreas = prefillFocusAreas.filter((_, idx) => idx !== i))}
										class="shrink-0 rounded-lg border border-border-default p-2 text-text-muted transition-colors hover:border-error/30 hover:text-error"
										aria-label="Remove focus area"
									>
										<X class="h-4 w-4" />
									</button>
								{/if}
							</div>
						{/each}
						{#if prefillFocusAreas.length < 5}
							<button
								type="button"
								onclick={() =>
									(prefillFocusAreas = [...prefillFocusAreas, { label: '', description: '' }])}
								class="flex items-center gap-1 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
							>
								<Plus class="h-3.5 w-3.5" /> Add focus area
							</button>
						{/if}
					</div>

					<!-- Reviewers -->
					<div class="space-y-2">
						<span class="text-sm font-semibold text-text-secondary"
							>Suggested Reviewers <span class="font-normal text-text-muted">(optional)</span></span
						>
						{#each prefillReviewers as reviewer, i (i)}
							<div class="space-y-1">
								<div class="flex gap-2">
									<input
										type="text"
										name="reviewerName{i + 1}"
										bind:value={reviewer.name}
										class="flex-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
										placeholder="Name"
										maxlength="120"
									/>
									<input
										type="email"
										name="reviewerEmail{i + 1}"
										bind:value={reviewer.email}
										aria-invalid={!!reviewerEmailErrors[i]}
										aria-describedby={reviewerEmailErrors[i]
											? `reviewer-email-error-${i}`
											: undefined}
										class="flex-1 rounded-lg border bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:ring-2 focus:outline-none {reviewerEmailErrors[
											i
										]
											? 'border-error focus:border-error focus:ring-error/30'
											: 'border-border-default focus:border-accent focus:ring-accent/30'}"
										placeholder="Email"
										onblur={(e) => validateReviewerEmail(e.currentTarget.value, i)}
										oninput={(e) => {
											if (reviewerEmailErrors[i])
												validateReviewerEmail(e.currentTarget.value, i);
										}}
									/>
									{#if prefillReviewers.length > 1}
										<button
											type="button"
											onclick={() => {
												prefillReviewers = prefillReviewers.filter((_, idx) => idx !== i);
												reviewerEmailErrors = reviewerEmailErrors.filter(
													(_, idx) => idx !== i
												);
											}}
											class="shrink-0 rounded-lg border border-border-default p-2 text-text-muted transition-colors hover:border-error/30 hover:text-error"
											aria-label="Remove reviewer"
										>
											<X class="h-4 w-4" />
										</button>
									{/if}
								</div>
								{#if reviewerEmailErrors[i]}
									<p id="reviewer-email-error-{i}" class="text-xs text-error">
										{reviewerEmailErrors[i]}
									</p>
								{/if}
							</div>
						{/each}
						{#if prefillReviewers.length < 5}
							<button
								type="button"
								onclick={() =>
									(prefillReviewers = [...prefillReviewers, { name: '', email: '' }])}
								class="flex items-center gap-1 text-xs font-semibold text-accent transition-colors hover:text-accent-hover"
							>
								<Plus class="h-3.5 w-3.5" /> Add reviewer
							</button>
						{/if}
					</div>
				</div>
			{/if}
		</div>

		<button
			type="submit"
			disabled={submittingCreate}
			class="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-50"
		>
			<Send class="h-4 w-4" />
			{submittingCreate ? 'Sending...' : 'Send Invitation'}
		</button>
	</form>

	<!-- Active Invitations -->
	<div class="space-y-4">
		<div class="flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Inbox class="h-4 w-4 text-text-muted" />
				<h2 class="font-semibold text-text-primary">Invitations</h2>
			</div>
			<span class="rounded-full bg-accent-muted px-3 py-1 text-xs font-bold text-accent">
				{data.invitations.filter(
					(inv) =>
						!inv.acceptedAt && !inv.cancelledAt && new Date(inv.expiresAt).getTime() > Date.now()
				).length} active
			</span>
		</div>

		<!-- Filter tabs -->
		<div class="flex gap-1 rounded-lg bg-surface-subtle p-1">
			{#each filterTabs as tab (tab.key)}
				{@const count = countByFilter(tab.key)}
				<button
					type="button"
					onclick={() => (activeFilter = tab.key)}
					class="flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-all {activeFilter ===
					tab.key
						? 'bg-surface-raised text-text-primary'
						: 'text-text-tertiary hover:text-text-secondary'}"
				>
					{tab.label}
					<span class="text-2xs ml-1 {activeFilter === tab.key ? 'text-accent' : ''}">{count}</span>
				</button>
			{/each}
		</div>

		{#if filteredInvitations.length === 0}
			<div
				class="rounded-xl border border-dashed border-border-strong bg-surface-raised p-8 text-center"
			>
				{#if activeFilter === 'all'}
					<Mail class="mx-auto mb-2 h-6 w-6 text-text-muted" />
					<p class="text-sm text-text-secondary">No invitations yet</p>
				{:else}
					<p class="text-sm text-text-tertiary">No {activeFilter} invitations.</p>
				{/if}
			</div>
		{:else}
			<ul class="space-y-2">
				{#each filteredInvitations as invite (invite.id)}
					{@const status = getInviteStatus(invite)}
					{@const config = statusConfig[status]}
					<li
						class="rounded-xl border border-border-default bg-surface-raised p-4 transition-all hover:border-accent/30"
					>
						<div class="flex items-baseline justify-between gap-3">
							<div>
								<p class="font-medium text-text-primary">{invite.name ?? invite.email}</p>
								{#if invite.name}
									<p class="text-xs text-text-tertiary">{invite.email}</p>
								{/if}
							</div>
							<span class="flex items-center gap-1.5 text-xs font-semibold {config.class}">
								<span class="h-2 w-2 rounded-full {config.dotColor}"></span>
								{status === 'pending' ? formatTimeFromNow(invite.expiresAt) : config.label}
							</span>
						</div>
						<div class="mt-2 flex flex-wrap items-center gap-3 text-xs text-text-tertiary">
							<span>{formatDateTime(invite.createdAt)}</span>
							{#if status === 'accepted'}
								<span class="text-success"
									>Joined as {invite.individual?.name ?? invite.individual?.email}</span
								>
							{/if}
							{#if status === 'pending'}
								<form
									method="post"
									action="?/cancelInvite"
									use:enhance={() => {
										submittingCancel = invite.id;
										return async ({ result, update }) => {
											submittingCancel = null;
											if (result.type === 'redirect' || result.type === 'error') {
												addToast('Something went wrong.', 'error');
												return;
											}
											await update();
										};
									}}
									class="inline"
								>
									<input type="hidden" name="inviteId" value={invite.id} />
									<button
										type="submit"
										disabled={submittingCancel === invite.id}
										class="font-semibold text-text-secondary hover:text-text-primary disabled:opacity-50"
									>
										{submittingCancel === invite.id ? 'Cancelling...' : 'Cancel'}
									</button>
								</form>
							{/if}
							{#if status === 'pending' || status === 'cancelled' || status === 'expired'}
								<form
									method="post"
									action="?/resendInvite"
									use:enhance={() => {
										submittingResend = invite.id;
										return async ({ result, update }) => {
											submittingResend = null;
											if (result.type === 'redirect' || result.type === 'error') {
												addToast('Something went wrong.', 'error');
												return;
											}
											await update();
										};
									}}
									class="inline"
								>
									<input type="hidden" name="inviteId" value={invite.id} />
									<button
										type="submit"
										disabled={submittingResend === invite.id}
										class="font-semibold text-accent hover:text-accent-hover disabled:opacity-50"
									>
										{submittingResend === invite.id ? 'Resending...' : 'Resend'}
									</button>
								</form>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
</section>
