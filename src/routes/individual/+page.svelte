<script lang="ts">
	import { enhance } from '$app/forms';
	import { ArrowRight } from 'lucide-svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import type { ActionData, PageData } from './$types';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	const featured = $derived(
		data.journeys.find((journey) => journey.status === 'ACTIVE') ?? data.journeys[0] ?? null
	);
	const pastJourneys = $derived(
		featured ? data.journeys.filter((journey) => journey.id !== featured.id) : []
	);
	const isCurrent = $derived(
		!!featured && featured.status === 'ACTIVE' && featured.id === data.currentJourneyId
	);
	const weekCovered = $derived(
		isCurrent && !!featured && featured.checkInCount > 0 && data.checkedInThisWeek
	);
	const needsReviewer = $derived(
		!!featured &&
			featured.status === 'ACTIVE' &&
			featured.checkInCount >= 1 &&
			featured.reviewerCount === 0
	);

	let editing = $state(false);
	let goalTitle = $state(data.goal.title);
	let goalDescription = $state(data.goal.description ?? '');
	let isSaving = $state(false);

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).format(
			new Date(value)
		);

	function actionLabel(journey: NonNullable<typeof featured>) {
		if (journey.status === 'COMPLETED') return 'View journey';
		if (journey.checkInCount === 0) return 'Set your baseline';
		return 'Check in';
	}

	function actionHref(journey: NonNullable<typeof featured>) {
		if (journey.status === 'COMPLETED') return `/individual/journey/${journey.id}`;
		return '/individual/today';
	}
</script>

<svelte:head>
	<title>Journeys | Forbetra</title>
</svelte:head>

