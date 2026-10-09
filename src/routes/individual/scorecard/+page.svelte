<script lang="ts">
	import type { PageData } from './$types';
	import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-svelte';
	import Badge from '$lib/components/Badge.svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/stores';

	const { data }: { data: PageData } = $props();

	function goToWeek(week: number) {
		const url = new URL($page.url);
		if (week === data.currentWeek) {
			url.searchParams.delete('week');
		} else {
			url.searchParams.set('week', String(week));
		}
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- resolve() is used but concatenated with search params
		goto(resolve('/individual/scorecard') + url.search, { replaceState: true });
	}

	// Color helpers
	function effortBg(score: number): string {
		if (score >= 8) return 'bg-cyan-700/40 text-cyan-200';
		if (score >= 6) return 'bg-cyan-800/30 text-cyan-300';
		if (score >= 4) return 'bg-cyan-800/25 text-cyan-300';
		if (score >= 1) return 'bg-cyan-900/20 text-cyan-400';
		return 'bg-surface-raised text-text-muted';
	}

	function perfBg(score: number): string {
		if (score >= 8) return 'bg-amber-700/40 text-amber-200';
		if (score >= 6) return 'bg-amber-800/30 text-amber-300';
		if (score >= 4) return 'bg-amber-800/25 text-amber-300';
		if (score >= 1) return 'bg-amber-900/20 text-amber-400';
		return 'bg-surface-raised text-text-muted';
	}
</script>

<svelte:head>
	<title>Scorecard | Forbetra</title>
</svelte:head>

