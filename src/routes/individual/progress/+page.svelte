<script lang="ts">
	import type { PageData } from './$types';
	import PerformanceEffortChart from '$lib/components/PerformanceEffortChart.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';
	import { addToast } from '$lib/stores/toasts.svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import { getScoreColor, getScoreBgColor } from '$lib/utils/scoreColors';
	import { Sparkles, ChevronDown } from 'lucide-svelte';

	const { data }: { data: PageData } = $props();

	let generating = $state(false);
	let freshReport = $state<{ id: string; content: string; createdAt: string } | null>(null);
	let generateError = $state<string | null>(null);
	let reportThumbs = $state<number | null>(data.cycleReport?.thumbs ?? null);
	const reportContent = $derived(freshReport?.content ?? data.cycleReport?.content ?? null);
	const reportId = $derived(freshReport?.id ?? data.cycleReport?.id ?? null);
	const reportDate = $derived(
		freshReport?.createdAt
			? new Date(freshReport.createdAt)
			: data.cycleReport?.createdAt
				? new Date(data.cycleReport.createdAt)
				: null
	);

	async function generateReport() {
		generating = true;
		generateError = null;
		freshReport = { id: '', content: '', createdAt: new Date().toISOString() };
		try {
			const res = await fetch('/api/insights/cycle-report', {
				method: 'POST',
				headers: { Accept: 'text/event-stream' }
			});
			if (!res.ok) {
				generateError = (await res.json()).error ?? 'Something went wrong';
				freshReport = null;
				return;
			}
			const reader = res.body?.getReader();
			if (!reader) {
				generateError = 'Streaming not supported';
				freshReport = null;
				return;
			}
			const decoder = new TextDecoder();
			let buffer = '';
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					if (line.startsWith('event:')) continue;
					if (!line.startsWith('data: ')) continue;
					try {
						const parsed = JSON.parse(line.slice(6));
						if (typeof parsed === 'string') {
							freshReport = {
								id: freshReport?.id ?? '',
								content: (freshReport?.content ?? '') + parsed,
								createdAt: freshReport?.createdAt ?? new Date().toISOString()
							};
						} else if (parsed.id && typeof parsed.id === 'string') {
							freshReport = {
								id: parsed.id,
								content: freshReport?.content ?? '',
								createdAt: freshReport?.createdAt ?? new Date().toISOString()
							};
						}
					} catch {
						/* ignore */
					}
				}
			}
			reportThumbs = null;
			addToast('Report generated', 'success');
		} catch {
			generateError = 'Network error. Please try again.';
			if (!freshReport?.content) freshReport = null;
		} finally {
			generating = false;
		}
	}

	async function submitFeedback(thumbs: number) {
		if (!reportId) return;
		reportThumbs = thumbs;
		await fetch(`/api/insights/${reportId}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ thumbs })
		});
	}

	const expandedWeeks = new SvelteSet<number>(data.weeks.slice(0, 2).map((w) => w.weekNumber));
	const toggleWeek = (wn: number) => {
		if (expandedWeeks.has(wn)) expandedWeeks.delete(wn);
		else expandedWeeks.add(wn);
	};
	const formatDate = (v: string) =>
		new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(v));
</script>

<svelte:head>
	<title>Progress | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-3xl flex-col gap-8 p-4 pb-12">
	<!-- Breadcrumb + Header -->
	<header>
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
				<li><span class="font-medium text-text-primary">Progress</span></li>
			</ol>
		</nav>
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Progress</h1>
			<p class="mt-1 text-sm text-text-secondary">
				AI report, charts, and check-in history in one place.
			</p>
		</div>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</header>

	<!-- ===== 1. AI Report ===== -->
	<div class="rounded-lg border border-border-default bg-surface-raised p-6">
		<div class="mb-4 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Sparkles class="h-4 w-4 text-accent" />
				<h2 class="text-lg font-bold text-text-primary">AI Performance Report</h2>
			</div>
			{#if reportDate}
				<span class="text-xs text-text-tertiary">
					{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(reportDate)}
				</span>
			{/if}
		</div>

		{#if generating}
			{#if reportContent}
				<!-- eslint-disable svelte/no-at-html-tags -->
				<div class="prose-sm text-sm leading-relaxed text-text-secondary">
					{@html renderMarkdown(reportContent)}
				</div>
				<div class="mt-3 flex items-center gap-2 text-xs text-accent">
					<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
						></path>
					</svg>
					<span class="font-medium">Generating...</span>
				</div>
			{:else}
				<div class="animate-pulse space-y-3">
					<div class="h-4 w-3/4 rounded bg-surface-subtle"></div>
					<div class="h-4 w-full rounded bg-surface-subtle"></div>
					<div class="h-4 w-5/6 rounded bg-surface-subtle"></div>
				</div>
				<p class="mt-4 text-center text-sm font-medium text-accent">Generating insights...</p>
			{/if}
		{:else if reportContent}
			<!-- eslint-disable svelte/no-at-html-tags -->
			<div class="prose-sm text-sm leading-relaxed text-text-secondary">
				{@html renderMarkdown(reportContent)}
			</div>
			<div class="mt-4 flex items-center justify-between">
				<div class="flex gap-1">
					<button
						class="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded px-3 py-2 text-xs transition-colors {reportThumbs ===
						1
							? 'bg-success-muted text-success'
							: 'text-text-muted hover:bg-surface-subtle'}"
						onclick={() => submitFeedback(1)}>Helpful</button
					>
					<button
						class="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded px-3 py-2 text-xs transition-colors {reportThumbs ===
						-1
							? 'bg-error-muted text-error'
							: 'text-text-muted hover:bg-surface-subtle'}"
						onclick={() => submitFeedback(-1)}>Not helpful</button
					>
				</div>
				<button
					onclick={generateReport}
					class="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent-muted"
				>
					<Sparkles class="h-3.5 w-3.5" />
					Regenerate
				</button>
			</div>
		{:else}
			<div class="py-8 text-center">
				<p class="mb-2 text-sm text-text-secondary">
					Get a comprehensive AI analysis of your performance trajectory, perception gaps, and
					actionable recommendations.
				</p>
				{#if generateError}
					<p class="mb-3 text-xs text-error">{generateError}</p>
				{/if}
				<button
					onclick={generateReport}
					class="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
				>
					<Sparkles class="h-4 w-4" />
					Generate Report
				</button>
			</div>
		{/if}
	</div>

	<!-- ===== 2. Effort & Performance Chart ===== -->
	<div class="rounded-lg border border-border-default bg-surface-raised p-6">
		<h2 class="mb-4 text-lg font-bold text-text-primary">Effort & Performance</h2>
		{#if data.visualizationData.individual.length > 0}
			<PerformanceEffortChart
				individualData={data.visualizationData.individual}
				stakeholderData={data.visualizationData.stakeholders}
				stakeholders={data.visualizationData.stakeholderList}
				priorIndividualData={data.visualizationData.priorIndividual}
				priorCycleLabel={data.visualizationData.priorCycleLabel}
			/>
		{:else}
			<div class="py-8 text-center">
				<p class="text-sm text-text-secondary">Complete your first check-in to see charts here.</p>
			</div>
		{/if}
	</div>

	<!-- ===== 3. Check-in History ===== -->
	<div class="rounded-lg border border-border-default bg-surface-raised">
		<div class="flex items-center justify-between px-6 py-4">
			<h2 class="text-lg font-bold text-text-primary">Check-in History</h2>
			{#if data.weeks.length > 0}
				<span class="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-text-muted">
					{data.weeks.length} week{data.weeks.length !== 1 ? 's' : ''}
				</span>
			{/if}
		</div>

		{#if data.weeks.length === 0}
			<div class="border-t border-border-default px-6 py-8 text-center">
				<p class="text-sm text-text-secondary">No check-ins yet. Your history will appear here.</p>
			</div>
		{:else}
			<div class="space-y-0">
				{#each data.weeks as week (week.weekNumber)}
					{@const isExpanded = expandedWeeks.has(week.weekNumber)}
					<div class="border-t border-border-default">
						<button
							type="button"
							onclick={() => toggleWeek(week.weekNumber)}
							aria-expanded={isExpanded}
							class="flex w-full items-center justify-between px-6 py-3 text-left hover:bg-surface-subtle/50"
						>
							<div class="flex items-center gap-3">
								<span
									class="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white"
								>
									{week.weekNumber}
								</span>
								<span class="text-sm font-semibold text-text-primary">Week {week.weekNumber}</span>
								<span class="text-xs text-text-muted">
									{week.reflections.length} check-in{week.reflections.length !== 1 ? 's' : ''}
								</span>
							</div>
							<ChevronDown
								class="h-4 w-4 text-text-muted transition-transform {isExpanded
									? 'rotate-180'
									: ''}"
							/>
						</button>

						{#if isExpanded}
							<div class="space-y-3 px-6 pb-4">
								{#each week.reflections as reflection (reflection.id)}
									<div class="rounded-xl border border-border-default bg-surface-subtle p-4">
										<div class="mb-2 flex items-center justify-between">
											<span
												class="rounded-full bg-accent-muted px-2.5 py-0.5 text-xs font-semibold text-accent"
											>
												Check-in
											</span>
											<span class="text-xs text-text-muted"
												>{formatDate(reflection.checkInDate)}</span
											>
										</div>

										{#if reflection.effortScore !== null || reflection.performanceScore !== null}
											<div class="mb-2 flex gap-4">
												{#if reflection.effortScore !== null}
													<div class="flex items-center gap-2">
														<span class="text-xs text-text-tertiary">Effort:</span>
														<div
															class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold {getScoreBgColor(
																reflection.effortScore,
																'effort'
															)} {getScoreColor(reflection.effortScore, 'effort')}"
														>
															{reflection.effortScore}
														</div>
													</div>
												{/if}
												{#if reflection.performanceScore !== null}
													<div class="flex items-center gap-2">
														<span class="text-xs text-text-tertiary">Performance:</span>
														<div
															class="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold {getScoreBgColor(
																reflection.performanceScore,
																'performance'
															)} {getScoreColor(reflection.performanceScore, 'performance')}"
														>
															{reflection.performanceScore}
														</div>
													</div>
												{/if}
											</div>
										{/if}
										{#if reflection.notes}<p class="text-sm leading-relaxed text-text-secondary">
												{reflection.notes}
											</p>{/if}
										{#if reflection.feedbacks.length > 0}
											<div class="mt-3 border-t border-border-default pt-3">
												<p
													class="mb-2 text-xs font-semibold tracking-wider text-text-muted uppercase"
												>
													Reviewer Feedback
												</p>
												{#each reflection.feedbacks as fb (fb.stakeholderName)}
													<div
														class="mb-2 rounded-lg border border-border-default bg-surface-raised px-3 py-2"
													>
														<div class="flex items-center justify-between">
															<span class="text-xs font-semibold text-text-secondary"
																>{fb.stakeholderName}</span
															>
															<div class="flex gap-3">
																{#if fb.effortScore !== null}<span
																		class="text-xs text-text-tertiary"
																		>E: <span class="font-bold">{fb.effortScore}</span></span
																	>{/if}
																{#if fb.performanceScore !== null}<span
																		class="text-xs text-text-tertiary"
																		>P: <span class="font-bold">{fb.performanceScore}</span></span
																	>{/if}
															</div>
														</div>
														{#if fb.comment}<p class="mt-1 text-xs text-text-secondary">
																{fb.comment}
															</p>{/if}
														{#if fb.behavioralObservation}<p
																class="mt-1 text-xs text-text-secondary"
															>
																<span class="font-medium text-text-tertiary">Observed:</span>
																{fb.behavioralObservation}
															</p>{/if}
														{#if fb.suggestion}<p class="mt-1 text-xs text-text-secondary">
																<span class="font-medium text-text-tertiary">Suggestion:</span>
																{fb.suggestion}
															</p>{/if}
													</div>
												{/each}
											</div>
										{/if}
									</div>
								{/each}
							</div>
						{/if}
					</div>
				{/each}
			</div>
		{/if}
	</div>
</section>
