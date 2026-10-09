<script lang="ts">
	import type { PageData } from './$types';
	import { AlertTriangle, BarChart3, Target, TrendingUp } from 'lucide-svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';

	const { data }: { data: PageData } = $props();

	import { goto } from '$app/navigation';

	type SortKey =
		| 'name'
		| 'avgEffort'
		| 'avgProgress'
		| 'stability'
		| 'trajectory'
		| 'completionRate'
		| 'alertCount';
	let sortKey = $state<SortKey>('name');
	let sortAsc = $state(true);
	let showAllWeeks = $state(false);
	let scrollContainer = $state<HTMLElement | null>(null);
	let canScrollLeft = $state(false);
	let canScrollRight = $state(true);

	function updateScrollShadows() {
		if (!scrollContainer) return;
		canScrollLeft = scrollContainer.scrollLeft > 0;
		canScrollRight =
			scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 1;
	}

	$effect(() => {
		if (!scrollContainer) return;
		updateScrollShadows();
		scrollContainer.addEventListener('scroll', updateScrollShadows, { passive: true });
		const ro = new ResizeObserver(updateScrollShadows);
		ro.observe(scrollContainer);
		return () => {
			scrollContainer?.removeEventListener('scroll', updateScrollShadows);
			ro.disconnect();
		};
	});

	const MAX_VISIBLE_WEEKS = 16;
	const visibleTimeSeries = $derived(
		showAllWeeks || data.portfolioTimeSeries.length <= MAX_VISIBLE_WEEKS
			? data.portfolioTimeSeries
			: data.portfolioTimeSeries.slice(-MAX_VISIBLE_WEEKS)
	);

	const toggleSort = (key: SortKey) => {
		if (sortKey === key) {
			sortAsc = !sortAsc;
		} else {
			sortKey = key;
			sortAsc = true;
		}
	};

	const sortedComparison = $derived(
		[...data.clientComparison].sort((a, b) => {
			const aVal = a[sortKey];
			const bVal = b[sortKey];
			if (aVal === null && bVal === null) return 0;
			if (aVal === null) return 1;
			if (bVal === null) return -1;
			const cmp =
				typeof aVal === 'string'
					? aVal.localeCompare(bVal as string)
					: (aVal as number) - (bVal as number);
			return sortAsc ? cmp : -cmp;
		})
	);

	const formatPercent = (value: number | null | undefined) => {
		if (value === null || value === undefined) return '—';
		return `${Math.round(value)}%`;
	};

	const formatScore = (value: number | null | undefined) => {
		if (value === null || value === undefined) return '—';
		return `${value}/100`;
	};

	const formatAverage = (value: number | null | undefined) => {
		if (value === null || value === undefined) return '—';
		return `${value.toFixed(1)}/10`;
	};

	const portfolioNarrative = $derived(
		(() => {
			const clients = data.clientComparison;
			if (clients.length === 0) return null;

			const parts: string[] = [];
			const trendingUp = clients.filter((c) => c.trajectory !== null && c.trajectory > 0).length;
			const needsAttention = clients.filter((c) => c.alertCount > 0).length;
			const avgCompletion =
				clients.reduce((sum, c) => sum + (c.completionRate ?? 0), 0) / clients.length;

			if (trendingUp === clients.length && clients.length > 1) {
				parts.push(`All ${clients.length} clients trending up — your portfolio is thriving`);
			} else if (trendingUp > 0) {
				parts.push(
					`${trendingUp} of ${clients.length} client${clients.length === 1 ? '' : 's'} gaining momentum`
				);
			} else {
				parts.push(`${clients.length} client${clients.length === 1 ? '' : 's'} in your portfolio`);
			}
			if (needsAttention > 0)
				parts.push(`${needsAttention} need${needsAttention === 1 ? 's' : ''} your attention`);
			parts.push(`avg completion ${Math.round(avgCompletion)}%`);

			return parts.join(' · ');
		})()
	);

	const sortIndicator = (key: SortKey) => {
		if (sortKey !== key) return '';
		return sortAsc ? ' \u2191' : ' \u2193';
	};

	function downloadCSV() {
		const headers = [
			'Name',
			'Goal',
			'Effort',
			'Performance',
			'Stability',
			'Trend',
			'Completion %',
			'Alerts'
		];
		const rows = sortedComparison.map((row) => [
			row.name,
			row.goal ?? '',
			row.avgEffort !== null ? row.avgEffort.toFixed(1) : '',
			row.avgProgress !== null ? row.avgProgress.toFixed(1) : '',
			row.stability !== null ? String(row.stability) : '',
			row.trajectory !== null ? String(row.trajectory) : '',
			row.completionRate !== null ? String(row.completionRate) : '',
			String(row.alertCount)
		]);

		const csvContent = [headers, ...rows]
			.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
			.join('\n');

		const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `forbetra-analytics-${new Date().toISOString().slice(0, 10)}.csv`;
		link.click();
		URL.revokeObjectURL(url);
	}