<!-- eslint-disable svelte/no-navigation-without-resolve -->
<section class="mx-auto flex max-w-5xl flex-col gap-6 p-4 pb-12">
	<!-- Header + week navigator -->
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
			<li><span class="font-medium text-text-primary">Scorecard</span></li>
		</ol>
	</nav>
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Scorecard</h1>
			<p class="text-xs text-text-muted">{data.goalTitle}</p>
			<p class="text-2xs mt-0.5 text-text-tertiary">Your self-perception vs. reviewer feedback</p>
		</div>
		<div class="flex items-center gap-2">
			<button
				onclick={() => goToWeek(data.viewWeek - 1)}
				disabled={data.viewWeek <= 1}
				aria-label="Previous week"
				class="rounded-lg p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
			>
				<ChevronLeft class="h-4 w-4" />
			</button>
			<span
				class="min-w-[5rem] text-center text-sm font-semibold {data.viewWeek === data.currentWeek
					? 'text-accent'
					: 'text-text-secondary'}"
			>
				Week {data.viewWeek}{#if data.viewWeek === data.currentWeek}
					<span class="text-xs font-normal text-text-muted">(now)</span>{/if}
			</span>
			<button
				onclick={() => goToWeek(data.viewWeek + 1)}
				disabled={data.viewWeek >= data.totalWeeks}
				aria-label="Next week"
				class="rounded-lg p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-primary disabled:opacity-30 disabled:hover:bg-transparent"
			>
				<ChevronRight class="h-4 w-4" />
			</button>
		</div>
	</div>

	<!-- Self summary row -->
	<div
		class="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border-default bg-surface-raised px-4 py-3"
	>
		<span class="text-2xs font-semibold tracking-wider text-text-muted uppercase">Your Scores</span>
		{#if data.myEffort !== null}
			<div class="flex items-center gap-1.5">
				<span class="text-2xs flex items-center gap-1 text-text-muted">
					Effort
					<InfoTip text="How much attention you gave this goal. 0 is none, 10 is exceptional." />
				</span>
				<div
					class="flex h-7 w-7 items-center justify-center rounded text-xs font-bold {effortBg(
						data.myEffort
					)}"
				>
					{data.myEffort}
				</div>
			</div>
		{/if}
		{#if data.myPerformance !== null}
			<div class="flex items-center gap-1.5">
				<span class="text-2xs flex items-center gap-1 text-text-muted">
					Performance
					<InfoTip text="How effective that work was. 0 is none, 10 is exceptional." />
				</span>
				<div
					class="flex h-7 w-7 items-center justify-center rounded text-xs font-bold {perfBg(
						data.myPerformance
					)}"
				>
					{data.myPerformance}
				</div>
			</div>
		{/if}
		{#if data.myEffort === null && data.myPerformance === null}
			<span class="text-xs text-text-muted">No self-ratings for this week</span>
		{/if}
	</div>

	<!-- Reviewer gap cards -->
	{#if data.scorecard.length > 0}
		{@const allAligned = data.scorecard.every((s) => s.maxAbsGap <= 1)}
		{@const anyLarge = data.scorecard.some((s) => s.maxAbsGap > 2)}
		{#if allAligned}
			<div
				class="flex items-center gap-2 rounded-lg border border-success/20 bg-success-muted px-4 py-2.5"
			>
				<span class="text-sm text-success"
					>Well-aligned this week — you and your reviewers see eye-to-eye.</span
				>
			</div>
		{:else if anyLarge}
			<div
				class="flex items-center gap-2 rounded-lg border border-warning/20 bg-warning-muted px-4 py-2.5"
			>
				<span class="text-xs text-warning"
					>Large gaps detected — your reviewers see things differently than you do. This is a
					coaching opportunity. Discuss with your coach in your next session.</span
				>
			</div>
		{:else}
			<div
				class="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-muted/50 px-4 py-2.5"
			>
				<span class="text-xs text-text-secondary"
					>Some moderate gaps — small differences between self-perception and reviewer feedback are
					normal and can sharpen your self-awareness over time.</span
				>
			</div>
		{/if}
		<div class="text-2xs flex items-center justify-between px-1 text-text-muted">
			<span>Your self-rating</span>
			<span>Reviewer</span>
		</div>
		<div class="grid gap-3 sm:grid-cols-2">
			{#each data.scorecard as row (row.reviewerId)}
				<div
					class="rounded-lg border p-4 {row.maxAbsGap > 2
						? 'border-error/30'
						: row.maxAbsGap > 1
							? 'border-warning/30'
							: 'border-border-default'} bg-surface-raised"
				>
					<!-- Reviewer name + trend -->
					<div class="mb-3 flex items-center justify-between">
						<p class="text-sm font-semibold text-text-primary">{row.reviewerName}</p>
						{#if row.effortGapTrend || row.performanceGapTrend}
							<div class="flex items-center gap-1">
								{#if row.effortGapTrend === 'closing' || row.performanceGapTrend === 'closing'}
									<Badge variant="success">Gap closing</Badge>
								{:else if row.effortGapTrend === 'widening' || row.performanceGapTrend === 'widening'}
									<Badge variant="error">Gap widening</Badge>
								{:else}
									<Badge>Gap stable</Badge>
								{/if}
								<InfoTip
									text="Your score minus the reviewer’s. Closer to zero means you see it the same way. Closing means that difference is shrinking."
								/>
							</div>
						{/if}
					</div>

					<!-- Gap visualization: Effort -->
					<div class="mb-2">
						<p class="text-2xs mb-1 flex items-center gap-1 font-medium text-text-tertiary">
							Effort
							<InfoTip
								text="How much attention you gave this goal. 0 is none, 10 is exceptional."
							/>
						</p>
						<div class="flex items-center gap-1">
							{#if data.myEffort !== null}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded font-bold {effortBg(
										data.myEffort
									)}"
								>
									{data.myEffort}
								</div>
							{:else}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-subtle text-text-muted"
								>
									--
								</div>
							{/if}
							{#if row.effortGap !== null}
								<div class="flex flex-1 items-center gap-1">
									<div
										class="h-px flex-1 {Math.abs(row.effortGap) <= 1
											? 'bg-success/40'
											: Math.abs(row.effortGap) <= 2
												? 'bg-warning/40'
												: 'bg-error/40'}"
									></div>
									<span
										class="text-2xs font-bold {Math.abs(row.effortGap) <= 1
											? 'text-success'
											: Math.abs(row.effortGap) <= 2
												? 'text-warning'
												: 'text-error'}"
									>
										{row.effortGap > 0 ? '+' : ''}{row.effortGap}
									</span>
									<div
										class="h-px flex-1 {Math.abs(row.effortGap) <= 1
											? 'bg-success/40'
											: Math.abs(row.effortGap) <= 2
												? 'bg-warning/40'
												: 'bg-error/40'}"
									></div>
								</div>
							{:else}
								<div class="flex flex-1 items-center">
									<div class="h-px flex-1 bg-border-default"></div>
								</div>
							{/if}
							{#if row.reviewerEffort !== null}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded font-bold {effortBg(
										row.reviewerEffort
									)}"
								>
									{row.reviewerEffort}
								</div>
							{:else}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-subtle text-text-muted"
								>
									--
								</div>
							{/if}
						</div>
					</div>

					<!-- Gap visualization: Performance -->
					<div>
						<p class="text-2xs mb-1 flex items-center gap-1 font-medium text-text-tertiary">
							Performance
							<InfoTip text="How effective that work was. 0 is none, 10 is exceptional." />
						</p>
						<div class="flex items-center gap-1">
							{#if data.myPerformance !== null}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded font-bold {perfBg(
										data.myPerformance
									)}"
								>
									{data.myPerformance}
								</div>
							{:else}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-subtle text-text-muted"
								>
									--
								</div>
							{/if}
							{#if row.performanceGap !== null}
								<div class="flex flex-1 items-center gap-1">
									<div
										class="h-px flex-1 {Math.abs(row.performanceGap) <= 1
											? 'bg-success/40'
											: Math.abs(row.performanceGap) <= 2
												? 'bg-warning/40'
												: 'bg-error/40'}"
									></div>
									<span
										class="text-2xs font-bold {Math.abs(row.performanceGap) <= 1
											? 'text-success'
											: Math.abs(row.performanceGap) <= 2
												? 'text-warning'
												: 'text-error'}"
									>
										{row.performanceGap > 0 ? '+' : ''}{row.performanceGap}
									</span>
									<div
										class="h-px flex-1 {Math.abs(row.performanceGap) <= 1
											? 'bg-success/40'
											: Math.abs(row.performanceGap) <= 2
												? 'bg-warning/40'
												: 'bg-error/40'}"
									></div>
								</div>
							{:else}
								<div class="flex flex-1 items-center">
									<div class="h-px flex-1 bg-border-default"></div>
								</div>
							{/if}
							{#if row.reviewerPerformance !== null}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded font-bold {perfBg(
										row.reviewerPerformance
									)}"
								>
									{row.reviewerPerformance}
								</div>
							{:else}
								<div
									class="text-2xs flex h-7 w-7 shrink-0 items-center justify-center rounded bg-surface-subtle text-text-muted"
								>
									--
								</div>
							{/if}
						</div>
					</div>

					<!-- Gap interpretation for large differences -->
					{#if row.maxAbsGap > 2}
						{@const biggestGap =
							Math.abs(row.effortGap ?? 0) > Math.abs(row.performanceGap ?? 0)
								? row.effortGap
								: row.performanceGap}
						<p class="text-2xs mt-2 text-text-tertiary">
							{#if biggestGap !== null && biggestGap > 0}You rate yourself higher than {row.reviewerName}
								— explore what they're not seeing.{:else}They see more than you give yourself credit
								for.{/if}
						</p>
					{/if}

					<!-- Reviewer comment -->
					{#if row.comment}
						<div class="mt-3 border-t border-border-default pt-3">
							<div class="flex items-start gap-2">
								<MessageSquare class="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
								<p class="text-xs text-text-secondary italic">"{row.comment}"</p>
							</div>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	{:else}
		<div
			class="rounded-lg border border-dashed border-border-strong bg-surface-raised p-8 text-center"
		>
			<MessageSquare class="mx-auto mb-2 h-6 w-6 text-text-muted" />
			<p class="text-sm font-medium text-text-secondary">
				No reviewer data yet for week {data.viewWeek}
			</p>
			<p class="mt-1 text-xs text-text-tertiary">
				Once your reviewers submit feedback, their scores will appear here alongside yours to show
				perception gaps.
			</p>
		</div>
	{/if}

	<!-- Self notes -->
	{#if data.selfNotes.length > 0}
		<div class="rounded-lg border border-border-default bg-surface-raised p-4">
			<p class="mb-2 text-xs font-semibold tracking-wider text-text-muted uppercase">
				Your Notes This Week
			</p>
			<div class="flex flex-col gap-2">
				{#each data.selfNotes as note (note)}
					<p class="text-sm text-text-secondary">{note}</p>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Legend -->
	<div class="text-2xs flex flex-wrap items-center gap-x-4 gap-y-1 text-text-muted">
		<span
			>You <span class="font-bold">[ score ]</span>——gap——<span class="font-bold">[ score ]</span> Reviewer</span
		>
		<span class="text-success">Green = aligned (&le;1)</span>
		<span class="text-warning">Amber = moderate (1-2)</span>
		<span class="text-error">Red = large (&gt;2)</span>
	</div>
</section>