<section class="mx-auto max-w-lg px-6 pt-10 pb-24">
	<p class="text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase">
		Your journeys
	</p>
	<h1 class="mt-2 text-3xl font-bold tracking-tight text-text-primary">
		{data.dbUserName ? `${data.dbUserName.split(' ')[0]}'s board` : 'Journey board'}
	</h1>

	{#if data.showFocusAreaPrompt}
		<div class="mt-8 rounded-xl border border-accent/25 bg-accent-muted/40 px-5 py-4">
			<p class="text-sm leading-relaxed text-text-secondary">
				It's been a couple of weeks. Adding focus areas can make the next check-in clearer — a few
				things to watch for, not a new score.
			</p>
			<div class="mt-4 flex flex-wrap gap-3">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/focus-areas"
					class="inline-flex items-center gap-2 rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-surface-base"
				>
					Add focus areas <ArrowRight class="h-4 w-4" />
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<form method="POST" action="?/dismissFocusPrompt" use:enhance>
					<button type="submit" class="rounded-full px-4 py-2.5 text-sm text-text-secondary">
						Not now
					</button>
				</form>
			</div>
		</div>
	{/if}

	{#if featured}
		<article class="mt-8 rounded-2xl border border-border-strong bg-surface-raised p-6">
			<div class="flex items-center justify-between gap-3">
				<p class="text-[11px] font-semibold tracking-[0.08em] text-accent uppercase">
					{featured.status === 'ACTIVE' ? 'Active' : 'Latest'}
				</p>
				{#if featured.status === 'ACTIVE' && featured.goalId === data.goal.id && !editing}
					<button type="button" onclick={() => (editing = true)} class="text-sm text-text-muted">
						Edit goal
					</button>
				{/if}
			</div>

			{#if editing && featured.goalId === data.goal.id}
				<form
					method="POST"
					action="?/renameGoal"
					class="mt-3 space-y-3"
					use:enhance={() => {
						isSaving = true;
						return async ({ result, update }) => {
							await update();
							isSaving = false;
							if (result.type === 'success') editing = false;
						};
					}}
				>
					<input
						name="goalTitle"
						bind:value={goalTitle}
						required
						minlength="3"
						maxlength="200"
						class="w-full rounded-[10px] border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary focus:border-border-accent focus:outline-none"
					/>
					<textarea
						name="goalDescription"
						rows="3"
						maxlength="1000"
						bind:value={goalDescription}
						class="w-full rounded-[10px] border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary focus:border-border-accent focus:outline-none"
						placeholder="Optional description"
					></textarea>
					{#if form?.error && form?.rename}
						<p class="text-sm text-signal-attention">{form.error}</p>
					{/if}
					<div class="flex gap-3">
						<button
							type="submit"
							disabled={isSaving}
							class="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-surface-base disabled:opacity-40"
						>
							{isSaving ? 'Saving…' : 'Save'}
						</button>
						<button
							type="button"
							onclick={() => (editing = false)}
							class="rounded-full px-4 py-2 text-sm text-text-secondary"
						>
							Cancel
						</button>
					</div>
				</form>
			{:else}
				<h2 class="mt-2 text-xl font-semibold tracking-tight text-text-primary">
					{featured.goalTitle}
				</h2>
				{#if featured.goalDescription}
					<p class="mt-2 text-sm leading-relaxed text-text-secondary">{featured.goalDescription}</p>
				{/if}
			{/if}

			{#if featured.status === 'COMPLETED'}
				<p class="mt-5 font-mono text-[11px] tracking-[0.06em] text-text-muted">
					{formatDate(featured.startDate)}
					{#if featured.endDate}
						— {formatDate(featured.endDate)}
					{/if}
					· {featured.checkInCount}
					{featured.checkInCount === 1 ? 'check-in' : 'check-ins'}
				</p>
			{:else}
				<h3 class="mt-5 text-2xl font-semibold tracking-tight text-text-primary">
					Week {featured.currentWeek} of {featured.lengthWeeks}
				</h3>
			{/if}

			{#if isCurrent && data.baseline}
				<p
					class="mt-4 flex items-center gap-1.5 text-[11px] font-semibold tracking-[0.08em] text-text-muted uppercase"
				>
					Baseline
					<InfoTip text="Your first check-in. Later weeks are compared with these scores." />
				</p>
				<dl class="mt-2 grid grid-cols-2 gap-3">
					<div>
						<dt class="text-[11px] tracking-[0.06em] text-text-muted uppercase">Effort</dt>
						<dd class="mt-1 font-mono text-lg text-text-primary">
							{data.baseline.effort ?? '—'}/10
						</dd>
					</div>
					<div>
						<dt class="text-[11px] tracking-[0.06em] text-text-muted uppercase">Performance</dt>
						<dd class="mt-1 font-mono text-lg text-text-primary">
							{data.baseline.performance ?? '—'}/10
						</dd>
					</div>
				</dl>
			{/if}

			{#if isCurrent && featured.checkInCount === 0}
				<p class="mt-4 text-sm leading-relaxed text-text-secondary">
					The first check-in is what the rest of the journey is compared to.
				</p>
			{/if}

			<div class="mt-6 flex flex-wrap gap-3">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#if weekCovered}
					{#if needsReviewer}
						<a
							href="/individual/stakeholders"
							class="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-surface-base"
						>
							Add a reviewer
							<ArrowRight class="h-4 w-4" />
						</a>
					{/if}
					<a
						href="/individual/checkin"
						class="rounded-full border border-border-strong px-6 py-3 text-sm font-semibold text-text-primary"
					>
						Add another check-in
					</a>
				{:else}
					<a
						href={actionHref(featured)}
						class="inline-flex items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-surface-base"
					>
						{actionLabel(featured)}
						<ArrowRight class="h-4 w-4" />
					</a>
					{#if featured.status === 'COMPLETED'}
						<a
							href="/individual/new-cycle"
							class="rounded-full border border-border-strong px-6 py-3 text-sm font-semibold text-text-primary"
						>
							Start new
						</a>
					{/if}
				{/if}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>

			{#if weekCovered}
				<p class="mt-6 text-base leading-relaxed text-text-primary">
					<span class="font-semibold">
						{featured.currentWeek === 1 ? 'Initial rating is in.' : 'This week is done.'}
					</span>
					Check in again when next week starts.
				</p>
			{/if}

			{#if needsReviewer && !weekCovered}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/stakeholders"
					class="mt-6 block border-l-2 border-accent/30 py-2 pr-2 pl-4 text-sm text-text-secondary"
				>
					Add a reviewer so you can see the gap between your view and theirs.
					<span class="font-semibold text-accent">Add a reviewer</span>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}
		</article>
	{/if}

	{#if pastJourneys.length > 0}
		<h2 class="mt-12 text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase">
			Earlier journeys
		</h2>
		<ul class="mt-4 space-y-3">
			{#each pastJourneys as journey (journey.id)}
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href="/individual/journey/{journey.id}"
						class="block rounded-xl border border-border-default bg-surface-raised px-5 py-4 transition-colors hover:border-border-strong"
					>
						<p class="text-sm font-semibold text-text-primary">{journey.goalTitle}</p>
						<p class="mt-1 text-[13px] text-text-secondary">
							{journey.label ?? 'Journey'} · {formatDate(journey.startDate)}
							{#if journey.endDate}
								— {formatDate(journey.endDate)}
							{/if}
						</p>
						<p class="mt-2 font-mono text-[11px] tracking-[0.06em] text-text-muted">
							{journey.lengthWeeks} weeks · {journey.checkInCount}
							{journey.checkInCount === 1 ? 'check-in' : 'check-ins'}
						</p>
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			{/each}
		</ul>
	{/if}
</section>
