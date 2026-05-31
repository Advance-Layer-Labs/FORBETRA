<script lang="ts">
	import type { PageData } from './$types';
	import CorrelationView from '$lib/components/CorrelationView.svelte';
	import GapLensView from '$lib/components/GapLensView.svelte';
	import {
		FileText,
		ThumbsUp,
		ThumbsDown,
		History,
		ChevronDown,
		BarChart3,
		MessageCircle,
		ChevronRight
	} from 'lucide-svelte';
	import ErrorBoundary from '$lib/components/ErrorBoundary.svelte';
	import { renderMarkdown } from '$lib/utils/markdown';

	const { data }: { data: PageData } = $props();

	let showHistory = $state(false);
	let showExplore = $state(false);

	import { addToast } from '$lib/stores/toasts.svelte';

	// AI Performance Report state
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
				const err = await res.json();
				generateError = err.error ?? 'Something went wrong';
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
					if (line.startsWith('event: meta')) {
						// Next data line contains the insight ID
						continue;
					}
					if (line.startsWith('event: done')) {
						continue;
					}
					if (line.startsWith('event: error')) {
						continue;
					}
					if (line.startsWith('data: ')) {
						const payload = line.slice(6);
						try {
							const parsed = JSON.parse(payload);
							if (typeof parsed === 'string') {
								// Text chunk
								freshReport = {
									id: freshReport?.id ?? '',
									content: (freshReport?.content ?? '') + parsed,
									createdAt: freshReport?.createdAt ?? new Date().toISOString()
								};
							} else if (parsed.id && typeof parsed.id === 'string') {
								// Meta event with insight ID
								freshReport = {
									id: parsed.id,
									content: freshReport?.content ?? '',
									createdAt: freshReport?.createdAt ?? new Date().toISOString()
								};
							}
						} catch {
							// Ignore malformed JSON
						}
					}
				}
			}

			reportThumbs = null;
			addToast('Report generated', 'success');
		} catch {
			generateError = 'Network error. Please try again.';
			if (!freshReport?.content) {
				freshReport = null;
			}
		} finally {
			generating = false;
		}
	}

	function parseReportSections(content: string): Array<{ title: string; body: string }> {
		const sections: Array<{ title: string; body: string }> = [];
		const parts = content.split(/^## /m);
		for (const part of parts) {
			const trimmed = part.trim();
			if (!trimmed) continue;
			const newlineIndex = trimmed.indexOf('\n');
			if (newlineIndex === -1) {
				sections.push({ title: trimmed, body: '' });
			} else {
				sections.push({
					title: trimmed.slice(0, newlineIndex).trim(),
					body: trimmed.slice(newlineIndex + 1).trim()
				});
			}
		}
		return sections;
	}

	const reportSections = $derived(reportContent ? parseReportSections(reportContent) : []);

	function getSectionColor(title: string): string {
		const t = title.toLowerCase();
		if (t.includes('strengths') || t.includes('recommendations')) return 'border-l-emerald-500';
		return 'border-l-accent';
	}

	async function submitReportFeedback(thumbs: number) {
		if (!reportId) return;
		reportThumbs = thumbs;
		await fetch(`/api/insights/${reportId}/feedback`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ thumbs })
		});
	}
</script>

