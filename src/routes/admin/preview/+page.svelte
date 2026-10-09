<script lang="ts">
	import type { PageData } from './$types';
	import { addToast } from '$lib/stores/toasts.svelte';

	const { data }: { data: PageData } = $props();

	type Lens = 'individual' | 'reviewer' | 'coach';
	let activeLens = $state<Lens>('individual');

	let selectedIndividualId = $state(data.individuals[0]?.id ?? '');
	let selectedCoachId = $state(data.coaches[0]?.id ?? '');
	let selectedReviewerId = $state(data.reviewers[0]?.id ?? '');

	const selectedIndividual = $derived(data.individuals.find((u) => u.id === selectedIndividualId));
	const selectedReviewer = $derived(data.reviewers.find((s) => s.id === selectedReviewerId));

	const impersonateAndOpen = async (userId: string, path: string) => {
		const res = await fetch('/api/admin/impersonate', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ userId })
		});
		if (!res.ok) {
			addToast('Failed to start impersonation. Please try again.', 'error');
			return;
		}
		window.open(path, '_blank');
	};

	const lenses: { id: Lens; label: string; description: string }[] = [
		{
			id: 'individual',
			label: 'Individual',
			description: 'The person working on their development goal'
		},
		{
			id: 'reviewer',
			label: 'Reviewer',
			description: "Someone rating an individual's effort and performance"
		},
		{
			id: 'coach',
			label: 'Coach',
			description: 'Managing clients, reviewing data, and guiding development'
		}
	];

	type FlowCard = {
		label: string;
		description: string;
		action: () => void;
		disabled?: boolean;
		disabledReason?: string;
	};

	const individualFlows = $derived<FlowCard[]>([
		{
			label: 'Onboarding',
			description: 'Name a goal and start a 12-week journey',
			action: () => impersonateAndOpen(selectedIndividualId, '/onboarding?preview=true')
		},
		{
			label: 'Check-in',
			description: 'One effort score and one performance score for the goal',
			action: () => impersonateAndOpen(selectedIndividualId, '/individual/checkin?preview=true')
		},
		{
			label: 'Individual Hub',
			description: 'Main dashboard with scores, charts, and insights',
			action: () => impersonateAndOpen(selectedIndividualId, '/individual')
		},
		{
			label: 'Insights',
			description: 'AI-generated analysis and journey reports',
			action: () => impersonateAndOpen(selectedIndividualId, '/individual/insights')
		}
	]);

	const reviewerFlows = $derived<FlowCard[]>([
		{
			label: 'Feedback Form',
			description:
				'Open the live reviewer form with sample data. Reviewers use a private link, not an account, so this preview is not impersonation.',
			action: () => window.open('/stakeholder/feedback/preview?preview=true', '_blank')
		}
	]);

	const coachFlows = $derived<FlowCard[]>([
		{
			label: 'Coach Hub',
			description: 'Overview with client alerts and quick actions',
			action: () => impersonateAndOpen(selectedCoachId, '/coach')
		},
		{
			label: 'Client Roster',
			description: 'Full client list with status and drill-down',
			action: () => impersonateAndOpen(selectedCoachId, '/coach/roster')
		},
		{
			label: 'Analytics',
			description: 'Cross-client performance analytics',
			action: () => impersonateAndOpen(selectedCoachId, '/coach/analytics')
		},
		{
			label: 'Invitations',
			description: 'Manage and send client invitations',
			action: () => impersonateAndOpen(selectedCoachId, '/coach/invitations')
		}
	]);
</script>

<svelte:head>
	<title>Preview Flows | Forbetra Admin</title>
</svelte:head>

