<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import PerformanceEffortChart from '$lib/components/PerformanceEffortChart.svelte';
	import { addToast } from '$lib/stores/toasts.svelte';
	import {
		Target,
		Sparkles,
		AlertTriangle,
		TrendingUp,
		TrendingDown,
		Minus,
		Lock,
		ChevronDown,
		ChevronLeft,
		ChevronRight,
		CircleCheck
	} from 'lucide-svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';
	import { formatRelativeDays, formatDate } from '$lib/utils/dates';
	import { renderMarkdown } from '$lib/utils/markdown';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	let generatingPrep = $state(false);
	let prepError = $state<string | null>(null);
	let freshPrep = $state<{ id: string; content: string | null; createdAt: string } | null>(null);
	let noteContent = $state('');
	let noteWeek = $state(data.client.goal?.journey?.currentWeek?.toString() ?? '');
	let submittingNote = $state(false);
	let showChart = $state(true);
	const earlyInCycle = $derived((data.client.goal?.journey?.currentWeek ?? 99) <= 3);
	let showCheckins = $state(false);
	let showReviewerFeedback = $state(false);
	let editingNoteId = $state<string | null>(null);
	let editingNoteContent = $state('');
	let deletingNoteId = $state<string | null>(null);
	let deletingNote = $state(false);

	const prepData = $derived(freshPrep ?? data.coachPrep);

	// Fix 4: count notes added since the last prep was generated
	const notesAddedSincePrep = $derived.by((): number => {
		if (!prepData) return 0;
		const prepTime = new Date(prepData.createdAt).getTime();
		return data.allCoachNotes.filter((n) => new Date(n.createdAt).getTime() > prepTime).length;
	});

	async function generatePrep() {
		generatingPrep = true;
		prepError = null;
		freshPrep = { id: '', content: '', createdAt: new Date().toISOString() };
		try {
			const res = await fetch('/api/insights/coach-prep', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Accept: 'text/event-stream'
				},
				body: JSON.stringify({ individualId: data.client.id })
			});

			if (!res.ok) {
				const err = await res.json();
				prepError = err.error || 'Could not generate insights. Try again in a moment.';
				freshPrep = null;
				return;
			}

			const reader = res.body?.getReader();
			if (!reader) {
				// Fallback to non-streaming
				const result = await res.json();
				freshPrep = { id: result.id, content: result.content, createdAt: result.createdAt };
				addToast('Session prep ready', 'success');
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
					if (line.startsWith('data: ')) {
						const payload = line.slice(6);
						try {
							const parsed = JSON.parse(payload);
							if (typeof parsed === 'string') {
								freshPrep = {
									id: freshPrep?.id ?? '',
									content: (freshPrep?.content ?? '') + parsed,
									createdAt: freshPrep?.createdAt ?? new Date().toISOString()
								};
							} else if (parsed.id && typeof parsed.id === 'string') {
								freshPrep = {
									id: parsed.id,
									content: freshPrep?.content ?? '',
									createdAt: freshPrep?.createdAt ?? new Date().toISOString()
								};
							}
						} catch {
							// Ignore malformed JSON
						}
					}
				}
			}

			addToast('Session prep ready', 'success');
		} catch {
			prepError = 'Connection issue — check your network and try again.';
			if (!freshPrep?.content) freshPrep = null;
		} finally {
			generatingPrep = false;
		}
	}

	// Recent weeks: last 3-4 weeks of checkIns
	const recentWeeks = $derived(
		(() => {
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const map = new Map<number, typeof data.allReflections>();
			for (const r of data.allReflections) {
				const week = r.weekNumber;
				if (!map.has(week)) map.set(week, []);
				map.get(week)!.push(r);
			}
			return Array.from(map.entries())
				.sort(([a], [b]) => b - a)
				.slice(0, 4);
		})()
	);

	$effect(() => {
		if (form) {
			submittingNote = false;
		}
		if (form?.noteSuccess) {
			const action = 'noteAction' in form ? form.noteAction : null;
			const msg =
				action === 'deleted'
					? 'Note deleted'
					: action === 'updated'
						? 'Note updated'
						: 'Note saved';
			addToast(msg, 'success');
			noteContent = '';
		}
	});