<svelte:head>
	<title>Insights | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-6xl flex-col gap-8 p-4 pb-12">
	<!-- Header -->
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
				<li><span class="font-medium text-text-primary">Insights</span></li>
			</ol>
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<h1 class="text-2xl font-bold text-text-primary">Insights</h1>
		<p class="mt-1 text-text-secondary">Track your performance and consistency over time</p>
		<p class="mt-0.5 text-xs text-text-tertiary">
			AI reports, correlation charts, and perception gap analysis — all built from your check-ins
			and reviewer feedback.
		</p>
	</header>

	<!-- AI Performance Report -->
	<ErrorBoundary>
		<div class="rounded-lg border border-border-default bg-surface-raised p-6">
			<div class="mb-4 flex items-center justify-between">
				<div class="flex items-center gap-2">
					<FileText class="h-4 w-4 text-text-muted" />
					<h2 class="text-lg font-bold text-text-primary">AI Performance Report</h2>
				</div>
				{#if reportDate}
					<span class="text-xs text-text-tertiary">
						{new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(reportDate)}
					</span>
				{/if}
			</div>

			{#if generating}
				{#if reportSections.length > 0}
					<!-- Streaming: show sections as they arrive -->
					<div class="space-y-3">
						{#each reportSections as section (section.title)}
							<div
								class="rounded-lg border-l-4 bg-surface-subtle p-4 {getSectionColor(
									section.title
								)} animate-in fade-in"
							>
								<h3 class="mb-2 text-sm font-bold text-text-primary">{section.title}</h3>
								<div class="text-sm leading-relaxed whitespace-pre-line text-text-secondary">
									{section.body}
								</div>
							</div>
						{/each}
					</div>
					<div class="mt-3 flex items-center gap-2 text-xs text-accent">
						<svg class="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
							<circle
								class="opacity-25"
								cx="12"
								cy="12"
								r="10"
								stroke="currentColor"
								stroke-width="4"
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
						<div class="h-4 w-2/3 rounded bg-surface-subtle"></div>
					</div>
					<p class="mt-4 text-center text-sm font-medium text-accent">Generating insights...</p>
					<p class="mt-1 text-center text-xs text-text-tertiary">
						Sections will appear as they're generated
					</p>
				{/if}
			{:else if reportSections.length > 0}
				<div class="space-y-3">
					{#each reportSections as section (section.title)}
						<div
							class="rounded-lg border-l-4 bg-surface-subtle p-4 {getSectionColor(section.title)}"
						>
							<h3 class="mb-2 text-sm font-bold text-text-primary">{section.title}</h3>
							<!-- eslint-disable svelte/no-at-html-tags -->
							<div class="prose-sm text-sm leading-relaxed text-text-secondary">
								{@html renderMarkdown(section.body)}
							</div>
						</div>
					{/each}
				</div>

				<!-- Feedback + Regenerate -->
				<div class="mt-4 flex items-center justify-between">
					<div class="flex gap-1">
						<button
							class="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded px-3 py-2 text-xs transition-colors {reportThumbs ===
							1
								? 'bg-success-muted text-success'
								: 'text-text-muted hover:bg-surface-subtle'}"
							onclick={() => submitReportFeedback(1)}
						>
							<ThumbsUp class="h-3.5 w-3.5" /> Helpful
						</button>
						<button
							class="flex min-h-[44px] min-w-[44px] items-center gap-1 rounded px-3 py-2 text-xs transition-colors {reportThumbs ===
							-1
								? 'bg-error-muted text-error'
								: 'text-text-muted hover:bg-surface-subtle'}"
							onclick={() => submitReportFeedback(-1)}
						>
							<ThumbsDown class="h-3.5 w-3.5" /> Not helpful
						</button>
					</div>
					<button
						onclick={generateReport}
						class="inline-flex items-center gap-1.5 rounded-lg border border-accent/30 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:bg-accent-muted"
					>
						Regenerate Report
					</button>
				</div>
			{:else}
				<!-- Empty state -->
				<div class="py-8 text-center">
					<p class="mb-2 text-sm text-text-secondary">
						Get a comprehensive AI analysis of your full journey — performance trajectory,
						perception gaps, strengths, and actionable recommendations.
					</p>
					{#if (data.historyWeeks?.length ?? 0) < 2}
						<p class="mb-3 text-xs text-text-tertiary">
							For best results, complete at least 2 weeks of check-ins first. The report uses your
							reflection history and reviewer feedback to find patterns — there's not much to find
							yet.
						</p>
					{/if}
					{#if generateError}
						<p class="mb-3 text-xs text-error">{generateError}</p>
					{/if}
					<button
						onclick={generateReport}
						class="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
					>
						Generate AI Report
					</button>
				</div>
			{/if}
		</div>
	</ErrorBoundary>

	<!-- Explore Your Data toggle -->
	{#if !showExplore}
		<div class="flex justify-center">
			<button
				onclick={() => (showExplore = true)}
				class="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-raised px-5 py-2.5 text-sm font-semibold text-text-secondary transition-all hover:border-accent/30 hover:text-accent"
			>
				<BarChart3 class="h-4 w-4" />
				Explore Your Data
			</button>
		</div>
	{/if}

	{#if showExplore}
		<!-- Correlation View -->
		{#if data.correlationData && (data.correlationData.individual.length > 0 || data.correlationData.stakeholders.length > 0)}
			<div class="rounded-lg border border-border-default bg-surface-raised p-6">
				<CorrelationView
					individualData={data.correlationData.individual}
					stakeholderData={data.correlationData.stakeholders}
				/>
			</div>
		{:else}
			<div class="rounded-lg border border-dashed border-border-strong bg-surface-raised p-6">
				<h2 class="mb-2 text-lg font-bold text-text-primary">Correlation View</h2>
				<p class="text-sm text-text-secondary">
					Shows how your effort and performance relate over time. Complete 3+ check-ins to unlock
					this view.
				</p>
			</div>
		{/if}

		<!-- Gap Lens View -->
		{#if data.gapLensData && (data.gapLensData.effort.length > 0 || data.gapLensData.performance.length > 0)}
			<div class="rounded-lg border border-border-default bg-surface-raised p-6">
				<GapLensView
					effortGaps={data.gapLensData.effort}
					performanceGaps={data.gapLensData.performance}
					stakeholders={data.gapLensData.stakeholders ?? []}
				/>
			</div>
		{:else}
			<div class="rounded-lg border border-dashed border-border-strong bg-surface-raised p-6">
				<h2 class="mb-2 text-lg font-bold text-text-primary">Gap Lens</h2>
				<p class="text-sm text-text-secondary">
					Reveals differences between how you see yourself and how others see you. Add reviewers and
					complete check-ins to unlock this view.
				</p>
			</div>
		{/if}

		<!-- History Accordion -->
		{#if data.historyWeeks && data.historyWeeks.length > 0}
			<div class="rounded-2xl border border-border-default bg-surface-raised">
				<button
					type="button"
					onclick={() => (showHistory = !showHistory)}
					class="flex w-full items-center justify-between px-6 py-4 text-left"
				>
					<div class="flex items-center gap-2">
						<History class="h-4 w-4 text-text-muted" />
						<h2 class="text-base font-semibold text-text-primary">Check-in History</h2>
						<span class="rounded-full bg-surface-subtle px-2 py-0.5 text-xs text-text-muted">
							{data.historyWeeks.length} week{data.historyWeeks.length !== 1 ? 's' : ''}
						</span>
					</div>
					<ChevronDown
						class="h-4 w-4 text-text-muted transition-transform {showHistory ? 'rotate-180' : ''}"
					/>
				</button>

				{#if showHistory}
					<div class="border-t border-border-default px-6 py-4">
						<div class="space-y-4">
							{#each data.historyWeeks as week (week.weekNumber)}
								<div class="rounded-xl border border-border-default bg-surface-subtle p-4">
									<p class="mb-2 text-sm font-semibold text-text-primary">Week {week.weekNumber}</p>
									<div class="space-y-2">
										{#each week.reflections as reflection (reflection.id)}
											<div class="flex items-center justify-between text-sm">
												<span class="text-text-secondary"
													>{reflection.type === 'RATING_A' ? 'Check-in' : 'Rating'}</span
												>
												<div class="flex gap-4">
													{#if reflection.effortScore !== null}
														<span class="text-data-effort tabular-nums"
															>Effort: {reflection.effortScore}/10</span
														>
													{/if}
													{#if reflection.performanceScore !== null}
														<span class="text-data-performance tabular-nums"
															>Performance: {reflection.performanceScore}/10</span
														>
													{/if}
												</div>
											</div>
											{#if reflection.notes}
												<p class="mt-1 text-xs text-text-muted italic">{reflection.notes}</p>
											{/if}
										{/each}
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Ask AI Bridge CTA -->
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a
		href="/individual/ask"
		class="group flex items-center gap-4 rounded-2xl border border-accent/20 bg-gradient-to-r from-accent/5 to-transparent p-5 transition-all hover:border-accent/40"
	>
		<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/10">
			<MessageCircle class="h-5 w-5 text-accent" />
		</div>
		<div class="min-w-0 flex-1">
			<p class="text-sm font-semibold text-text-primary">Have questions about your data?</p>
			<p class="text-xs text-text-secondary">
				Ask AI to explain trends, explore patterns, or dig deeper into your feedback.
			</p>
		</div>
		<ChevronRight
			class="h-4 w-4 shrink-0 text-accent transition-transform group-hover:translate-x-0.5"
		/>
	</a>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->
</section>
