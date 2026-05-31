<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import {
		TrendingUp,
		TrendingDown,
		Minus,
		ChevronDown,
		ChevronUp,
		UserPlus,
		MessageSquare
	} from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	let expandedReviewer = $state<string | null>(null);
	let showAddForm = $state(false);
	let addName = $state('');
	let addEmail = $state('');
	let addingReviewer = $state(false);
	let requestingFeedbackId = $state<string | null>(null);
	let copiedLink = $state<string | null>(null);

	const formResult = form as Record<string, unknown> | null;
	const isStakeholderAction = formResult?.action === 'stakeholder';
	const isFeedbackAction = formResult?.action === 'feedback';

	function gapColor(gap: number | null): string {
		if (gap === null) return 'text-text-muted';
		const abs = Math.abs(gap);
		if (abs <= 1) return 'text-success';
		if (abs <= 2) return 'text-warning';
		return 'text-error';
	}

	function formatGap(gap: number | null): string {
		if (gap === null) return '--';
		return (gap > 0 ? '+' : '') + gap;
	}

	function getRelativeDate(isoDate: string | null): string {
		if (!isoDate) return 'Awaiting first response';
		const diffDays = Math.floor((Date.now() - new Date(isoDate).getTime()) / 86400000);
		if (diffDays === 0) return 'Today';
		if (diffDays === 1) return 'Yesterday';
		if (diffDays < 7) return `${diffDays}d ago`;
		return `${Math.floor(diffDays / 7)}w ago`;
	}

	const copyLink = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			copiedLink = url;
			setTimeout(() => (copiedLink = null), 2000);
		} catch {
			/* noop */
		}
	};
</script>

<svelte:head>
	<title>Feedback | Forbetra</title>
</svelte:head>

