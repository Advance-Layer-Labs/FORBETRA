<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import HistoricRatingsChart from '$lib/components/HistoricRatingsChart.svelte';
	import {
		getScoreColor,
		getScoreBgColor,
		getButtonSelectedColors,
		getButtonHoverColors,
		getFocusRing
	} from '$lib/utils/scoreColors';
	import { addToast } from '$lib/stores/toasts.svelte';
	import {
		CircleCheck,
		Target,
		ClipboardList,
		Dumbbell,
		TrendingUp,
		PenLine,
		Send
	} from 'lucide-svelte';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	const milestoneMessages: Record<number, string> = {
		3: 'First streak! 3 in a row',
		7: 'One week strong! 7 straight',
		14: 'Two weeks of consistency!',
		21: 'Three-week powerhouse!',
		30: 'A full month of dedication!',
		50: 'Elite commitment — 50 check-ins!'
	};

	let toastShownForForm: ActionData | null = null;
	$effect(() => {
		if (form?.success && form !== toastShownForForm) {
			toastShownForForm = form;
			if (form.milestone && milestoneMessages[form.milestone]) {
				addToast(milestoneMessages[form.milestone], 'success', 6000);
			} else {
				addToast('Check-in submitted!', 'success');
			}
		}
	});

	let effortScore: number | null = $state(data.previousEntry?.effortScore ?? null);
	let performanceScore: number | null = $state(data.previousEntry?.performanceScore ?? null);
	let notes = $state(data.previousEntry?.notes ?? '');
	let isSubmitting = $state(false);
	// Auto-expand on first check-in, collapse thereafter
	const isFirstCheckin = data.isBaseline;
	let showBehavioralIndicators = $state(isFirstCheckin);
	// Notes collapsed by default (except first check-in or midpoint)
	let showNotes = $state(isFirstCheckin || (data.isMidpoint && !!data.identityAnchor));
	let submitBtnEl = $state<HTMLElement | undefined>(undefined);
	// Emphasize submit when both scores are selected
	const bothScoresSelected = $derived(effortScore !== null && performanceScore !== null);
	$effect(() => {
		if (bothScoresSelected && !showNotes && submitBtnEl) {
			submitBtnEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
		}
	});

	// Update scores when previousEntry changes
	$effect(() => {
		if (data.previousEntry) {
			effortScore = data.previousEntry.effortScore ?? null;
			performanceScore = data.previousEntry.performanceScore ?? null;
		}
	});

	const formatDate = (value: string) =>
		new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));

	const notePrompt = $derived.by(() => {
		// No prompt until scores are selected
		if (effortScore === null || performanceScore === null) {
			return "What went well? What's challenging? What stood out this week?";
		}
		// Midpoint identity reflection override
		if (data.isMidpoint && data.identityAnchor) {
			return `In week 1 you wrote: "${data.identityAnchor}". Halfway through your journey — does that still fit? Write what feels right now.`;
		}
		const prev = data.previousRatings;
		if (prev?.effortScore != null && prev?.performanceScore != null) {
			const eDiff = effortScore - prev.effortScore;
			const pDiff = performanceScore - prev.performanceScore;
			if (eDiff <= -3 && pDiff <= -3) return 'Both scores dropped this week. What changed?';
			if (eDiff >= 3 && pDiff >= 3) return 'A big leap forward! What made the difference?';
			if (eDiff <= -3 && pDiff >= 0)
				return 'Your effort dipped but performance held. What happened this week?';
			if (pDiff <= -3 && eDiff >= 0)
				return 'Despite strong effort, performance dropped. What got in the way?';
			if (eDiff >= 3) return 'You ramped up effort this week. What are you doing differently?';
			if (pDiff >= 3) return 'Performance jumped — what shifted?';
		}
		if (effortScore >= 7 && performanceScore <= 3)
			return "You're putting in the work but results aren't there yet. What's getting in the way?";
		if (effortScore <= 3 && performanceScore >= 7)
			return "Results are strong despite lower effort. What's sustaining your performance?";
		if (effortScore <= 3 && performanceScore <= 3)
			return "A tough week. What's the one thing that could shift things next week?";
		if (effortScore >= 7 && performanceScore >= 7)
			return "Things are going well — what's driving your momentum?";
		return "What went well? What's challenging? What stood out this week?";
	});

	const handleSubmit = () => {
		isSubmitting = true;
	};