</script>

<svelte:head>
	<title>Analytics | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-4xl flex-col gap-8 p-4 pb-12">
	<!-- Header -->
	<header class="flex flex-wrap items-center justify-between gap-4">
		<div>
			<nav aria-label="Breadcrumb" class="mb-2">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<ol class="flex items-center gap-1.5 text-sm text-text-tertiary">
					<li>
						<a
							href="/coach"
							class="rounded transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
							>Dashboard</a
						>
					</li>
					<li aria-hidden="true" class="text-text-muted">/</li>
					<li><span class="font-medium text-text-primary">Analytics</span></li>
				</ol>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</nav>
			<h1 class="text-2xl font-bold text-text-primary">Analytics Dashboard</h1>
			<p class="mt-2 text-text-secondary">
				Track effort, performance, and engagement patterns across your portfolio
			</p>
			{#if portfolioNarrative}
				<div
					class="mt-3 flex items-center gap-2 rounded-lg border border-accent/20 bg-accent-muted/50 px-3 py-2"
				>
					<TrendingUp class="h-4 w-4 shrink-0 text-accent" />
					<p class="text-sm font-medium text-text-primary">{portfolioNarrative}</p>
				</div>
			{/if}
		</div>
		{#if data.clientComparison.length > 0}
			<button
				type="button"
				onclick={downloadCSV}
				aria-label="Export client comparison data as CSV"
				class="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-semibold text-text-secondary transition-all hover:border-accent/30 hover:text-accent"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
					/>
				</svg>
				Export CSV
			</button>
		{/if}
	</header>

	<!-- Overall Analytics Cards -->
	<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-xl border border-border-default bg-surface-raised p-4">
			<div class="mb-1 flex items-center gap-1.5">
				<AlertTriangle class="h-4 w-4 text-text-muted" />
				<p class="text-xs font-medium text-text-tertiary">
					Total Alerts <InfoTip
						text="Missed check-ins and score trends that may need coaching attention. Sorted by severity."
					/>
				</p>
			</div>
			<p class="text-3xl font-bold text-text-primary tabular-nums">{data.analytics.totalAlerts}</p>
			<div class="mt-1 flex gap-2 text-xs">
				<span class="font-semibold text-error">High: {data.analytics.highPriorityAlerts}</span>
				<span class="text-warning">Med: {data.analytics.mediumPriorityAlerts}</span>
			</div>
		</div>
		<div class="rounded-xl border border-border-default bg-surface-raised p-4">
			<div class="mb-1 flex items-center gap-1.5">
				<BarChart3 class="h-4 w-4 text-text-muted" />
				<p class="text-xs font-medium text-text-tertiary">
					Avg. Consistency <InfoTip
						text="How steady client scores are week-over-week. 70+ is strong stability."
					/>
				</p>
			</div>
			<p class="text-3xl font-bold text-text-primary tabular-nums">
				{formatScore(data.analytics.avgStability)}
			</p>
			<p class="text-2xs mt-1 text-text-muted">Week-to-week score consistency</p>
		</div>
		<div class="rounded-xl border border-border-default bg-surface-raised p-4">
			<div class="mb-1 flex items-center gap-1.5">
				<Target class="h-4 w-4 text-text-muted" />
				<p class="text-xs font-medium text-text-tertiary">
					Reviewer Response <InfoTip
						text="Average reviewer response rate across clients this week. 80%+ means strong engagement."
					/>
				</p>
			</div>
			<p class="text-3xl font-bold text-text-primary tabular-nums">
				{formatPercent(data.analytics.avgAlignment)}
			</p>
			<p class="text-2xs mt-1 text-text-muted">Reviewer response rate</p>
		</div>
		<div class="rounded-xl border border-border-default bg-surface-raised p-4">
			<div class="mb-1 flex items-center gap-1.5">
				<TrendingUp class="h-4 w-4 text-text-muted" />
				<p class="text-xs font-medium text-text-tertiary">
					Avg. Performance <InfoTip
						text="Average self-rated performance across all clients (last 4 weeks). 7+ is strong."
					/>
				</p>
			</div>
			<p class="text-3xl font-bold text-text-primary tabular-nums">
				{formatAverage(data.analytics.overallAvgProgress)}
			</p>
			{#if data.analytics.overallAvgEffort !== null}
				<p class="mt-1 text-xs text-text-muted">
					Effort: {formatAverage(data.analytics.overallAvgEffort)}
				</p>
			{/if}
		</div>
	</div>

	<!-- Client Comparison Table -->
	{#if data.clientComparison.length > 0}
		<section class="rounded-xl border border-border-default bg-surface-raised p-6">
			<h2 class="mb-4 text-2xl font-bold text-text-primary">Client Comparison</h2>
			<p class="mb-3 text-xs text-text-muted sm:hidden">Swipe to see all columns &rarr;</p>
			<div
				class="scroll-shadow-container relative {canScrollLeft
					? 'show-left-shadow'
					: ''} {canScrollRight ? 'show-right-shadow' : ''}"
			>
				<div class="overflow-x-auto" bind:this={scrollContainer}>
					<table class="w-full border-collapse text-sm">
						<thead>
							<tr class="border-b border-border-default">
								<th
									class="sticky left-0 z-10 bg-surface-raised px-3 py-2 text-left text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'name' ? (sortAsc ? 'ascending' : 'descending') : 'none'}
								>
									<button
										type="button"
										class="flex items-center gap-1"
										onclick={() => toggleSort('name')}
									>
										Name{sortIndicator('name')}
									</button>
								</th>
								<th
									class="px-3 py-2 text-left text-xs font-semibold tracking-wider text-text-tertiary uppercase"
								>
									Goal
								</th>
								<th
									class="px-3 py-2 text-center text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'avgEffort'
										? sortAsc
											? 'ascending'
											: 'descending'
										: 'none'}
								>
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="flex items-center gap-1"
											onclick={() => toggleSort('avgEffort')}
										>
											Effort{sortIndicator('avgEffort')}
										</button>
										<InfoTip
											text="How much attention they gave this goal, averaged over the last 4 weeks. 0 is none, 10 is exceptional."
										/>
									</div>
								</th>
								<th
									class="px-3 py-2 text-center text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'avgProgress'
										? sortAsc
											? 'ascending'
											: 'descending'
										: 'none'}
								>
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="flex items-center gap-1"
											onclick={() => toggleSort('avgProgress')}
										>
											Performance{sortIndicator('avgProgress')}
										</button>
										<InfoTip
											text="How effective that work was, averaged over the last 4 weeks. 0 is none, 10 is exceptional."
										/>
									</div>
								</th>
								<th
									class="px-3 py-2 text-center text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'stability'
										? sortAsc
											? 'ascending'
											: 'descending'
										: 'none'}
								>
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="flex items-center gap-1"
											onclick={() => toggleSort('stability')}
										>
											Consistency{sortIndicator('stability')}
										</button>
										<InfoTip text="How steady the scores are from week to week." />
									</div>
								</th>
								<th
									class="px-3 py-2 text-center text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'trajectory'
										? sortAsc
											? 'ascending'
											: 'descending'
										: 'none'}
								>
									<div class="flex items-center justify-center gap-1">
										<button
											type="button"
											class="flex items-center gap-1"
											onclick={() => toggleSort('trajectory')}
										>
											Trend{sortIndicator('trajectory')}
										</button>
										<InfoTip text="Week-to-week direction. Positive means the scores are rising." />
									</div>
								</th>
								<th
									class="px-3 py-2 text-center text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'completionRate'
										? sortAsc
											? 'ascending'
											: 'descending'
										: 'none'}
								>
									<button
										type="button"
										class="flex items-center gap-1"
										onclick={() => toggleSort('completionRate')}
									>
										<span title="Journey progress based on weeks elapsed">Completion</span
										>{sortIndicator('completionRate')}
									</button>
								</th>
								<th
									class="px-3 py-2 text-center text-xs font-semibold tracking-wider text-text-tertiary uppercase"
									aria-sort={sortKey === 'alertCount'
										? sortAsc
											? 'ascending'
											: 'descending'
										: 'none'}
								>
									<button
										type="button"
										class="flex items-center gap-1"
										onclick={() => toggleSort('alertCount')}
									>
										Alerts{sortIndicator('alertCount')}
									</button>
								</th>
							</tr>
						</thead>
						<tbody>
							<!-- eslint-disable svelte/no-navigation-without-resolve -->
							{#each sortedComparison as row (row.clientId)}
								<tr
									class="cursor-pointer border-b border-border-default transition-colors hover:bg-accent-muted/50 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base focus-visible:outline-none"
									tabindex="0"
									role="row"
									aria-label="View session for {row.name}"
									onclick={() => goto(`/coach/session/${row.clientId}`)}
									onkeydown={(e) => {
										if (e.key === 'Enter' || e.key === ' ') {
											e.preventDefault();
											goto(`/coach/session/${row.clientId}`);
										}
									}}
								>
									<td
										class="sticky left-0 z-10 bg-surface-raised px-3 py-2.5 font-semibold text-accent hover:underline"
										>{row.name}</td
									>
									<td class="max-w-[200px] truncate px-3 py-2.5 text-text-secondary">{row.goal}</td>
									<td
										class="px-3 py-2.5 text-center font-semibold {row.avgEffort !== null &&
										row.avgEffort >= 7
											? 'text-success'
											: row.avgEffort !== null && row.avgEffort < 4
												? 'text-warning'
												: 'text-text-secondary'}"
									>
										{formatAverage(row.avgEffort)}
									</td>
									<td
										class="px-3 py-2.5 text-center font-semibold {row.avgProgress !== null &&
										row.avgProgress >= 7
											? 'text-success'
											: row.avgProgress !== null && row.avgProgress < 4
												? 'text-warning'
												: 'text-text-secondary'}"
									>
										{formatAverage(row.avgProgress)}
									</td>
									<td class="px-3 py-2.5 text-center">
										{#if row.stability !== null}
											<span
												class="text-xs font-semibold {row.stability >= 70
													? 'text-success'
													: row.stability >= 40
														? 'text-warning'
														: 'text-error'}"
											>
												{row.stability}
											</span>
										{:else}
											<span class="text-text-muted">—</span>
										{/if}
									</td>
									<td
										class="px-3 py-2.5 text-center font-semibold {row.trajectory !== null &&
										row.trajectory > 0
											? 'text-success'
											: row.trajectory !== null && row.trajectory < 0
												? 'text-warning'
												: 'text-text-tertiary'}"
									>
										{#if row.trajectory !== null}
											{row.trajectory > 0 ? '+' : ''}{row.trajectory}
										{:else}
											—
										{/if}
									</td>
									<td class="px-3 py-2.5 text-center text-text-secondary">
										{row.completionRate !== null ? `${row.completionRate}%` : '—'}
									</td>
									<td class="px-3 py-2.5 text-center">
										{#if row.alertCount > 0}
											<span class="text-xs font-bold text-error">{row.alertCount}</span>
										{:else}
											<span class="text-text-muted">0</span>
										{/if}
									</td>
								</tr>
							{/each}
							<!-- eslint-enable svelte/no-navigation-without-resolve -->
						</tbody>
					</table>
				</div>
			</div>
		</section>
	{:else}
		<section class="rounded-lg border border-dashed border-border-strong bg-surface-raised p-12">
			<div class="flex flex-col items-center justify-center text-center">
				<div class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-accent-muted">
					<BarChart3 class="h-7 w-7 text-accent" />
				</div>
				<h3 class="mb-1 text-lg font-bold text-text-primary">Your analytics are waiting</h3>
				<p class="mb-6 max-w-sm text-sm text-text-secondary">
					Once your first client completes a check-in, you'll see trends, comparisons, and portfolio
					insights here. The data gets richer every week.
				</p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/coach/invitations"
					class="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
				>
					Invite Clients
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</section>
	{/if}

	<!-- Portfolio Trends -->
	{#if data.portfolioTimeSeries.length > 0}
		<section class="rounded-xl border border-border-default bg-surface-raised p-6">
			<h2 class="mb-1 text-2xl font-bold text-text-primary">Portfolio Trends</h2>
			<p class="mb-4 text-xs text-text-tertiary">Weekly averages across all active clients</p>
			<div
				class="overflow-x-auto"
				role="img"
				aria-label="Portfolio effort and performance trends by week"
			>
				<div class="flex" style="min-width: {visibleTimeSeries.length * 60 + 30}px; height: 200px;">
					<!-- Y-axis labels -->
					<div
						class="flex w-7 shrink-0 flex-col justify-between pb-[38px]"
						style="height: 160px;"
						aria-hidden="true"
					>
						<span class="text-2xs text-right text-text-muted">10</span>
						<span class="text-2xs text-right text-text-muted">5</span>
						<span class="text-2xs text-right text-text-muted">0</span>
					</div>
					<div class="flex flex-1 items-end gap-1">
						{#each visibleTimeSeries as week (week.weekNumber)}
							{@const maxScore = 10}
							{@const effortHeight =
								week.avgEffort !== null ? (week.avgEffort / maxScore) * 160 : 0}
							{@const perfHeight =
								week.avgPerformance !== null ? (week.avgPerformance / maxScore) * 160 : 0}
							<div class="group relative flex min-w-[50px] flex-1 flex-col items-center gap-1">
								<div class="flex items-end gap-0.5" style="height: 160px;">
									<div
										class="w-5 rounded-t bg-data-effort transition-all"
										style="height: {effortHeight}px;"
										title="Effort: {week.avgEffort !== null ? week.avgEffort.toFixed(1) : '—'}"
									></div>
									<div
										class="w-5 rounded-t bg-data-performance transition-all"
										style="height: {perfHeight}px;"
										title="Performance: {week.avgPerformance !== null
											? week.avgPerformance.toFixed(1)
											: '—'}"
									></div>
								</div>
								<!-- Hover value tooltip -->
								<div
									class="text-2xs pointer-events-none absolute -top-1 left-1/2 z-10 hidden -translate-x-1/2 rounded bg-surface-subtle px-1.5 py-0.5 font-semibold text-text-primary shadow group-hover:block"
								>
									{week.avgEffort !== null ? week.avgEffort.toFixed(1) : '—'} / {week.avgPerformance !==
									null
										? week.avgPerformance.toFixed(1)
										: '—'}
								</div>
								<span class="text-2xs text-text-tertiary">Wk {week.weekNumber}</span>
								<span class="text-2xs text-text-muted">{week.clientCount}c</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
			<div class="mt-3 flex items-center gap-4 text-xs text-text-tertiary">
				<div class="flex items-center gap-1.5">
					<div class="h-3 w-3 rounded-sm bg-data-effort"></div>
					<span>Avg Effort</span>
				</div>
				<div class="flex items-center gap-1.5">
					<div class="h-3 w-3 rounded-sm bg-data-performance"></div>
					<span>Avg Performance</span>
				</div>
				{#if data.portfolioTimeSeries.length > MAX_VISIBLE_WEEKS}
					<button
						type="button"
						onclick={() => (showAllWeeks = !showAllWeeks)}
						class="ml-auto rounded-lg border border-border-default bg-surface-raised px-3 py-1 text-xs font-semibold text-text-secondary transition-all hover:border-accent/30 hover:text-accent"
					>
						{showAllWeeks
							? 'Show recent 16 weeks'
							: `Show all ${data.portfolioTimeSeries.length} weeks`}
					</button>
				{/if}
			</div>
		</section>
	{/if}
</section>

<style>
	.scroll-shadow-container::before,
	.scroll-shadow-container::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: 24px;
		pointer-events: none;
		z-index: 1;
		transition: opacity 0.2s ease;
	}

	.scroll-shadow-container::before {
		left: 0;
		background: linear-gradient(to right, var(--color-surface-raised, transparent), transparent);
		opacity: 0;
	}

	.scroll-shadow-container.show-left-shadow::before {
		opacity: 1;
	}

	.scroll-shadow-container::after {
		right: 0;
		background: linear-gradient(to left, var(--color-surface-raised, transparent), transparent);
		opacity: 0;
	}

	.scroll-shadow-container.show-right-shadow::after {
		opacity: 1;
	}
</style>