<div class="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
	<!-- Breadcrumb + Header -->
	<div>
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<nav aria-label="Breadcrumb" class="mb-2">
			<ol class="flex items-center gap-1.5 text-sm text-text-tertiary">
				<li>
					<a
						href="/individual"
						class="rounded transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
						>Hub</a
					>
				</li>
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li><span class="font-medium text-text-primary">Feedback</span></li>
			</ol>
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<h1 class="text-2xl font-bold text-text-primary">Feedback</h1>
		<p class="mt-1 text-sm text-text-secondary">
			Your self-assessment vs. reviewer ratings{data.currentWeek
				? ` — Week ${data.currentWeek}`
				: ''}.
		</p>
	</div>

	<!-- Toast messages -->
	{#if isStakeholderAction && formResult?.success}
		<div class="rounded-xl border border-success/30 bg-success-muted p-4 text-sm text-success">
			Reviewer added. They'll receive a welcome email.
		</div>
	{/if}
	{#if isFeedbackAction && formResult?.success}
		<div class="rounded-xl border border-success/30 bg-success-muted p-4 text-sm text-success">
			Feedback request sent!{formResult?.smsSent ? ' (Email + SMS)' : ' (Email)'}
		</div>
	{/if}
	{#if formResult?.error}
		<div class="rounded-xl border border-error/30 bg-error-muted p-4 text-sm text-error">
			{formResult.error}
		</div>
	{/if}

	<!-- Section 1: Perception Gap Summary -->
	{#if data.myEffort !== null || data.myPerformance !== null}
		<section class="grid grid-cols-2 gap-3">
			<div class="rounded-xl border border-border-default bg-surface-raised p-4">
				<p class="text-2xs font-semibold tracking-wider text-text-muted uppercase">Effort</p>
				<div class="mt-2 flex items-end justify-between">
					<div>
						<p class="text-xs text-text-tertiary">You</p>
						<p class="text-2xl font-bold text-text-primary">{data.myEffort ?? '--'}</p>
					</div>
					<div class="text-right">
						<p class="text-xs text-text-tertiary">Reviewers</p>
						<p class="text-2xl font-bold text-text-primary">{data.reviewerAvgEffort ?? '--'}</p>
					</div>
				</div>
				{#if data.myEffort !== null && data.reviewerAvgEffort !== null}
					{@const gap = Number((data.myEffort - data.reviewerAvgEffort).toFixed(1))}
					<div
						class="mt-2 flex items-center justify-center gap-1 rounded-lg bg-surface-subtle px-2 py-1"
					>
						<span class="text-xs font-semibold {gapColor(gap)}">Gap: {formatGap(gap)}</span>
					</div>
				{/if}
			</div>
			<div class="rounded-xl border border-border-default bg-surface-raised p-4">
				<p class="text-2xs font-semibold tracking-wider text-text-muted uppercase">Performance</p>
				<div class="mt-2 flex items-end justify-between">
					<div>
						<p class="text-xs text-text-tertiary">You</p>
						<p class="text-2xl font-bold text-text-primary">{data.myPerformance ?? '--'}</p>
					</div>
					<div class="text-right">
						<p class="text-xs text-text-tertiary">Reviewers</p>
						<p class="text-2xl font-bold text-text-primary">{data.reviewerAvgPerf ?? '--'}</p>
					</div>
				</div>
				{#if data.myPerformance !== null && data.reviewerAvgPerf !== null}
					{@const gap = Number((data.myPerformance - data.reviewerAvgPerf).toFixed(1))}
					<div
						class="mt-2 flex items-center justify-center gap-1 rounded-lg bg-surface-subtle px-2 py-1"
					>
						<span class="text-xs font-semibold {gapColor(gap)}">Gap: {formatGap(gap)}</span>
					</div>
				{/if}
			</div>
		</section>
	{/if}

	<!-- Section 2: Reviewer Cards -->
	<section class="space-y-3">
		<div class="flex items-center justify-between">
			<h2 class="text-lg font-semibold text-text-primary">Reviewers</h2>
			<button
				type="button"
				onclick={() => (showAddForm = !showAddForm)}
				class="inline-flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
			>
				<UserPlus class="h-3.5 w-3.5" />
				{showAddForm ? 'Cancel' : 'Add'}
			</button>
		</div>

		{#if data.reviewers.length === 0}
			<div
				class="rounded-xl border border-dashed border-border-strong bg-surface-raised p-8 text-center"
			>
				<p class="text-sm text-text-secondary">
					No reviewers yet. Add someone to start getting feedback.
				</p>
			</div>
		{:else}
			{#if data.reviewers.every((r) => r.lastFeedbackDate === null)}
				<div
					class="rounded-xl border border-dashed border-accent/40 bg-accent-muted/30 p-6 text-center"
				>
					<p class="text-sm font-medium text-text-primary">
						Your reviewers haven't responded yet — that's normal in week 1.
					</p>
					<p class="mt-1.5 text-xs text-text-tertiary">
						Reviewers receive a feedback prompt at the end of each week. Reminders fire Mon–Fri at
						3pm. Feedback will appear below as it arrives.
					</p>
				</div>
			{/if}
			{#each data.reviewers as reviewer (reviewer.id)}
				{@const maxGap = Math.max(
					Math.abs(reviewer.effortGap ?? 0),
					Math.abs(reviewer.perfGap ?? 0)
				)}
				<div
					class="rounded-xl border {maxGap > 2
						? 'border-error/30'
						: maxGap > 1
							? 'border-warning/30'
							: 'border-border-default'} bg-surface-raised transition-all"
				>
					<!-- Card header — clickable -->
					<button
						type="button"
						class="flex w-full items-center gap-4 p-4 text-left"
						onclick={() =>
							(expandedReviewer = expandedReviewer === reviewer.id ? null : reviewer.id)}
					>
						<div class="min-w-0 flex-1">
							<p class="font-medium text-text-primary">{reviewer.name}</p>
							<p class="text-xs text-text-muted">{getRelativeDate(reviewer.lastFeedbackDate)}</p>
						</div>
						<!-- Scores + gap -->
						<div class="flex items-center gap-3 text-center">
							{#if reviewer.stkEffort !== null}
								<div>
									<p class="text-2xs text-text-tertiary">Eff</p>
									<p class="text-sm font-bold text-text-primary">{reviewer.stkEffort}</p>
									{#if reviewer.effortGap !== null}
										<p class="text-2xs font-semibold {gapColor(reviewer.effortGap)}">
											{formatGap(reviewer.effortGap)}
										</p>
									{/if}
								</div>
							{/if}
							{#if reviewer.stkPerf !== null}
								<div>
									<p class="text-2xs text-text-tertiary">Perf</p>
									<p class="text-sm font-bold text-text-primary">{reviewer.stkPerf}</p>
									{#if reviewer.perfGap !== null}
										<p class="text-2xs font-semibold {gapColor(reviewer.perfGap)}">
											{formatGap(reviewer.perfGap)}
										</p>
									{/if}
								</div>
							{/if}
							{#if reviewer.effortGapTrend || reviewer.performanceGapTrend}
								{@const trend = reviewer.effortGapTrend ?? reviewer.performanceGapTrend}
								{#if trend === 'closing'}
									<TrendingDown class="h-4 w-4 text-success" />
								{:else if trend === 'widening'}
									<TrendingUp class="h-4 w-4 text-error" />
								{:else}
									<Minus class="h-4 w-4 text-text-muted" />
								{/if}
							{/if}
						</div>
						{#if expandedReviewer === reviewer.id}
							<ChevronUp class="h-4 w-4 shrink-0 text-text-muted" />
						{:else}
							<ChevronDown class="h-4 w-4 shrink-0 text-text-muted" />
						{/if}
					</button>

					<!-- Expanded detail -->
					{#if expandedReviewer === reviewer.id}
						<div class="space-y-3 border-t border-border-default px-4 pt-3 pb-4">
							<p class="text-xs text-text-muted">{reviewer.email}</p>

							<!-- Trend badge -->
							{#if reviewer.effortGapTrend || reviewer.performanceGapTrend}
								{@const trend = reviewer.effortGapTrend ?? reviewer.performanceGapTrend}
								<Badge
									variant={trend === 'closing'
										? 'success'
										: trend === 'widening'
											? 'error'
											: 'default'}
								>
									Gap {trend}
								</Badge>
							{/if}

							<!-- Feedback history -->
							{#if reviewer.history.length > 0}
								<div>
									<p class="text-2xs mb-2 font-semibold tracking-wider text-text-muted uppercase">
										History
									</p>
									<div class="space-y-1.5">
										{#each reviewer.history as entry (entry.week)}
											<div
												class="flex items-center gap-3 rounded-lg bg-surface-subtle px-3 py-2 text-xs"
											>
												<span class="w-12 shrink-0 font-medium text-text-secondary"
													>Wk {entry.week}</span
												>
												<span class="text-text-tertiary"
													>E: <strong class="text-text-primary">{entry.effort ?? '--'}</strong
													></span
												>
												<span class="text-text-tertiary"
													>P: <strong class="text-text-primary">{entry.performance ?? '--'}</strong
													></span
												>
												{#if entry.comment}
													<span title={entry.comment}
														><MessageSquare
															class="ml-auto h-3 w-3 shrink-0 text-text-muted"
														/></span
													>
												{/if}
											</div>
										{/each}
									</div>
								</div>
							{:else}
								<p class="text-xs text-text-muted">No feedback submitted yet.</p>
							{/if}

							<!-- Actions -->
							<div class="flex items-center gap-2 pt-1">
								{#if reviewer.pendingFeedbackLink}
									<button
										type="button"
										onclick={() => {
											if (reviewer.pendingFeedbackLink) copyLink(reviewer.pendingFeedbackLink);
										}}
										class="rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors {copiedLink ===
										reviewer.pendingFeedbackLink
											? 'border-success text-success'
											: 'border-border-default text-text-secondary hover:border-accent hover:text-accent'}"
									>
										{copiedLink === reviewer.pendingFeedbackLink ? 'Copied!' : 'Copy Link'}
									</button>
								{/if}
								<form
									method="post"
									action="?/generateFeedback"
									use:enhance={() => {
										requestingFeedbackId = reviewer.id;
										return async ({ update }) => {
											requestingFeedbackId = null;
											await update();
										};
									}}
								>
									<input type="hidden" name="stakeholderId" value={reviewer.id} />
									<button
										type="submit"
										disabled={requestingFeedbackId === reviewer.id}
										class="rounded-lg border border-accent bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent transition-colors hover:bg-accent hover:text-white disabled:opacity-50"
									>
										{requestingFeedbackId === reviewer.id ? 'Sending...' : 'Request Feedback'}
									</button>
								</form>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		{/if}
	</section>

	<!-- Section 3: Add Reviewer -->
	{#if showAddForm}
		<section class="rounded-xl border border-border-default bg-surface-raised p-5">
			<h2 class="mb-3 text-sm font-semibold text-text-primary">Add a Reviewer</h2>
			<form
				method="post"
				action="?/addStakeholder"
				use:enhance={() => {
					addingReviewer = true;
					return async ({ update }) => {
						addingReviewer = false;
						await update();
					};
				}}
				class="space-y-3"
			>
				<div class="grid gap-3 sm:grid-cols-2">
					<div class="space-y-1">
						<label class="block text-xs font-medium text-text-secondary" for="add-name">Name</label>
						<input
							id="add-name"
							name="name"
							type="text"
							required
							placeholder="John Smith"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							bind:value={addName}
						/>
					</div>
					<div class="space-y-1">
						<label class="block text-xs font-medium text-text-secondary" for="add-email"
							>Email</label
						>
						<input
							id="add-email"
							name="email"
							type="email"
							required
							placeholder="john@example.com"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							bind:value={addEmail}
						/>
					</div>
				</div>
				<div class="space-y-1">
					<label class="block text-sm font-medium text-text-secondary" for="phone">
						Mobile <span class="font-normal text-text-muted">(optional)</span>
					</label>
					<input
						id="phone"
						name="phone"
						type="tel"
						placeholder="+1 (555) 123-4567"
						class="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					/>
				</div>
				<div class="flex justify-end">
					<button
						type="submit"
						disabled={addingReviewer}
						class="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover disabled:opacity-50"
					>
						{addingReviewer ? 'Adding...' : 'Add Reviewer'}
					</button>
				</div>
			</form>
		</section>
	{/if}

	<!-- Legend -->
	<div class="text-2xs flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-text-muted">
		<span>Gap = Your score minus reviewer score</span>
		<span class="text-success">Green (&le;1)</span>
		<span class="text-warning">Amber (1-2)</span>
		<span class="text-error">Red (&gt;2)</span>
	</div>
</div>