<section class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
	<header>
		<h1 class="text-2xl font-bold text-text-primary">Preview Panel</h1>
		<p class="text-sm text-text-secondary">
			Preview every user-facing flow through the lens of each role. All previews open in a new
			window.
		</p>
	</header>

	<!-- Lens Selector -->
	<div class="grid gap-3 sm:grid-cols-3">
		{#each lenses as lens (lens.id)}
			<button
				onclick={() => (activeLens = lens.id)}
				class="rounded-xl border p-4 text-left transition-all {activeLens === lens.id
					? lens.id === 'individual'
						? 'border-accent bg-accent-muted'
						: lens.id === 'reviewer'
							? 'border-success bg-success-muted'
							: 'border-accent bg-accent-muted'
					: 'border-border-default bg-surface-raised hover:border-border-strong'}"
			>
				<p
					class="text-sm font-bold {activeLens === lens.id
						? lens.id === 'individual'
							? 'text-accent'
							: lens.id === 'reviewer'
								? 'text-success'
								: 'text-accent'
						: 'text-text-primary'}"
				>
					{lens.label}
				</p>
				<p class="mt-1 text-xs text-text-secondary">{lens.description}</p>
			</button>
		{/each}
	</div>

	<!-- Individual Lens -->
	{#if activeLens === 'individual'}
		<div class="rounded-xl border border-border-default bg-surface-raised p-5">
			<div class="mb-4 flex flex-wrap items-end gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="font-semibold text-accent">Preview as Individual</span>
					<select
						bind:value={selectedIndividualId}
						class="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					>
						{#each data.individuals as user (user.id)}
							<option value={user.id}>
								{user.name ?? 'Unnamed'} — {user.email}
							</option>
						{/each}
					</select>
				</label>
				{#if selectedIndividual}
					<div class="text-xs text-text-tertiary">
						{#if selectedIndividual.goalTitle}
							<span class="rounded bg-accent-muted px-2 py-0.5 font-medium text-accent">
								{selectedIndividual.goalTitle}
							</span>
							{#if selectedIndividual.cycleStatus}
								<span class="ml-1 rounded bg-surface-subtle px-2 py-0.5 font-medium uppercase">
									{selectedIndividual.cycleStatus}
								</span>
							{/if}
						{:else}
							<span class="text-text-tertiary italic">No goal yet</span>
						{/if}
					</div>
				{/if}
			</div>

			<div class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
				{#each individualFlows as flow (flow.label)}
					<button
						onclick={flow.action}
						disabled={flow.disabled}
						class="group rounded-lg border border-border-default bg-surface-subtle px-4 py-3 text-left transition-all hover:border-accent/30 hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
					>
						<p class="text-sm font-semibold text-text-primary group-hover:text-accent">
							{flow.label}
						</p>
						<p class="mt-0.5 text-xs text-text-tertiary">{flow.description}</p>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Reviewer Lens -->
	{#if activeLens === 'reviewer'}
		<div class="rounded-xl border border-border-default bg-surface-raised p-5">
			<div class="mb-4 flex flex-wrap items-end gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="font-semibold text-success">Preview as Reviewer</span>
					<select
						bind:value={selectedReviewerId}
						class="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					>
						{#each data.reviewers as reviewer (reviewer.id)}
							<option value={reviewer.id}>
								{reviewer.name} — rates {reviewer.individualName}
								{reviewer.relationship ? `(${reviewer.relationship})` : ''}
							</option>
						{/each}
					</select>
				</label>
				{#if selectedReviewer}
					<div class="text-xs">
						{#if selectedReviewer.hasActiveToken}
							<span class="rounded bg-success-muted px-2 py-0.5 font-medium text-success">
								Active token
							</span>
						{:else}
							<span class="rounded bg-warning-muted px-2 py-0.5 font-medium text-warning">
								No active token
							</span>
						{/if}
					</div>
				{/if}
			</div>

			{#if data.reviewers.length === 0}
				<div
					class="rounded-lg border border-dashed border-border-strong bg-surface-raised p-6 text-center text-sm text-text-tertiary"
				>
					No reviewers in the system yet. Create one through an individual's onboarding flow.
				</div>
			{:else}
				<div class="grid gap-2 sm:grid-cols-2">
					{#each reviewerFlows as flow (flow.label)}
						<button
							onclick={flow.action}
							disabled={flow.disabled}
							class="group rounded-lg border border-border-default bg-surface-subtle px-4 py-3 text-left transition-all hover:border-accent/30 hover:bg-success-muted disabled:cursor-not-allowed disabled:opacity-40"
						>
							<p class="text-sm font-semibold text-text-primary group-hover:text-success">
								{flow.label}
							</p>
							<p class="mt-0.5 text-xs text-text-tertiary">
								{flow.disabled ? flow.disabledReason : flow.description}
							</p>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Coach Lens -->
	{#if activeLens === 'coach'}
		<div class="rounded-xl border border-border-default bg-surface-raised p-5">
			<div class="mb-4 flex flex-wrap items-end gap-3">
				<label class="flex flex-col gap-1 text-sm">
					<span class="font-semibold text-accent">Preview as Coach</span>
					<select
						bind:value={selectedCoachId}
						class="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					>
						{#each data.coaches as coach (coach.id)}
							<option value={coach.id}>
								{coach.name ?? 'Unnamed'} — {coach.email}
								({coach.clientCount} client{coach.clientCount === 1 ? '' : 's'})
							</option>
						{/each}
					</select>
				</label>
			</div>

			{#if data.coaches.length === 0}
				<div
					class="rounded-lg border border-dashed border-border-strong bg-surface-raised p-6 text-center text-sm text-text-tertiary"
				>
					No coaches in the system yet. Assign the COACH role to a user from the Users page.
				</div>
			{:else}
				<div class="grid gap-2 sm:grid-cols-2">
					{#each coachFlows as flow (flow.label)}
						<button
							onclick={flow.action}
							disabled={flow.disabled}
							class="group rounded-lg border border-border-default bg-surface-subtle px-4 py-3 text-left transition-all hover:border-accent/30 hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-40"
						>
							<p class="text-sm font-semibold text-text-primary group-hover:text-accent">
								{flow.label}
							</p>
							<p class="mt-0.5 text-xs text-text-tertiary">{flow.description}</p>
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Helpful note -->
	<div
		class="rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-xs text-text-tertiary"
	>
		All previews open in a new browser window. Impersonation is automatically set for individual and
		coach lenses. Reviewer previews use token-based access (no impersonation needed). Your admin
		session stays active here.
	</div>
</section>