</script>

<svelte:head>
	<title>Check-in | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-4xl flex-col gap-6 p-4 pb-12">
	<!-- Back to Today Link -->
	<div class="flex items-center justify-between">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/individual/today"
			class="group flex items-center gap-2 text-sm font-medium text-text-secondary transition-colors hover:text-text-primary"
		>
			<svg
				class="h-4 w-4 transition-transform group-hover:-translate-x-1"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
			</svg>
			Back to Today
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	</div>

	{#if data.isPreview}
		<div
			class="fixed top-4 right-4 z-50 max-w-xs rounded-lg border border-accent/30 bg-accent-muted p-3 text-xs text-accent"
		>
			<p class="font-semibold">Preview Mode</p>
			<p class="mt-1 text-xs">Submissions will be saved normally.</p>
		</div>
	{/if}
	<!-- Header with encouraging messaging -->
	<header class="space-y-3 text-center">
		<div
			class="inline-flex items-center gap-2 rounded-full bg-accent-muted px-4 py-1.5 text-xs font-medium text-accent"
		>
			<span class="h-2 w-2 rounded-full bg-accent"></span>
			Week {data.currentWeek} Check-in
		</div>
		<h1 class="text-3xl font-bold text-text-primary">{data.checkInLabel}</h1>
		<p class="text-base text-text-secondary">
			{#if data.isBaseline}This first check-in is your baseline. Be honest — this is a starting
				point, not a judgment.{:else if data.currentWeek <= 3}Each week builds your data. Patterns
				start emerging around week 3–4.{:else}Rate your effort and performance. Your coach and AI
				insights use this data.{/if}
		</p>
		{#if !data.isPreview && !data.isAvailable}
			<div
				class="mx-auto max-w-md rounded-xl border border-warning/30 bg-signal-different-muted p-4 text-sm text-signal-different"
			>
				<p class="font-medium">Check-in not yet available</p>
				<p class="mt-1">
					This check-in opens on {formatDate(data.availableDate)}. Check back then to record your
					response.
				</p>
			</div>
		{/if}
	</header>

	<div aria-live="polite">
		{#if form?.error}
			<div
				class="mx-auto max-w-2xl rounded-xl border border-error/30 bg-signal-attention-muted p-4 text-sm text-signal-attention"
			>
				<p class="font-medium">{form.error}</p>
			</div>
		{/if}

		{#if form?.success}
			<div
				class="animate-in fade-in slide-in-from-top-2 mx-auto max-w-2xl rounded-xl border border-success/30 bg-signal-aligned-muted p-6 text-center"
			>
				<CircleCheck class="mx-auto mb-2 h-10 w-10 text-signal-aligned" />
				<p class="text-lg font-semibold text-signal-aligned">
					Week {data.currentWeek} check-in saved
				</p>
				{#if data.previousRatings}
					{@const eDiff =
						(effortScore ?? 0) - (data.previousRatings.effortScore ?? effortScore ?? 0)}
					{@const pDiff =
						(performanceScore ?? 0) -
						(data.previousRatings.performanceScore ?? performanceScore ?? 0)}
					<p class="mt-1 text-sm text-text-secondary">
						Effort {effortScore}{#if eDiff > 0}
							<span class="text-signal-aligned">(↑{eDiff})</span>{:else if eDiff < 0}
							<span class="text-signal-attention">(↓{Math.abs(eDiff)})</span>{/if}
						· Performance {performanceScore}{#if pDiff > 0}
							<span class="text-signal-aligned">(↑{pDiff})</span>{:else if pDiff < 0}
							<span class="text-signal-attention">(↓{Math.abs(pDiff)})</span>{/if}
					</p>
				{/if}
				{#if !form.streak || form.streak < 3}
					<p class="mt-1 text-sm text-text-secondary">
						This data is already working — your coach and AI insights update within 24 hours.
					</p>
				{/if}
				{#if form.streak && form.streak >= 3}
					{#if form.streak >= 20}
						<div class="mt-2 rounded-lg bg-warning/10 px-3 py-2">
							<p class="text-sm font-semibold text-signal-different">
								{form.streak}-check-in streak — this kind of consistency changes how you lead.
							</p>
						</div>
					{:else if form.streak >= 10}
						<div class="mt-2 rounded-lg bg-warning/10 px-3 py-2">
							<p class="text-sm font-semibold text-signal-different">
								{form.streak} in a row. You've built a real practice. The data shows it.
							</p>
						</div>
					{:else if form.streak >= 5}
						<p class="mt-1 text-sm font-semibold text-signal-different">
							{form.streak}-check-in streak — real patterns are forming.
						</p>
					{:else}
						<p class="mt-1 text-sm font-semibold text-signal-different">
							{form.streak} check-ins in a row — keep building.
						</p>
					{/if}
				{/if}
				{#if form.microMoment}
					<div
						class="mt-4 rounded-xl border border-accent/20 bg-gradient-to-b from-accent-muted/60 to-surface-raised px-5 py-4 text-left"
					>
						<p class="text-xs font-semibold tracking-wide text-accent uppercase">
							{form.microMoment.title}
						</p>
						<p class="mt-1.5 text-sm leading-relaxed text-text-secondary">
							{form.microMoment.message}
						</p>
					</div>
				{/if}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/today"
					class="mt-4 inline-flex items-center gap-2 rounded-lg bg-success px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-success/90"
				>
					Return to Today
					<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 5l7 7-7 7"
						/>
					</svg>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{/if}
	</div>

	<div class="mx-auto w-full max-w-2xl space-y-6">
		{#if !data.isPreview && !data.isAvailable && !data.previousEntry}
			<div class="rounded-2xl border border-border-default bg-surface-raised p-8 text-center">
				<div
					class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-subtle"
				>
					<svg
						class="h-8 w-8 text-text-muted"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
						/>
					</svg>
				</div>
				<h2 class="text-lg font-semibold text-text-primary">Check-in opens soon</h2>
				<p class="mt-2 text-sm text-text-secondary">
					Your next check-in will be available on {formatDate(data.availableDate)}.
				</p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/today"
					class="mt-6 inline-flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
				>
					Back to Home
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		{:else}
			{#if data.identityAnchor}
				<div class="rounded-xl border border-accent/20 bg-accent-muted/50 px-5 py-3 text-center">
					<p class="text-xs font-medium tracking-wide text-accent uppercase">Week 1 note</p>
					<p class="mt-1 text-sm text-text-primary italic">"{data.identityAnchor}"</p>
				</div>
			{/if}
			<!-- Interactive Check-in Form -->
			<form method="post" onsubmit={handleSubmit} class="space-y-6">
				<!-- Hidden inputs for form submission -->
				<input type="hidden" name="effortScore" value={effortScore ?? ''} />
				<input type="hidden" name="performanceScore" value={performanceScore ?? ''} />

				<!-- Simple Goal Display -->
				<div class="rounded-xl border border-border-default bg-surface-subtle px-5 py-4">
					<div class="flex items-center gap-3 text-base text-text-secondary">
						<Target class="h-5 w-5 text-accent" />
						<span class="font-medium">Goal:</span>
						<span class="text-lg font-semibold text-text-primary">{data.goal.title}</span>
					</div>
				</div>

				<!-- Focus Areas are unscored hints for the goal rating -->
				{#if data.focusAreas.length > 0}
					<div class="rounded-xl border border-border-default bg-surface-raised">
						<button
							type="button"
							onclick={() => (showBehavioralIndicators = !showBehavioralIndicators)}
							class="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-surface-subtle"
						>
							<div class="flex items-center gap-2">
								<ClipboardList class="h-5 w-5 text-text-secondary" />
								<span class="text-sm font-medium text-text-secondary">Focus Areas</span>
							</div>
							<svg
								class="h-5 w-5 text-text-tertiary transition-transform {showBehavioralIndicators
									? 'rotate-180'
									: ''}"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M19 9l-7 7-7-7"
								/>
							</svg>
						</button>
						{#if showBehavioralIndicators}
							<div class="border-t border-border-default px-4 py-4">
								<p class="mb-3 text-xs leading-relaxed text-text-secondary">
									Unscored hints for this goal. Use them when you rate effort and performance. They
									are not scored on their own.
								</p>
								<div class="space-y-2">
									{#each data.focusAreas as focusArea, index (focusArea.id)}
										<div
											class="flex items-start gap-3 rounded-lg border border-border-default bg-surface-subtle p-3"
										>
											<span
												class="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-muted text-xs font-bold text-accent"
											>
												{index + 1}
											</span>
											<div class="flex-1">
												<p class="font-semibold text-text-primary">{focusArea.label}</p>
												{#if focusArea.description}
													<p class="mt-1 text-xs text-text-secondary">{focusArea.description}</p>
												{/if}
											</div>
										</div>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				{/if}

				{#if data.currentWeek > 1 && data.previousRatings}
					{@const historicRatings = data.historicRatings ?? []}
					<div class="rounded-xl border border-accent/30 bg-accent-muted p-4">
						<div class="mb-3">
							<p class="text-sm font-semibold text-accent">Your last ratings:</p>
						</div>
						<div class="flex gap-6 text-sm">
							<div class="flex items-center gap-2">
								<span class="text-accent">Effort:</span>
								<span class="text-lg font-bold text-accent">
									{data.previousRatings.effortScore !== null
										? data.previousRatings.effortScore
										: '—'}
								</span>
							</div>
							<div class="flex items-center gap-2">
								<span class="text-accent">Performance:</span>
								<span class="text-lg font-bold text-accent">
									{data.previousRatings.performanceScore !== null
										? data.previousRatings.performanceScore
										: '—'}
								</span>
							</div>
						</div>
						<p class="mt-2 text-xs text-accent">
							Use this as context - adjust freely based on this week.
						</p>
						{#if historicRatings.length > 1}
							<div class="mt-4">
								<HistoricRatingsChart {historicRatings} />
							</div>
						{/if}
					</div>
				{/if}
				<!-- Effort Score with Enhanced UI -->
				<div
					class="group rounded-2xl border border-border-default bg-surface-raised p-6 transition-all hover:border-border-strong"
				>
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<Dumbbell class="h-6 w-6 text-accent" />
							<div>
								<label for="effort-score" class="text-lg font-bold text-text-primary">
									Effort
									{#if data.previousRatings?.effortScore !== null && data.previousRatings?.effortScore !== undefined}
										<span class="ml-1 text-sm font-normal text-text-muted"
											>(last: {data.previousRatings.effortScore})</span
										>
									{/if}
								</label>
								<p class="text-xs text-text-tertiary">
									How much attention did you give to your goal this week?
								</p>
							</div>
						</div>
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all {effortScore !==
							null
								? getScoreBgColor(effortScore, 'effort')
								: 'border-border-default bg-surface-subtle'}"
							aria-valuetext={effortScore !== null
								? `Effort score: ${effortScore} out of 10`
								: 'No score selected'}
						>
							<span
								class="text-2xl font-bold {effortScore !== null
									? getScoreColor(effortScore, 'effort')
									: 'text-text-muted'}">{effortScore !== null ? effortScore : '—'}</span
							>
						</div>
					</div>

					<!-- Button Grid (Primary Input) -->
					<div
						class="mb-4 grid grid-cols-6 gap-2 sm:grid-cols-11"
						role="radiogroup"
						aria-label="Effort score selection"
					>
						{#each Array.from({ length: 11 }, (_, i) => i) as i (i)}
							{@const isSelected = effortScore === i}
							{@const buttonColors = getButtonSelectedColors(i, 'effort')}
							{@const hoverColors = getButtonHoverColors(i, 'effort')}
							{@const focusRing = getFocusRing(i, 'effort')}
							<button
								type="button"
								onclick={() => (effortScore = i)}
								disabled={!data.isAvailable || data.isLocked}
								role="radio"
								aria-checked={isSelected}
								aria-label="Effort score {i} out of 10"
								class="flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 {isSelected
									? buttonColors + ' anim-pop shadow-md'
									: 'border-border-default bg-surface-raised text-text-secondary ' +
										hoverColors} focus-visible:ring-2 focus-visible:outline-none {focusRing} focus-visible:ring-offset-2"
							>
								{i}
							</button>
						{/each}
					</div>

					<div class="text-2xs flex items-center justify-between text-text-muted">
						<span>Not at all</span>
						<span>Moderately</span>
						<span>Exceptionally</span>
					</div>
					{#if data.previousRatings?.effortScore != null}
						<button
							type="button"
							onclick={() => (effortScore = data.previousRatings!.effortScore!)}
							disabled={!data.isAvailable || data.isLocked}
							class="mt-2 min-h-[44px] rounded-full border border-accent/30 bg-accent-muted px-4 py-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
						>
							Same as last week: {data.previousRatings.effortScore}
						</button>
					{/if}
				</div>

				<!-- Progress Score with Enhanced UI -->
				<div
					class="group rounded-2xl border border-border-default bg-surface-raised p-6 transition-all hover:border-border-strong"
				>
					<div class="mb-4 flex items-center justify-between">
						<div class="flex items-center gap-3">
							<TrendingUp class="h-6 w-6 text-accent" />
							<div>
								<label for="progress-score" class="text-lg font-bold text-text-primary">
									Performance
									{#if data.previousRatings?.performanceScore !== null && data.previousRatings?.performanceScore !== undefined}
										<span class="ml-1 text-sm font-normal text-text-muted"
											>(last: {data.previousRatings.performanceScore})</span
										>
									{/if}
								</label>
								<p class="text-xs text-text-tertiary">
									How effective was your performance related to your goal this week?
								</p>
							</div>
						</div>
						<div
							class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all {performanceScore !==
							null
								? getScoreBgColor(performanceScore, 'performance')
								: 'border-border-default bg-surface-subtle'}"
							aria-valuetext={performanceScore !== null
								? `Performance score: ${performanceScore} out of 10`
								: 'No score selected'}
						>
							<span
								class="text-2xl font-bold {performanceScore !== null
									? getScoreColor(performanceScore, 'performance')
									: 'text-text-muted'}">{performanceScore !== null ? performanceScore : '—'}</span
							>
						</div>
					</div>

					<!-- Button Grid (Primary Input) -->
					<div
						class="mb-4 grid grid-cols-6 gap-2 sm:grid-cols-11"
						role="radiogroup"
						aria-label="Performance score selection"
					>
						{#each Array.from({ length: 11 }, (_, i) => i) as i (i)}
							{@const isSelected = performanceScore === i}
							{@const buttonColors = getButtonSelectedColors(i, 'performance')}
							{@const hoverColors = getButtonHoverColors(i, 'performance')}
							{@const focusRing = getFocusRing(i, 'performance')}
							<button
								type="button"
								onclick={() => (performanceScore = i)}
								disabled={!data.isAvailable || data.isLocked}
								role="radio"
								aria-checked={isSelected}
								aria-label="Performance score {i} out of 10"
								class="flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 {isSelected
									? buttonColors + ' anim-pop shadow-md'
									: 'border-border-default bg-surface-raised text-text-secondary ' +
										hoverColors} focus-visible:ring-2 focus-visible:outline-none {focusRing} focus-visible:ring-offset-2"
							>
								{i}
							</button>
						{/each}
					</div>

					<div class="text-2xs flex items-center justify-between text-text-muted">
						<span>Not at all</span>
						<span>Moderately</span>
						<span>Exceptionally</span>
					</div>
					{#if data.previousRatings?.performanceScore != null}
						<button
							type="button"
							onclick={() => (performanceScore = data.previousRatings!.performanceScore!)}
							disabled={!data.isAvailable || data.isLocked}
							class="mt-2 min-h-[44px] rounded-full border border-accent/30 bg-accent-muted px-4 py-2.5 text-xs font-medium text-accent transition-colors hover:bg-accent/20 disabled:opacity-60"
						>
							Same as last week: {data.previousRatings.performanceScore}
						</button>
					{/if}
				</div>

				<!-- Notes (collapsed by default) -->
				{#if showNotes}
					<div
						class="rounded-2xl border border-border-default bg-surface-raised p-6 transition-all hover:border-accent/30"
					>
						<div class="mb-3 flex items-center gap-2">
							<PenLine class="h-5 w-5 text-accent" />
							<label for="notes" class="text-base font-semibold text-text-primary">
								{data.isMidpoint && data.identityAnchor
									? 'Midpoint CheckIn'
									: 'Reflect on your week'}
							</label>
						</div>
						<textarea
							name="notes"
							id="notes"
							rows="3"
							maxlength="500"
							bind:value={notes}
							disabled={!data.isAvailable || data.isLocked}
							class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
							placeholder={notePrompt}
						></textarea>
						<div class="mt-2 flex items-center justify-between">
							<p class="text-xs text-text-tertiary">Only you and your coach can see this.</p>
							<p class="shrink-0 text-right text-xs text-text-muted">{notes.length}/500</p>
						</div>
					</div>
				{:else}
					<button
						type="button"
						onclick={() => (showNotes = true)}
						class="flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-border-default py-3 text-sm font-medium text-text-muted transition-colors hover:border-accent/30 hover:text-accent"
					>
						<PenLine class="h-4 w-4" />
						Add a note (optional)
					</button>
				{/if}

				<!-- Submit Button with Enhanced Design -->
				<div
					class="flex flex-col gap-4 rounded-2xl border border-border-default bg-accent-muted p-6 sm:flex-row sm:items-center sm:justify-between"
				>
					<div class="flex-1">
						{#if data.isLocked || data.previousEntry}
							<p class="font-semibold text-text-primary">Viewing completed check-in</p>
							<p class="mt-1 text-xs text-text-secondary">
								This check-in has been completed and can no longer be edited.
							</p>
						{:else}
							<p class="font-semibold text-text-primary">Ready to save your check-in?</p>
							<p class="mt-1 text-xs text-text-secondary">
								Your scores and notes feed AI-generated weekly insights, help your coach prepare for
								sessions, and reveal patterns over time.
							</p>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href="/individual/today"
							class="rounded-xl border border-border-default bg-surface-raised px-6 py-3.5 text-sm font-semibold text-text-secondary transition-all hover:border-border-strong hover:bg-surface-subtle"
						>
							Cancel
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						<button
							type="submit"
							bind:this={submitBtnEl}
							disabled={!data.isAvailable || data.isLocked || isSubmitting || !bothScoresSelected}
							title={data.isLocked
								? 'Check-in already submitted'
								: !data.isAvailable
									? 'This check-in is not yet available'
									: !bothScoresSelected
										? 'Select both scores to submit'
										: isSubmitting
											? 'Submitting...'
											: undefined}
							class="group relative overflow-hidden rounded-xl bg-accent px-8 py-3.5 font-semibold text-white shadow-lg transition-all hover:bg-accent-hover hover:shadow-xl focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
						>
							<span class="relative z-10 flex items-center gap-2">
								{#if isSubmitting}
									<span
										class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
									></span>
									Saving...
								{:else}
									<Send class="h-4 w-4" />
									Save Check-in
								{/if}
							</span>
							<div
								class="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 opacity-0 transition-opacity group-hover:opacity-100"
							></div>
						</button>
					</div>
				</div>
			</form>
		{/if}
	</div>
</section>

<style>
	@keyframes fade-in {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slide-in-from-top-2 {
		from {
			transform: translateY(-0.5rem);
		}
		to {
			transform: translateY(0);
		}
	}

	.animate-in {
		animation:
			fade-in 0.3s ease-out,
			slide-in-from-top-2 0.3s ease-out;
	}
</style>