</script>

<svelte:head>
	<title>{data.client.name} — Session | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-3xl flex-col gap-6 p-4 pb-12">
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
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li>
					<a
						href="/coach/roster"
						class="rounded transition-colors hover:text-text-primary focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none"
						>Clients</a
					>
				</li>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li><span class="font-medium text-text-primary">{data.client.name}</span></li>
			</ol>
		</nav>
		<!-- Client prev/next navigation -->
		{#if data.prevClient || data.nextClient}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<div class="mb-2 flex items-center justify-between">
				{#if data.prevClient}
					<a
						href="/coach/session/{data.prevClient.id}"
						aria-label="Previous client: {data.prevClient.name}"
						class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
					>
						<ChevronLeft class="h-3.5 w-3.5" />
						{data.prevClient.name}
					</a>
				{:else}
					<div></div>
				{/if}
				{#if data.nextClient}
					<a
						href="/coach/session/{data.nextClient.id}"
						aria-label="Next client: {data.nextClient.name}"
						class="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-primary"
					>
						{data.nextClient.name}
						<ChevronRight class="h-3.5 w-3.5" />
					</a>
				{/if}
			</div>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
		<div class="flex items-start justify-between gap-3">
			<div>
				<h1 class="text-2xl font-bold text-text-primary">{data.client.name}</h1>
				<p class="text-sm text-text-muted">{data.client.email}</p>
				{#if data.client.goal}
					<div class="mt-1.5 flex items-center gap-2">
						<Target class="h-4 w-4 text-accent" />
						<span class="text-sm text-text-secondary">{data.client.goal.title}</span>
					</div>
				{/if}
			</div>
			{#if data.client.goal?.journey}
				<span class="rounded-full bg-accent-muted px-3 py-1 text-xs font-semibold text-accent">
					Week {data.client.goal.journey.currentWeek ?? '—'}
				</span>
			{/if}
		</div>
	</header>

	<!-- Journey Completed Banner -->
	{#if data.client.goal?.journey?.status === 'COMPLETED'}
		<div
			class="rounded-xl border border-success/30 bg-gradient-to-r from-success/10 to-success/5 p-5"
		>
			<div class="flex items-center gap-3">
				<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/15">
					<CircleCheck class="h-5 w-5 text-success" />
				</div>
				<div>
					<p class="text-sm font-bold text-success">Journey complete — well coached</p>
					<p class="text-xs text-text-secondary">
						{data.client.name} has completed their journey. Review their progress, insights, and notes
						below.
					</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Alerts -->
	{#if data.client.alerts.length > 0}
		<div class="space-y-2">
			{#each data.client.alerts as alert (alert.message)}
				<div
					class="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning-muted px-4 py-3 text-sm {alert.severity ===
					'high'
						? 'text-error'
						: 'text-warning'}"
				>
					<AlertTriangle class="mt-0.5 h-4 w-4 shrink-0" />
					{alert.message}
				</div>
			{/each}
		</div>
	{/if}

	<!-- At-a-Glance Status -->
	{#if data.client.goal?.insights}
		{@const ins = data.client.goal.insights}
		<div
			class="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-border-default bg-surface-subtle px-4 py-3"
		>
			{#if ins.trajectoryScore !== null}
				<div class="flex items-center gap-1 text-xs">
					{#if ins.trajectoryScore > 5}
						<TrendingUp class="h-3 w-3 text-success" />
						<span class="font-medium text-success">Up</span>
					{:else if ins.trajectoryScore < -5}
						<TrendingDown class="h-3 w-3 text-warning" />
						<span class="font-medium text-warning">Down</span>
					{:else}
						<Minus class="h-3 w-3 text-text-muted" />
						<span class="font-medium text-text-muted">Stable</span>
					{/if}
				</div>
			{/if}
			{#if data.reviewerTrends.length > 0}
				<div class="flex items-center gap-1.5 text-xs">
					<span class="text-text-muted">Reviewers</span>
					<span class="font-bold text-accent tabular-nums">{data.reviewerTrends.length}</span>
				</div>
			{/if}
			{#if data.client.goal.journey}
				<div class="flex items-center gap-1.5 text-xs">
					<span class="text-text-muted">Progress</span>
					<span class="font-bold text-accent tabular-nums"
						>{Math.round(data.client.goal.journey.completion)}%</span
					>
				</div>
			{/if}
			{#if data.client.alerts.length > 0}
				<span class="text-2xs rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning"
					>{data.client.alerts.length} alert{data.client.alerts.length !== 1 ? 's' : ''}</span
				>
			{/if}
		</div>
	{/if}

	<!-- Focus Areas (FocusAreas) -->
	{#if data.focusAreas.length > 0}
		<div class="rounded-xl border border-border-default bg-surface-raised p-4">
			<h2 class="mb-2 text-xs font-bold tracking-wider text-text-tertiary uppercase">
				Focus Areas
			</h2>
			<div class="flex flex-wrap gap-2">
				{#each data.focusAreas as focusArea (focusArea.label)}
					<span
						class="rounded-lg bg-accent-muted px-3 py-1.5 text-xs font-medium text-accent"
						title={focusArea.description || ''}
					>
						{focusArea.label}
					</span>
				{/each}
			</div>
		</div>
	{/if}

	<!-- Section jump-nav -->
	<nav aria-label="Jump to section" class="flex flex-wrap gap-1.5">
		<a
			href="#insights"
			class="text-2xs rounded-full border border-border-default bg-surface-raised px-2.5 py-1 font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
			>Insights</a
		>
		<a
			href="#scores"
			class="text-2xs rounded-full border border-border-default bg-surface-raised px-2.5 py-1 font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
			>Scores</a
		>
		<a
			href="#notes"
			class="text-2xs inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-raised px-2.5 py-1 font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
		>
			Notes
			{#if data.allCoachNotes.length > 0}
				<span
					class="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-muted px-1 font-bold text-accent"
					>{data.allCoachNotes.length}</span
				>
			{/if}
		</a>
		{#if recentWeeks.length > 0}
			<a
				href="#checkins"
				class="text-2xs inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-raised px-2.5 py-1 font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
			>
				Check-ins
				<span class="font-semibold text-accent">Wk {recentWeeks[0][0]}</span>
			</a>
		{/if}
		{#if data.reviewerTrends.length > 0}
			<a
				href="#feedback"
				class="text-2xs inline-flex items-center gap-1 rounded-full border border-border-default bg-surface-raised px-2.5 py-1 font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
			>
				Feedback
				<span
					class="flex h-4 min-w-4 items-center justify-center rounded-full bg-accent-muted px-1 font-bold text-accent"
					>{data.reviewerTrends.length}</span
				>
			</a>
		{/if}
		{#if data.client.visualizationData}
			<a
				href="#chart"
				class="text-2xs rounded-full border border-border-default bg-surface-raised px-2.5 py-1 font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
				>Chart</a
			>
		{/if}
	</nav>

	<!-- Early-in-journey guidance -->
	{#if earlyInCycle}
		<div class="flex items-center gap-2 rounded-lg border border-accent/20 bg-accent/5 px-4 py-2.5">
			<Sparkles class="h-4 w-4 shrink-0 text-accent" />
			<p class="text-xs text-text-secondary">
				Early in {data.client.name}'s journey — focus on building rapport and reviewing their
				initial check-ins and reviewer feedback below.
			</p>
		</div>
	{/if}

	<!-- 1. AI Prep Summary -->
	<div id="insights" class="scroll-anchor rounded-xl border border-accent/20 bg-surface-raised p-5">
		<div class="mb-3 flex items-center justify-between">
			<div class="flex items-center gap-2">
				<Sparkles class="h-4 w-4 text-accent" />
				<h2 class="font-semibold text-text-primary">AI Coaching Insights</h2>
				{#if prepData}
					<span class="text-xs text-text-tertiary">{formatRelativeDays(prepData.createdAt)}</span>
					{#if data.prepFreshness?.isStale}
						<span class="text-2xs rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning">
							{data.prepFreshness.newDataSince} new update{data.prepFreshness.newDataSince !== 1
								? 's'
								: ''}
						</span>
					{/if}
					{#if notesAddedSincePrep > 0}
						<span class="text-2xs rounded-full bg-warning/10 px-2 py-0.5 font-medium text-warning">
							{notesAddedSincePrep} note{notesAddedSincePrep !== 1 ? 's' : ''} added since last prep —
							<button
								type="button"
								onclick={generatePrep}
								class="font-semibold underline underline-offset-2 hover:no-underline"
								>Refresh for latest</button
							>
						</span>
					{/if}
				{/if}
			</div>
			<button
				type="button"
				disabled={generatingPrep}
				onclick={generatePrep}
				class="flex items-center gap-1.5 rounded-lg border border-accent/30 bg-surface-raised px-3 py-1.5 text-xs font-semibold text-accent transition-all hover:border-accent hover:bg-accent-muted disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if generatingPrep}
					<span
						class="h-3 w-3 animate-spin rounded-full border-2 border-accent border-t-transparent"
					></span>
					Generating (~15s)
				{:else if prepData}
					Refresh
				{:else}
					Generate
				{/if}
			</button>
		</div>
		{#if prepError}
			<div class="flex items-start gap-2 rounded-lg border border-error/20 bg-error/5 px-3 py-2">
				<p class="flex-1 text-xs text-error">{prepError}</p>
				<button
					type="button"
					onclick={generatePrep}
					class="shrink-0 text-xs font-semibold text-accent hover:underline">Retry</button
				>
			</div>
		{/if}
		{#if prepData?.content}
			<!-- eslint-disable svelte/no-at-html-tags -->
			<div class="prose prose-sm max-w-none text-text-secondary">
				{@html renderMarkdown(prepData.content)}
			</div>
			{#if data.allCoachNotes.length > 0 && notesAddedSincePrep === 0}
				<p class="mt-3 text-xs text-text-tertiary">
					{data.allCoachNotes.length} note{data.allCoachNotes.length !== 1 ? 's' : ''} included in this
					prep.
				</p>
			{/if}
		{:else}
			<div class="space-y-2">
				<p class="text-sm text-text-tertiary">No prep generated yet. Click above to generate.</p>
				<p class="text-xs text-text-muted">
					AI prep analyzes your client's check-in scores, reviewer feedback, perception gaps, and
					notes to generate tailored coaching conversation starters.
				</p>
			</div>
		{/if}
	</div>

	<!-- 2. Recent Scores + Gap Highlights -->
	{#if data.client.goal?.insights}
		{@const ins = data.client.goal.insights}
		<div
			id="scores"
			class="scroll-anchor grid grid-cols-2 gap-3 sm:grid-cols-4"
			role="region"
			aria-label="Recent scores"
		>
			<div class="rounded-xl border border-border-default bg-surface-raised px-3 py-2">
				<p class="text-2xs font-medium tracking-wider text-text-muted uppercase">
					Effort
					<InfoTip
						text="How much attention they gave this goal, averaged over the last 4 weeks. 0 is none, 10 is exceptional."
					/>
				</p>
				<p class="text-lg font-bold text-data-effort tabular-nums">
					{ins.avgEffort != null ? `${ins.avgEffort.toFixed(1)}/10` : '—'}
				</p>
			</div>
			<div class="rounded-xl border border-border-default bg-surface-raised px-3 py-2">
				<p class="text-2xs font-medium tracking-wider text-text-muted uppercase">
					Performance
					<InfoTip
						text="How effective that work was, averaged over the last 4 weeks. 0 is none, 10 is exceptional."
					/>
				</p>
				<p class="text-lg font-bold text-data-performance tabular-nums">
					{ins.avgProgress != null ? `${ins.avgProgress.toFixed(1)}/10` : '—'}
				</p>
			</div>
			<div class="rounded-xl border border-border-default bg-surface-raised px-3 py-2">
				<p class="text-2xs font-medium tracking-wider text-text-muted uppercase">
					Trend <InfoTip
						text="Score direction over recent weeks. Up = improving, Down = declining"
					/>
				</p>
				<div class="flex items-center gap-1">
					{#if ins.trajectoryScore !== null}
						{#if ins.trajectoryScore > 5}
							<TrendingUp class="h-4 w-4 text-success" />
							<span class="text-sm font-semibold text-success">Up</span>
						{:else if ins.trajectoryScore < -5}
							<TrendingDown class="h-4 w-4 text-warning" />
							<span class="text-sm font-semibold text-warning">Down</span>
						{:else}
							<Minus class="h-4 w-4 text-text-muted" />
							<span class="text-sm font-semibold text-text-muted">Stable</span>
						{/if}
					{:else}
						<span class="text-lg font-bold text-text-muted">—</span>
					{/if}
				</div>
			</div>
			<div class="rounded-xl border border-border-default bg-surface-raised px-3 py-2">
				<p class="text-2xs font-medium tracking-wider text-text-muted uppercase">
					Completion <InfoTip
						text="Journey progress based on weeks elapsed vs total journey length"
					/>
				</p>
				<p class="text-lg font-bold text-accent tabular-nums">
					{data.client.goal.journey ? `${Math.round(data.client.goal.journey.completion)}%` : '—'}
				</p>
			</div>
		</div>
	{/if}

	<!-- Perception Gap -->
	{#if data.client.goal?.insights && data.reviewerTrends.length > 0}
		{@const selfEffort = data.client.goal.insights.avgEffort}
		{@const selfPerf = data.client.goal.insights.avgProgress}
		{@const reviewerEfforts = data.reviewerTrends
			.filter((t) => t.latestEffort !== null)
			.map((t) => t.latestEffort!)}
		{@const reviewerPerfs = data.reviewerTrends
			.filter((t) => t.latestPerformance !== null)
			.map((t) => t.latestPerformance!)}
		{@const avgReviewerEffort =
			reviewerEfforts.length > 0
				? reviewerEfforts.reduce((a, b) => a + b, 0) / reviewerEfforts.length
				: null}
		{@const avgReviewerPerf =
			reviewerPerfs.length > 0
				? reviewerPerfs.reduce((a, b) => a + b, 0) / reviewerPerfs.length
				: null}
		{@const effortGap =
			selfEffort != null && avgReviewerEffort != null ? selfEffort - avgReviewerEffort : null}
		{@const perfGap =
			selfPerf != null && avgReviewerPerf != null ? selfPerf - avgReviewerPerf : null}
		{#if effortGap !== null || perfGap !== null}
			<div class="rounded-xl border border-border-default bg-surface-raised p-4">
				<h2 class="mb-2 text-xs font-bold tracking-wider text-text-tertiary uppercase">
					Perception Gap
				</h2>
				<p class="mb-3 text-xs text-text-muted">
					Difference between self-rating and reviewer average. Positive = self rates higher.
				</p>
				<div class="grid grid-cols-2 gap-3">
					{#if effortGap !== null}
						<div
							class="rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-center"
						>
							<p class="text-2xs font-medium text-text-muted uppercase">Effort Gap</p>
							<p
								class="text-lg font-bold tabular-nums {Math.abs(effortGap) <= 1
									? 'text-success'
									: Math.abs(effortGap) <= 2
										? 'text-warning'
										: 'text-error'}"
							>
								{effortGap > 0 ? '+' : ''}{effortGap.toFixed(1)}
							</p>
						</div>
					{/if}
					{#if perfGap !== null}
						<div
							class="rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-center"
						>
							<p class="text-2xs font-medium text-text-muted uppercase">Performance Gap</p>
							<p
								class="text-lg font-bold tabular-nums {Math.abs(perfGap) <= 1
									? 'text-success'
									: Math.abs(perfGap) <= 2
										? 'text-warning'
										: 'text-error'}"
							>
								{perfGap > 0 ? '+' : ''}{perfGap.toFixed(1)}
							</p>
						</div>
					{/if}
				</div>
				{#if Math.max(Math.abs(effortGap ?? 0), Math.abs(perfGap ?? 0)) > 2}
					<p class="mt-2 text-xs text-error">
						Large gap — this is worth exploring. They may have a blind spot others can help
						illuminate.
					</p>
				{:else if Math.max(Math.abs(effortGap ?? 0), Math.abs(perfGap ?? 0)) > 1}
					<p class="mt-2 text-xs text-warning">
						Moderate gap — a conversation about how they're perceived could unlock a breakthrough.
					</p>
				{:else}
					<p class="mt-2 text-xs text-success">
						This is a great sign — self-perception closely matches how others see them. Build on
						this alignment.
					</p>
				{/if}
			</div>
		{/if}
	{/if}

	<!-- Coaching Prompts -->
	{#if data.client.goal?.insights}
		{@const ins = data.client.goal.insights}
		{@const hasLowEffort = ins.avgEffort != null && ins.avgEffort < 5}
		{@const hasHighEffortLowPerf =
			ins.avgEffort != null && ins.avgProgress != null && ins.avgEffort >= 7 && ins.avgProgress < 5}
		{@const hasDecliningTrend = ins.trajectoryScore !== null && ins.trajectoryScore < -5}
		{#if hasLowEffort || hasHighEffortLowPerf || hasDecliningTrend}
			<div class="rounded-xl border border-accent/20 bg-accent-muted/30 p-4">
				<p class="mb-2 text-xs font-bold tracking-wider text-accent uppercase">Session Starters</p>
				<ul class="space-y-1.5 text-xs text-text-secondary">
					{#if hasLowEffort}
						<li class="flex items-start gap-2">
							<span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent"></span>
							"What's getting in the way of putting more energy into this right now?"
						</li>
					{/if}
					{#if hasHighEffortLowPerf}
						<li class="flex items-start gap-2">
							<span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent"></span>
							"You're putting in strong effort — what would help that translate to results?"
						</li>
					{/if}
					{#if hasDecliningTrend}
						<li class="flex items-start gap-2">
							<span class="mt-1 h-1 w-1 shrink-0 rounded-full bg-accent"></span>
							"Scores have been trending down — what's shifted since things were going well?"
						</li>
					{/if}
				</ul>
			</div>
		{/if}
	{/if}

	<!-- 3. Coach Notes -->
	<div
		id="notes"
		class="scroll-anchor rounded-xl border border-border-default bg-surface-raised p-5"
	>
		<div class="mb-3 flex items-baseline justify-between">
			<h2 class="font-semibold text-text-primary">Coach Notes</h2>
			<p class="text-2xs flex items-center gap-1 text-text-muted">
				<Lock class="h-3 w-3" />
				Private — shapes AI insights
			</p>
		</div>

		<!-- Add note form -->
		<form
			method="post"
			action="?/createNote"
			class="mb-4 rounded-lg border border-border-default bg-surface-subtle p-3"
			use:enhance={() => {
				submittingNote = true;
				return async ({ update }) => {
					submittingNote = false;
					await update();
				};
			}}
		>
			{#if data.journeyId}
				<input type="hidden" name="journeyId" value={data.journeyId} />
			{/if}
			{#if form?.noteError}
				<p class="mb-2 text-xs text-error">{form.noteError}</p>
			{/if}
			<div class="flex gap-3">
				<div class="min-w-0 flex-1">
					<textarea
						name="content"
						rows="2"
						required
						minlength="10"
						maxlength="2000"
						bind:value={noteContent}
						aria-label="Coach note"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
						placeholder="Add a note about this session..."
					></textarea>
				</div>
				<div class="flex shrink-0 flex-col gap-2">
					<input
						type="number"
						name="weekNumber"
						min="1"
						max="52"
						bind:value={noteWeek}
						class="w-16 rounded-lg border border-border-default bg-surface-raised px-2 py-1 text-center text-xs text-text-primary focus:border-accent focus:outline-none"
						placeholder="Wk"
					/>
					<button
						type="submit"
						disabled={submittingNote}
						class="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
					>
						{submittingNote ? 'Saving...' : 'Save'}
					</button>
				</div>
			</div>
		</form>

		<!-- Notes list -->
		{#if data.allCoachNotes.length > 0}
			<ul class="space-y-2">
				{#each data.allCoachNotes as note (note.id)}
					<li class="rounded-lg border border-border-default bg-surface-subtle p-3">
						{#if editingNoteId === note.id}
							<form
								method="post"
								action="?/editNote"
								use:enhance={() => {
									return async ({ update }) => {
										editingNoteId = null;
										editingNoteContent = '';
										await update();
									};
								}}
							>
								<input type="hidden" name="noteId" value={note.id} />
								<textarea
									name="content"
									rows="2"
									required
									minlength="10"
									maxlength="2000"
									bind:value={editingNoteContent}
									class="w-full rounded-xl border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
								></textarea>
								<div class="mt-2 flex justify-end gap-2">
									<button
										type="button"
										onclick={() => {
											editingNoteId = null;
											editingNoteContent = '';
										}}
										class="rounded px-3 py-1 text-xs text-text-muted hover:text-text-primary"
										>Cancel</button
									>
									<button
										type="submit"
										class="rounded-lg bg-accent px-3 py-1 text-xs font-semibold text-white hover:bg-accent-hover"
										>Save</button
									>
								</div>
							</form>
						{:else}
							<p class="text-sm text-text-secondary">{note.content}</p>
							<div class="mt-1.5 flex items-center justify-between">
								<div class="flex items-center gap-2 text-xs text-text-tertiary">
									{#if note.weekNumber}
										<span class="rounded-full bg-accent-muted px-2 py-0.5 font-semibold text-accent"
											>Week {note.weekNumber}</span
										>
									{/if}
									<span>{formatRelativeDays(note.createdAt)}</span>
								</div>
								<div class="flex items-center gap-1">
									<button
										type="button"
										onclick={() => {
											editingNoteId = note.id;
											editingNoteContent = note.content;
										}}
										class="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:text-accent"
										>Edit</button
									>
									{#if deletingNoteId === note.id}
										<form
											method="post"
											action="?/deleteNote"
											use:enhance={() => {
												deletingNote = true;
												return async ({ update }) => {
													deletingNote = false;
													await update();
												};
											}}
										>
											<input type="hidden" name="noteId" value={note.id} />
											<button
												type="submit"
												disabled={deletingNote}
												class="rounded px-2 py-1 text-xs font-semibold text-error hover:bg-error/10 disabled:opacity-50"
												>{deletingNote ? 'Deleting…' : 'Confirm'}</button
											>
										</form>
										<button
											type="button"
											onclick={() => (deletingNoteId = null)}
											class="rounded px-2 py-1 text-xs text-text-muted hover:text-text-primary"
											>Cancel</button
										>
									{:else}
										<button
											type="button"
											onclick={() => (deletingNoteId = note.id)}
											class="rounded px-2 py-1 text-xs text-text-muted transition-colors hover:text-error"
											>Delete</button
										>
									{/if}
								</div>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		{:else}
			<p class="text-center text-sm text-text-tertiary">
				No notes yet. Session notes help the AI personalize coaching insights.
			</p>
		{/if}
	</div>

	<!-- Recent check-ins (last 3-4 weeks) — collapsed by default -->
	{#if recentWeeks.length > 0}
		<div
			id="checkins"
			class="scroll-anchor rounded-xl border border-border-default bg-surface-raised"
		>
			<button
				type="button"
				onclick={() => (showCheckins = !showCheckins)}
				aria-expanded={showCheckins}
				class="flex w-full items-center justify-between p-5 text-left"
			>
				<h2 class="font-semibold text-text-primary">Recent Check-ins</h2>
				<ChevronDown
					class="h-4 w-4 text-text-muted transition-transform {showCheckins ? 'rotate-180' : ''}"
				/>
			</button>
			{#if showCheckins}
				<div class="space-y-3 px-5 pb-5">
					{#each recentWeeks as [weekNumber, checkIns] (weekNumber)}
						<div class="rounded-lg border border-border-default bg-surface-subtle p-3">
							<p class="mb-1.5 text-xs font-bold text-text-secondary">Week {weekNumber}</p>
							<div class="space-y-1.5">
								{#each checkIns as r (r.id)}
									<div class="flex items-start gap-2 text-xs">
										<span
											class="text-2xs shrink-0 rounded bg-accent-muted px-1.5 py-0.5 font-semibold text-accent"
										>
											Self
										</span>
										<div class="min-w-0 flex-1">
											{#if r.effortScore !== null || r.performanceScore !== null}
												<span class="text-text-secondary">
													{#if r.effortScore !== null}Effort: <strong>{r.effortScore}/10</strong
														>{/if}
													{#if r.effortScore !== null && r.performanceScore !== null}
														·
													{/if}
													{#if r.performanceScore !== null}Perf: <strong
															>{r.performanceScore}/10</strong
														>{/if}
												</span>
											{/if}
											{#if r.notes}
												<p class="mt-0.5 text-text-muted">{r.notes}</p>
											{/if}
										</div>
										{#if r.submittedAt}
											<span class="text-2xs shrink-0 text-text-muted"
												>{formatDate(r.submittedAt)}</span
											>
										{/if}
									</div>
								{/each}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- Reviewer feedback summary — collapsed by default -->
	{#if data.reviewerTrends.length > 0}
		<div
			id="feedback"
			class="scroll-anchor rounded-xl border border-border-default bg-surface-raised"
		>
			<button
				type="button"
				onclick={() => (showReviewerFeedback = !showReviewerFeedback)}
				aria-expanded={showReviewerFeedback}
				class="flex w-full items-center justify-between p-5 text-left"
			>
				<h2 class="font-semibold text-text-primary">Reviewer Feedback</h2>
				<div class="flex items-center gap-2">
					<span class="text-2xs rounded-full bg-accent-muted px-2 py-0.5 font-semibold text-accent"
						>{data.reviewerTrends.length} reviewer{data.reviewerTrends.length !== 1
							? 's'
							: ''}</span
					>
					<ChevronDown
						class="h-4 w-4 text-text-muted transition-transform {showReviewerFeedback
							? 'rotate-180'
							: ''}"
					/>
				</div>
			</button>
			{#if showReviewerFeedback}
				<div class="grid gap-2 px-5 pb-5 sm:grid-cols-2">
					{#each data.reviewerTrends as trend (trend.name)}
						{@const effortDiff =
							trend.latestEffort != null && trend.previousEffort != null
								? trend.latestEffort - trend.previousEffort
								: null}
						{@const perfDiff =
							trend.latestPerformance != null && trend.previousPerformance != null
								? trend.latestPerformance - trend.previousPerformance
								: null}
						<div
							class="flex items-center justify-between rounded-lg border border-border-default bg-surface-subtle px-3 py-2"
						>
							<div>
								<p class="text-sm font-medium text-text-primary">{trend.name}</p>
								<div class="flex gap-3 text-xs text-text-muted">
									{#if trend.latestEffort !== null}
										<span>Effort: {trend.latestEffort}/10</span>
									{/if}
									{#if trend.latestPerformance !== null}
										<span>Perf: {trend.latestPerformance}/10</span>
									{/if}
								</div>
							</div>
							{#if effortDiff !== null || perfDiff !== null}
								{@const avgDiff =
									((effortDiff ?? 0) + (perfDiff ?? 0)) /
									((effortDiff !== null ? 1 : 0) + (perfDiff !== null ? 1 : 0) || 1)}
								<span
									class="text-xs {avgDiff > 0.5
										? 'text-success'
										: avgDiff < -0.5
											? 'text-error'
											: 'text-text-muted'}"
								>
									{#if avgDiff > 0.5}
										<TrendingUp class="h-3.5 w-3.5" />
									{:else if avgDiff < -0.5}
										<TrendingDown class="h-3.5 w-3.5" />
									{:else}
										<Minus class="h-3.5 w-3.5" />
									{/if}
								</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- 4. Trend Chart -->
	{#if data.client.visualizationData && data.client.visualizationData.individual.length > 0}
		<div id="chart" class="scroll-anchor rounded-xl border border-border-default bg-surface-raised">
			<button
				type="button"
				onclick={() => (showChart = !showChart)}
				aria-expanded={showChart}
				class="flex w-full items-center justify-between p-5 text-left"
			>
				<h2 class="font-semibold text-text-primary">Performance & Effort Trends</h2>
				<ChevronDown
					class="h-4 w-4 text-text-muted transition-transform {showChart ? 'rotate-180' : ''}"
				/>
			</button>
			{#if showChart}
				<div class="border-t border-border-default p-5">
					<PerformanceEffortChart
						individualData={data.client.visualizationData.individual}
						reviewerData={data.client.visualizationData.reviewers}
						reviewers={data.client.visualizationData.reviewerList}
						selfLabel="Self-rated"
					/>
				</div>
			{/if}
		</div>
	{/if}
</section>
