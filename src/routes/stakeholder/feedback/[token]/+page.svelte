<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import {
		getScoreColor,
		getScoreBgColor,
		getButtonSelectedColors,
		getButtonHoverColors,
		getFocusRing,
		getScoreLabel
	} from '$lib/utils/scoreColors';
	import InfoTip from '$lib/components/InfoTip.svelte';

	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import {
		Eye,
		Gift,
		AlertTriangle,
		Hand,
		Dumbbell,
		TrendingUp,
		PenLine,
		CircleCheck,
		Target,
		Send,
		Shield,
		Lightbulb
	} from 'lucide-svelte';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	const DRAFT_KEY = `feedback-draft-${data.token}`;
	const DRAFT_MAX_AGE_MS = 4 * 60 * 60 * 1000; // 4 hours

	let showWelcome = $state(data.isFirstFeedback);
	let draftRestored = $state(false);

	let effortScore = $state<number | null>(data.previousRatings?.effortScore ?? null);
	let performanceScore = $state<number | null>(data.previousRatings?.performanceScore ?? null);
	let notes = $state('');
	let behavioralObservation = $state('');
	let suggestion = $state('');
	let showComment = $state(false);
	let showStructured = $state(false);
	let showPrivacyDetails = $state(false);
	let isSubmitting = $state(false);
	let showReveal = $state(false);
	let scoresRequired = $state(false);
	let reviewerScores = $state<{
		effortScore: number | null;
		performanceScore: number | null;
	} | null>(null);
	let previewIndividualScores = $state<{
		effortScore: number | null;
		performanceScore: number | null;
		checkInCount: number;
		participantName: string;
	} | null>(null);

	const hasAtLeastOneScore = $derived(effortScore !== null || performanceScore !== null);
	const contributionCount = $derived((data.historicRatings?.length ?? 0) + 1);

	const enhanceSubmit = ({ cancel }: { cancel: () => void }) => {
		if (!hasAtLeastOneScore && !notes.trim()) {
			cancel();
			scoresRequired = true;
			return;
		}
		scoresRequired = false;
		isSubmitting = true;
		reviewerScores = { effortScore, performanceScore };
		return async ({ update }: { update: () => Promise<void> }) => {
			isSubmitting = false;
			await update();
		};
	};

	// Arrow key navigation for radiogroup (roving tabindex pattern)
	function handleRadiogroupKeydown(e: KeyboardEvent, dimension: 'effort' | 'performance') {
		if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
		e.preventDefault();
		const current = dimension === 'effort' ? effortScore : performanceScore;
		let next: number;
		if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
			next = current === null ? 0 : Math.min(current + 1, 10);
		} else {
			next = current === null ? 10 : Math.max(current - 1, 0);
		}
		if (dimension === 'effort') effortScore = next;
		else performanceScore = next;
		// Focus the newly selected button
		const container = e.currentTarget as HTMLElement;
		const buttons = container.querySelectorAll<HTMLButtonElement>('[role="radio"]');
		buttons[next]?.focus();
	}

	// Clear validation error when user selects a score or types notes
	$effect(() => {
		if (effortScore !== null || performanceScore !== null || notes.trim()) {
			scoresRequired = false;
		}
	});

	// Reset isSubmitting on form response (success or error)
	$effect(() => {
		if (form) {
			isSubmitting = false;
		}
	});

	// Simulate reveal for preview mode
	const simulateReveal = () => {
		reviewerScores = { effortScore: effortScore ?? 0, performanceScore: performanceScore ?? 0 };
		previewIndividualScores = {
			effortScore: 7,
			performanceScore: 6,
			checkInCount: 1,
			participantName: data.invite.participantName
		};
		setTimeout(() => {
			showReveal = true;
		}, 500);
	};

	// Get individual scores from either form response or preview data
	const individualScores = $derived(form?.individualScores ?? previewIndividualScores);
	const participantName = $derived(
		individualScores?.participantName ?? data.invite.participantName
	);

	// Show reveal when form is successfully submitted (only if reveal is enabled)
	$effect(() => {
		if (form?.success && form?.individualScores) {
			// Small delay for better UX
			const timer = setTimeout(() => {
				showReveal = true;
			}, 500);
			return () => clearTimeout(timer);
		}
	});

	// Clear draft on successful submission
	$effect(() => {
		if (form?.success) {
			try {
				localStorage.removeItem(DRAFT_KEY);
			} catch {
				/* expected */
			}
		}
	});

	// Restore draft from localStorage on mount
	onMount(() => {
		if (data.isPreview) return;
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw) {
				const draft = JSON.parse(raw);
				if (draft.savedAt && Date.now() - draft.savedAt < DRAFT_MAX_AGE_MS) {
					if (typeof draft.effortScore === 'number') effortScore = draft.effortScore;
					if (typeof draft.performanceScore === 'number') performanceScore = draft.performanceScore;
					if (typeof draft.notes === 'string') notes = draft.notes;
					if (typeof draft.behavioralObservation === 'string')
						behavioralObservation = draft.behavioralObservation;
					if (typeof draft.suggestion === 'string') suggestion = draft.suggestion;
					if (notes) showComment = true;
					if (behavioralObservation || suggestion) showStructured = true;
					draftRestored = true;
					setTimeout(() => {
						draftRestored = false;
					}, 3000);
				} else {
					localStorage.removeItem(DRAFT_KEY);
				}
			}
		} catch {
			/* expected */
		}
	});

	// Auto-save draft to localStorage (debounced)
	$effect(() => {
		// Track reactive dependencies
		const e = effortScore;
		const p = performanceScore;
		const n = notes;
		const bo = behavioralObservation;
		const su = suggestion;

		if (data.isPreview) return;
		const timeout = setTimeout(() => {
			try {
				localStorage.setItem(
					DRAFT_KEY,
					JSON.stringify({
						effortScore: e,
						performanceScore: p,
						notes: n,
						behavioralObservation: bo,
						suggestion: su,
						savedAt: Date.now()
					})
				);
			} catch {
				/* expected */
			}
		}, 1000);
		return () => clearTimeout(timeout);
	});
</script>

<svelte:document
	onkeydown={(e) => {
		if (e.key === 'Escape' && showWelcome) showWelcome = false;
	}}
/>

<svelte:head>
	<title>Feedback for {data.invite.participantName} | Forbetra</title>
</svelte:head>

{#if data.isAlreadySubmitted || form?.alreadySubmitted}
	<div class="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
		<div class="max-w-md rounded-xl border border-border-default bg-surface-raised p-8 shadow-lg">
			<div
				class="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-success-muted"
			>
				<svg
					class="h-6 w-6 text-success"
					fill="none"
					viewBox="0 0 24 24"
					stroke="currentColor"
					stroke-width="2"
				>
					<path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
				</svg>
			</div>
			<span
				class="mb-3 inline-block rounded-full bg-accent-muted px-3 py-1 text-xs font-semibold text-accent"
			>
				Week {data.invite.weekNumber} Check-in
			</span>
			<h1 class="mb-2 text-xl font-bold text-text-primary">
				You've already shared your perspective
			</h1>
			<p class="text-sm text-text-secondary">
				You've already submitted your feedback for {data.invite?.participantName ?? 'this person'} this
				week. Thank you!
			</p>
			<div class="mt-3 rounded-lg bg-surface-subtle px-4 py-3">
				<p class="text-xs font-semibold text-accent">
					Contribution #{contributionCount}
				</p>
				<p class="mt-1 text-xs text-text-secondary">
					{#if contributionCount >= 4}
						Your consistent feedback is building a detailed picture — that's exactly what drives
						real growth.
					{:else if contributionCount >= 2}
						You've contributed {contributionCount} times — that consistency makes a real difference.
					{:else}
						Your first contribution is in — every data point helps {data.invite?.participantName ??
							'them'} see what they can't see alone.
					{/if}
				</p>
			</div>
			<div class="mt-3 rounded-lg border border-border-default bg-surface-subtle px-4 py-3">
				<p class="text-xs text-text-secondary">
					We'll send another link when they ask for feedback again.
				</p>
			</div>
			<p class="text-2xs mt-3 text-text-tertiary">
				Need to change your response? Ask {data.invite?.participantName ??
					'the person who invited you'} to request a new link for you.
			</p>
		</div>
	</div>
{:else}
	<section class="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 p-4 pb-12">
		<!-- Forbetra brand header -->
		<div class="pt-2 pb-1 text-center">
			<p
				class="flex items-center justify-center gap-1.5 text-lg font-bold tracking-[0.02em] text-text-primary italic"
			>
				<Shield class="h-5 w-5 text-accent" />
				forbetra
			</p>
			<p class="text-xs text-text-tertiary">You. And Improved.</p>
		</div>

		{#if data.isPreview}
			<div
				class="fixed top-4 right-4 z-50 max-w-xs rounded-lg border border-accent/30 bg-accent-muted p-3 text-xs text-accent"
			>
				<p class="font-semibold"><Eye class="inline h-4 w-4" /> Preview Mode</p>
				<p class="mt-1 text-xs">Submissions are disabled.</p>
				{#if !showReveal}
					<button
						type="button"
						onclick={simulateReveal}
						class="mt-2 w-full rounded-md bg-accent px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-accent-hover"
					>
						<Gift class="inline h-4 w-4" /> Preview Reveal
					</button>
				{/if}
			</div>
		{/if}
		{#if draftRestored}
			<div
				class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-success-muted bg-success-muted px-4 py-2 text-sm font-medium text-success transition-opacity"
			>
				Draft restored
			</div>
		{/if}
		<header class="space-y-3 text-center">
			<div class="flex items-center justify-center gap-2">
				<div
					class="inline-flex items-center gap-2 rounded-full bg-accent-muted px-4 py-1.5 text-xs font-medium text-accent"
				>
					<span class="h-2 w-2 rounded-full bg-accent"></span>
					Week {data.invite.weekNumber} Check-in
				</div>
				{#if !data.isFirstFeedback && data.historicRatings && data.historicRatings.length > 0}
					<span
						class="text-2xs rounded-full bg-success-muted px-3 py-1.5 font-semibold text-success"
					>
						Contribution #{data.historicRatings.length + 1}
					</span>
				{/if}
			</div>
			<h1 class="text-3xl font-bold text-text-primary">
				Help {data.invite.participantName} see what you see.
			</h1>
			<p class="text-base text-text-secondary">This takes about 60 seconds.</p>
		</header>

		<div aria-live="polite">
			{#if form?.error}
				<div
					class="mx-auto max-w-2xl rounded-xl border border-error-muted bg-error-muted p-4 text-sm text-error"
				>
					<p class="font-medium"><AlertTriangle class="inline h-4 w-4" /> {form.error}</p>
					{#if 'expired' in form && form.expired}
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a href="/stakeholder/invalid" class="mt-2 inline-block font-semibold underline">
							Request a new link
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
					{/if}
				</div>
			{/if}
		</div>

		{#if showWelcome && !form?.success}
			<div class="mx-auto max-w-2xl space-y-6" role="region" aria-label="Welcome and instructions">
				<div class="rounded-2xl border border-accent/30 bg-surface-base p-8">
					<div class="mb-5 text-center">
						<div
							class="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent"
						>
							<Hand class="h-7 w-7 text-white" />
						</div>
						<h2 class="text-2xl font-bold text-text-primary">Welcome, {data.reviewer.name}</h2>
						<p class="mt-2 text-base text-text-secondary">
							<strong>{data.invite.participantName}</strong> is working on their growth and values your
							honest perspective. What takes you 60 seconds gives them insights they can't get any other
							way.
						</p>
					</div>

					<div class="mb-5 rounded-xl border border-accent/30 bg-surface-raised p-4">
						<p class="mb-1 text-xs font-semibold tracking-wide text-accent uppercase">Their goal</p>
						<p class="text-base font-bold text-text-primary">{data.invite.goalTitle}</p>
					</div>

					<div class="mb-5 rounded-lg border border-border-default bg-surface-raised p-4">
						<p class="mb-2 text-xs font-semibold tracking-wide text-text-primary uppercase">
							Three quick steps
						</p>
						<ul class="space-y-1.5 text-sm text-text-secondary">
							<li class="flex items-center gap-2">
								<Dumbbell class="h-4 w-4 shrink-0 text-accent" />
								Rate their <strong>effort</strong> — how much energy are they investing?
							</li>
							<li class="flex items-center gap-2">
								<TrendingUp class="h-4 w-4 shrink-0 text-accent" />
								Rate their <strong>performance</strong> — what results are you seeing?
							</li>
							<li class="flex items-center gap-2">
								<PenLine class="h-4 w-4 shrink-0 text-accent" />
								Add a quick note if anything stands out
							</li>
						</ul>
					</div>

					<div class="mb-5 space-y-2">
						<div class="flex items-center gap-2 text-xs text-text-muted">
							<Shield class="h-3.5 w-3.5 shrink-0" />
							<span
								>Your feedback goes to {data.invite.participantName} and their coach. No anonymous aggregation
								— your name is attached, which keeps feedback honest and actionable.</span
							>
						</div>
						<p class="text-2xs text-center text-text-muted">
							Powered by <strong class="text-text-secondary">Forbetra</strong> — a coaching platform that
							turns 360 feedback into measurable growth.
						</p>
					</div>

					<div class="flex flex-col items-center gap-2">
						<button
							type="button"
							onclick={() => {
								showWelcome = false;
							}}
							class="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition-all hover:bg-accent-hover"
						>
							Rate now &middot; ~60 sec
							<span>&#8594;</span>
						</button>
						<button
							type="button"
							onclick={() => {
								showWelcome = false;
							}}
							class="text-xs text-text-muted underline decoration-dotted underline-offset-4 transition-colors hover:text-text-secondary"
						>
							Skip intro
						</button>
					</div>
				</div>
			</div>
		{:else if form?.success || (data.isPreview && showReveal)}
			<div class="mx-auto max-w-2xl space-y-6">
				<!-- Initial Success Message -->
				<div
					aria-live="polite"
					class="animate-in fade-in slide-in-from-top-2 rounded-xl border border-success-muted bg-success-muted p-6 text-center"
				>
					<div
						class="success-pulse mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-success/20"
					>
						<CircleCheck class="h-8 w-8 text-success" />
					</div>
					<p class="text-lg font-semibold text-success">
						Thank you, {data.reviewer.name}!
					</p>
					<p class="mt-1 text-sm text-success">Your perspective matters more than you know.</p>
					<p class="mt-2 text-xs text-text-secondary">
						Your ratings are combined with {data.invite.participantName}'s self-assessment to reveal
						perception gaps — the blind spots that drive real growth.
					</p>
					{#if data.historicRatings && data.historicRatings.length > 0}
						<p class="mt-2 text-xs text-success/80">
							Contribution #{data.historicRatings.length + 1} on this journey — your consistency amplifies
							impact.
						</p>
					{/if}
				</div>

				<!-- What happens with your feedback -->
				<div class="rounded-xl border border-border-default bg-surface-raised p-5">
					<p class="mb-3 text-sm font-semibold text-text-primary">
						What happens with your feedback
					</p>
					<div class="space-y-2.5">
						<div class="flex items-start gap-2.5 text-xs text-text-secondary">
							<span
								class="text-2xs mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white"
								>1</span
							>
							<span
								>Your scores are compared with {data.invite.participantName}'s self-rating to
								surface blind spots</span
							>
						</div>
						<div class="flex items-start gap-2.5 text-xs text-text-secondary">
							<span
								class="text-2xs mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/70 font-bold text-white"
								>2</span
							>
							<span>Their coach uses the gap to guide more targeted coaching conversations</span>
						</div>
						<div class="flex items-start gap-2.5 text-xs text-text-secondary">
							<span
								class="text-2xs mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/50 font-bold text-white"
								>3</span
							>
							<span
								>Over weeks, your ongoing perspective helps track whether real change is happening</span
							>
						</div>
					</div>
				</div>

				<!-- Reveal Section -->
				{#if showReveal && individualScores}
					<div
						class="rounded-2xl border border-accent/30 bg-surface-base p-8"
						transition:fly={{ y: 16, duration: 400 }}
					>
						<div class="mb-6 text-center">
							<Gift class="mx-auto mb-3 h-12 w-12 text-accent" />
							<h2 class="text-2xl font-bold text-text-primary">
								Here's what {participantName} rated themselves in Week {data.invite.weekNumber}:
							</h2>
							<p class="mt-2 text-sm text-text-secondary">
								{#if individualScores.checkInCount > 1}
									Average of their {individualScores.checkInCount} check-ins this week, compared with
									your perspective on their goal
								{:else}
									Compare your perspective with their self-assessment on their goal
								{/if}
							</p>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<!-- Effort Comparison -->
							<div class="rounded-xl border border-border-default bg-surface-raised p-6">
								<div class="mb-4 flex items-center justify-between">
									<div>
										<p class="text-sm font-semibold text-text-secondary">Effort</p>
										<p class="mt-1 text-xs text-text-tertiary">How much energy invested</p>
									</div>
								</div>
								<div class="space-y-3">
									<div
										class="flex items-center justify-between rounded-lg border border-border-default bg-surface-subtle px-4 py-3"
									>
										<span class="text-sm font-medium text-text-secondary">Your rating:</span>
										<div class="flex items-center gap-2">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full border-2 {getScoreBgColor(
													reviewerScores?.effortScore ?? 0,
													'effort'
												)}"
											>
												<span
													class="text-lg font-bold {getScoreColor(
														reviewerScores?.effortScore ?? 0,
														'effort'
													)}"
												>
													{reviewerScores?.effortScore ?? '—'}
												</span>
											</div>
										</div>
									</div>
									{#if data.previousRatings?.effortScore !== null && data.previousRatings?.effortScore !== undefined && reviewerScores?.effortScore !== null && reviewerScores?.effortScore !== undefined}
										{@const effortDelta =
											reviewerScores.effortScore - data.previousRatings.effortScore}
										<p class="text-xs text-text-tertiary">
											Last time you rated effort {data.previousRatings.effortScore} —
											{#if effortDelta > 0}
												<span class="text-success"
													>up {effortDelta} point{effortDelta !== 1 ? 's' : ''} this week.</span
												>
											{:else if effortDelta < 0}
												<span class="text-warning"
													>down {Math.abs(effortDelta)} point{Math.abs(effortDelta) !== 1
														? 's'
														: ''} this week.</span
												>
											{:else}
												same as this week.
											{/if}
										</p>
									{/if}
									<div
										class="flex items-center justify-between rounded-lg border-2 border-accent/30 bg-accent-muted px-4 py-3"
									>
										<span class="text-sm font-medium text-text-secondary"
											>{participantName}'s rating:</span
										>
										<div class="flex items-center gap-2">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full border-2 {getScoreBgColor(
													individualScores?.effortScore ?? 0,
													'effort'
												)}"
											>
												<span
													class="text-lg font-bold {getScoreColor(
														individualScores?.effortScore ?? 0,
														'effort'
													)}"
												>
													{individualScores?.effortScore ?? '—'}
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>

							<!-- Performance Comparison -->
							<div class="rounded-xl border border-border-default bg-surface-raised p-6">
								<div class="mb-4 flex items-center justify-between">
									<div>
										<p class="text-sm font-semibold text-text-secondary">Performance</p>
										<p class="mt-1 text-xs text-text-tertiary">Satisfaction with progress</p>
									</div>
								</div>
								<div class="space-y-3">
									<div
										class="flex items-center justify-between rounded-lg border border-border-default bg-surface-subtle px-4 py-3"
									>
										<span class="text-sm font-medium text-text-secondary">Your rating:</span>
										<div class="flex items-center gap-2">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full border-2 {getScoreBgColor(
													reviewerScores?.performanceScore ?? 0,
													'performance'
												)}"
											>
												<span
													class="text-lg font-bold {getScoreColor(
														reviewerScores?.performanceScore ?? 0,
														'performance'
													)}"
												>
													{reviewerScores?.performanceScore ?? '—'}
												</span>
											</div>
										</div>
									</div>
									{#if data.previousRatings?.performanceScore !== null && data.previousRatings?.performanceScore !== undefined && reviewerScores?.performanceScore !== null && reviewerScores?.performanceScore !== undefined}
										{@const perfDelta =
											reviewerScores.performanceScore - data.previousRatings.performanceScore}
										<p class="text-xs text-text-tertiary">
											Last time you rated performance {data.previousRatings.performanceScore} —
											{#if perfDelta > 0}
												<span class="text-success"
													>up {perfDelta} point{perfDelta !== 1 ? 's' : ''} this week.</span
												>
											{:else if perfDelta < 0}
												<span class="text-warning"
													>down {Math.abs(perfDelta)} point{Math.abs(perfDelta) !== 1 ? 's' : ''} this
													week.</span
												>
											{:else}
												same as this week.
											{/if}
										</p>
									{/if}
									<div
										class="flex items-center justify-between rounded-lg border-2 border-accent/30 bg-accent-muted px-4 py-3"
									>
										<span class="text-sm font-medium text-text-secondary"
											>{participantName}'s rating:</span
										>
										<div class="flex items-center gap-2">
											<div
												class="flex h-10 w-10 items-center justify-center rounded-full border-2 {getScoreBgColor(
													individualScores?.performanceScore ?? 0,
													'performance'
												)}"
											>
												<span
													class="text-lg font-bold {getScoreColor(
														individualScores?.performanceScore ?? 0,
														'performance'
													)}"
												>
													{individualScores?.performanceScore ?? '—'}
												</span>
											</div>
										</div>
									</div>
								</div>
							</div>
						</div>
					</div>
				{:else}
					<!-- Non-reveal value message with score echo -->
					<div class="rounded-xl border border-accent/20 bg-accent-muted/50 px-5 py-4">
						<p class="text-center text-sm font-semibold text-accent">
							Your perspective is shaping real change
						</p>
						{#if reviewerScores}
							<div class="mt-3 flex justify-center gap-6">
								{#if reviewerScores.effortScore !== null}
									<div class="text-center">
										<p class="text-2xs font-medium tracking-wider text-text-muted uppercase">
											Effort
										</p>
										<p
											class="text-lg font-bold {getScoreColor(
												reviewerScores.effortScore ?? 0,
												'effort'
											)}"
										>
											{reviewerScores.effortScore}/10
										</p>
									</div>
								{/if}
								{#if reviewerScores.performanceScore !== null}
									<div class="text-center">
										<p class="text-2xs font-medium tracking-wider text-text-muted uppercase">
											Performance
										</p>
										<p
											class="text-lg font-bold {getScoreColor(
												reviewerScores.performanceScore ?? 0,
												'performance'
											)}"
										>
											{reviewerScores.performanceScore}/10
										</p>
									</div>
								{/if}
							</div>
						{/if}
						{#if form?.success && !individualScores}
							<p class="mt-3 text-center text-xs text-text-secondary">
								{data.invite.participantName} hasn't logged a Week {data.invite.weekNumber} check-in yet,
								so there's no self-rating to compare against.
							</p>
						{/if}
						<p class="mt-3 text-center text-xs text-text-secondary">
							Your ratings have been shared with {data.invite.participantName}'s coach and are
							already informing their next session.
						</p>
					</div>
				{/if}

				<!-- Forward path — personalized based on submission context -->
				<div
					class="rounded-xl border border-border-default bg-surface-subtle px-5 py-4 text-center"
				>
					{#if data.previousRatings && (data.previousRatings.effortScore !== null || data.previousRatings.performanceScore !== null) && reviewerScores}
						{@const effortDelta =
							reviewerScores.effortScore !== null && data.previousRatings.effortScore !== null
								? reviewerScores.effortScore - data.previousRatings.effortScore
								: null}
						{@const perfDelta =
							reviewerScores.performanceScore !== null &&
							data.previousRatings.performanceScore !== null
								? reviewerScores.performanceScore - data.previousRatings.performanceScore
								: null}
						{@const anyHigher =
							(effortDelta !== null && effortDelta > 0) || (perfDelta !== null && perfDelta > 0)}
						<p class="text-sm font-medium text-text-primary">Your observation is already working</p>
						<p class="mt-1 text-xs text-text-secondary">
							{#if anyHigher}
								You rated {effortDelta !== null && effortDelta > 0 ? 'effort' : 'performance'} higher
								this week — that kind of observation is exactly what helps {data.invite
									.participantName}'s coach spot real momentum.
							{:else}
								Your consistent perspective helps {data.invite.participantName}'s coach track what's
								actually shifting over time.
							{/if}
						</p>
					{:else}
						<p class="text-sm font-medium text-text-primary">Your first rating is in</p>
						<p class="mt-1 text-xs text-text-secondary">
							{data.invite.participantName}'s coach will use this in their next session. You'll get
							another link when they ask for feedback again.
						</p>
					{/if}
				</div>
			</div>
		{/if}

		{#if !form?.success && !(data.isPreview && showReveal) && !showWelcome}
			<div class="mx-auto w-full max-w-2xl space-y-6">
				<!-- About Forbetra (context for first-time reviewers) -->
				{#if data.isFirstFeedback}
					<div class="rounded-xl border border-accent/20 bg-accent/5 px-5 py-4">
						<p class="text-sm font-semibold text-text-primary">About Forbetra</p>
						<p class="mt-1 text-sm leading-relaxed text-text-secondary">
							Forbetra is a coaching platform that combines weekly self-reflection with 360-degree
							feedback from people like you.
							{data.invite.participantName} is working on a professional development goal and has asked
							for your honest perspective. Your ratings help reveal blind spots between self-perception
							and outside observation — the kind of insight that drives real growth.
						</p>
					</div>
				{/if}

				<!-- Returning reviewer welcome-back + impact summary -->
				{#if !data.isFirstFeedback && data.historicRatings && data.historicRatings.length > 0}
					{@const avgEffort =
						data.historicRatings.filter((r) => r.effortScore !== null).length > 0
							? Math.round(
									(data.historicRatings
										.filter((r) => r.effortScore !== null)
										.reduce((sum, r) => sum + (r.effortScore ?? 0), 0) /
										data.historicRatings.filter((r) => r.effortScore !== null).length) *
										10
								) / 10
							: null}
					{@const avgPerf =
						data.historicRatings.filter((r) => r.performanceScore !== null).length > 0
							? Math.round(
									(data.historicRatings
										.filter((r) => r.performanceScore !== null)
										.reduce((sum, r) => sum + (r.performanceScore ?? 0), 0) /
										data.historicRatings.filter((r) => r.performanceScore !== null).length) *
										10
								) / 10
							: null}
					{@const firstEffort =
						data.historicRatings.find((r) => r.effortScore !== null)?.effortScore ?? null}
					{@const lastEffort =
						[...data.historicRatings].reverse().find((r) => r.effortScore !== null)?.effortScore ??
						null}
					{@const firstPerf =
						data.historicRatings.find((r) => r.performanceScore !== null)?.performanceScore ?? null}
					{@const lastPerf =
						[...data.historicRatings].reverse().find((r) => r.performanceScore !== null)
							?.performanceScore ?? null}
					{@const effortTrend =
						firstEffort !== null && lastEffort !== null && data.historicRatings.length >= 2
							? lastEffort - firstEffort
							: null}
					{@const perfTrend =
						firstPerf !== null && lastPerf !== null && data.historicRatings.length >= 2
							? lastPerf - firstPerf
							: null}
					<div
						class="rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-transparent p-4"
					>
						<p class="text-sm font-semibold text-text-primary">
							Welcome back, {data.reviewer.name}
						</p>
						<p class="mt-0.5 mb-2 text-xs text-text-secondary">
							Your impact on {data.invite.participantName}'s journey so far:
						</p>
						<div class="flex flex-wrap items-center gap-x-5 gap-y-2">
							<div class="flex items-center gap-1.5">
								<span
									class="text-2xs flex h-6 w-6 items-center justify-center rounded-full bg-accent/20 font-bold text-accent"
								>
									{data.historicRatings.length}
								</span>
								<span class="text-xs text-text-secondary"
									>week{data.historicRatings.length !== 1 ? 's' : ''} of feedback</span
								>
							</div>
							{#if avgEffort !== null}
								<div class="flex items-center gap-1.5">
									<span class="flex items-center gap-1 text-xs text-text-muted">
										Effort:
										<InfoTip
											text="How much energy they are investing. 0 is none, 10 is exceptional."
										/>
									</span>
									<span class="text-xs font-bold {getScoreColor(avgEffort, 'effort')}"
										>{avgEffort}/10</span
									>
									{#if effortTrend !== null && effortTrend !== 0}
										<span class="text-2xs {effortTrend > 0 ? 'text-success' : 'text-warning'}"
											>{effortTrend > 0 ? '↑' : '↓'}</span
										>
									{/if}
								</div>
							{/if}
							{#if avgPerf !== null}
								<div class="flex items-center gap-1.5">
									<span class="flex items-center gap-1 text-xs text-text-muted">
										Performance:
										<InfoTip text="What results you can see. 0 is none, 10 is exceptional." />
									</span>
									<span class="text-xs font-bold {getScoreColor(avgPerf, 'performance')}"
										>{avgPerf}/10</span
									>
									{#if perfTrend !== null && perfTrend !== 0}
										<span class="text-2xs {perfTrend > 0 ? 'text-success' : 'text-warning'}"
											>{perfTrend > 0 ? '↑' : '↓'}</span
										>
									{/if}
								</div>
							{/if}
						</div>
						{#if (effortTrend !== null && effortTrend > 0) || (perfTrend !== null && perfTrend > 0)}
							<p class="text-2xs mt-2 text-success">
								Your feedback is part of {data.invite.participantName}'s upward trajectory — they're
								growing, and your perspective is helping.
							</p>
						{:else}
							<p class="text-2xs mt-2 text-text-tertiary">
								Your ongoing perspective helps {data.invite.participantName}'s coach track real
								progress over time.
							</p>
						{/if}
					</div>
				{:else if !data.isFirstFeedback}
					<p class="text-center text-sm font-semibold text-text-primary">
						Welcome back, {data.reviewer.name}
					</p>
				{/if}

				<!-- Step indicator -->
				<div class="flex items-center justify-center gap-2">
					<div class="flex items-center gap-1.5">
						<span
							class="text-2xs flex h-6 w-6 items-center justify-center rounded-full font-bold {effortScore !==
							null
								? 'bg-accent text-white'
								: 'bg-surface-subtle text-text-muted'}">1</span
						>
						<span class="text-2xs text-text-muted">Effort</span>
					</div>
					<div class="h-px w-6 bg-border-default"></div>
					<div class="flex items-center gap-1.5">
						<span
							class="text-2xs flex h-6 w-6 items-center justify-center rounded-full font-bold {performanceScore !==
							null
								? 'bg-accent text-white'
								: 'bg-surface-subtle text-text-muted'}">2</span
						>
						<span class="text-2xs text-text-muted">Performance</span>
					</div>
					<div class="h-px w-6 bg-border-default"></div>
					<div class="flex items-center gap-1.5">
						<span
							class="text-2xs flex h-6 w-6 items-center justify-center rounded-full font-bold {notes.trim()
								? 'bg-accent text-white'
								: 'bg-surface-subtle text-text-muted'}">3</span
						>
						<span class="text-2xs text-text-muted"
							>Comment <span class="text-text-tertiary">(optional)</span></span
						>
					</div>
				</div>

				<!-- Persistent attribution notice (visible throughout form) -->
				<div
					class="flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle px-3 py-2 text-xs text-text-secondary"
				>
					<Shield class="h-3.5 w-3.5 shrink-0 text-text-muted" />
					<span
						>Your name is attached to this feedback — shared only with {data.invite.participantName} and
						their coach.</span
					>
				</div>

				<form method="post" use:enhance={enhanceSubmit} class="space-y-6">
					<input type="hidden" name="token" value={data.token} />
					<!-- Hidden inputs for form submission (only included when a score is selected) -->
					{#if effortScore !== null}
						<input type="hidden" name="effortScore" value={effortScore} />
					{/if}
					{#if performanceScore !== null}
						<input type="hidden" name="performanceScore" value={performanceScore} />
					{/if}

					<!-- Goal Display -->
					<div class="rounded-xl border border-border-default bg-surface-subtle px-5 py-4">
						<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-base text-text-secondary">
							<div class="flex items-center gap-2">
								<Target class="h-5 w-5 shrink-0 text-accent" />
								<span class="font-medium">Goal:</span>
							</div>
							<span class="text-lg font-semibold text-text-primary"
								>{data.invite.goalTitle || 'the goal'}</span
							>
						</div>
					</div>

					{#if data.focusAreas && data.focusAreas.length > 0}
						<div class="rounded-xl border border-accent/30 bg-surface-base px-5 py-4">
							<p class="mb-3 text-sm font-semibold text-accent">Behaviors to observe</p>
							<div class="space-y-2">
								{#each data.focusAreas as focusArea (focusArea.label)}
									<div class="rounded-lg border border-border-default bg-surface-raised px-4 py-3">
										<p class="text-sm font-semibold text-text-primary">{focusArea.label}</p>
										{#if focusArea.description}
											<p class="mt-1 text-xs text-text-secondary">{focusArea.description}</p>
										{/if}
									</div>
								{/each}
							</div>
							<p class="mt-3 text-xs text-accent">
								Keep these in mind as you rate effort and performance below.
							</p>
						</div>
					{/if}

					{#if data.previousRatings && (data.previousRatings.effortScore !== null || data.previousRatings.performanceScore !== null)}
						<div class="rounded-xl border border-accent/30 bg-accent-muted px-4 py-3">
							<p class="text-sm text-accent">
								Your ratings from last time are shown below. Adjust anything that's changed, or tap
								Submit if things look about the same.
							</p>
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
									<span id="effort-label" class="text-lg font-bold text-text-primary">
										Effort
									</span>
									<p class="text-xs text-text-tertiary">
										How much intentional effort have you noticed from {data.invite.participantName} on
										"{data.invite.goalTitle || 'their goal'}" recently?
									</p>
								</div>
							</div>
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all {effortScore !==
								null
									? getScoreBgColor(effortScore, 'effort')
									: 'border-border-default bg-surface-subtle'}"
							>
								<span
									class="text-2xl font-bold {effortScore !== null
										? getScoreColor(effortScore, 'effort')
										: 'text-text-muted'}">{effortScore !== null ? effortScore : '—'}</span
								>
							</div>
						</div>

						<!-- Calibration Guide -->
						<div
							id="effort-calibration"
							class="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted"
						>
							<span><span class="font-semibold">0–2</span> Rarely intentional</span>
							<span><span class="font-semibold">3–4</span> Sporadic effort</span>
							<span><span class="font-semibold">5–6</span> Steady practice</span>
							<span><span class="font-semibold">7–8</span> Highly disciplined</span>
							<span><span class="font-semibold">9–10</span> Relentless commitment</span>
						</div>

						<!-- Button Grid (Primary Input) -->
						<div
							class="mb-4 grid grid-cols-6 gap-2 sm:grid-cols-11"
							role="radiogroup"
							aria-labelledby="effort-label"
							aria-describedby="effort-calibration"
							onkeydown={(e) => handleRadiogroupKeydown(e, 'effort')}
						>
							{#each Array.from({ length: 11 }, (_, i) => i) as i (i)}
								{@const isSelected = effortScore === i}
								{@const buttonColors = getButtonSelectedColors(i, 'effort')}
								{@const hoverColors = getButtonHoverColors(i, 'effort')}
								{@const focusRing = getFocusRing(i, 'effort')}
								<button
									type="button"
									onclick={() => (effortScore = i)}
									role="radio"
									aria-checked={isSelected}
									aria-label="Effort score {i} out of 10"
									tabindex={isSelected || (effortScore === null && i === 0) ? 0 : -1}
									class="flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all {isSelected
										? buttonColors + ' scale-105'
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
						{#if effortScore !== null}
							<p
								class="mt-2 text-center text-xs font-medium {getScoreColor(effortScore, 'effort')}"
							>
								{getScoreLabel(effortScore, 'effort')}
							</p>
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
									<span id="performance-label" class="text-lg font-bold text-text-primary">
										Performance
									</span>
									<p class="text-xs text-text-tertiary">
										How effectively is {data.invite.participantName} performing on "{data.invite
											.goalTitle || 'their goal'}" from your perspective?
									</p>
								</div>
							</div>
							<div
								class="flex h-16 w-16 items-center justify-center rounded-full border-2 transition-all {performanceScore !==
								null
									? getScoreBgColor(performanceScore, 'performance')
									: 'border-border-default bg-surface-subtle'}"
							>
								<span
									class="text-2xl font-bold {performanceScore !== null
										? getScoreColor(performanceScore, 'performance')
										: 'text-text-muted'}">{performanceScore !== null ? performanceScore : '—'}</span
								>
							</div>
						</div>

						<!-- Calibration Guide -->
						<div
							id="performance-calibration"
							class="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-text-muted"
						>
							<span><span class="font-semibold">0–2</span> Not yet visible</span>
							<span><span class="font-semibold">3–4</span> Early signs</span>
							<span><span class="font-semibold">5–6</span> Noticeable progress</span>
							<span><span class="font-semibold">7–8</span> Consistent results</span>
							<span><span class="font-semibold">9–10</span> Transformative impact</span>
						</div>

						<!-- Button Grid (Primary Input) -->
						<div
							class="mb-4 grid grid-cols-6 gap-2 sm:grid-cols-11"
							role="radiogroup"
							aria-labelledby="performance-label"
							aria-describedby="performance-calibration"
							onkeydown={(e) => handleRadiogroupKeydown(e, 'performance')}
						>
							{#each Array.from({ length: 11 }, (_, i) => i) as i (i)}
								{@const isSelected = performanceScore === i}
								{@const buttonColors = getButtonSelectedColors(i, 'performance')}
								{@const hoverColors = getButtonHoverColors(i, 'performance')}
								{@const focusRing = getFocusRing(i, 'performance')}
								<button
									type="button"
									onclick={() => (performanceScore = i)}
									role="radio"
									aria-checked={isSelected}
									aria-label="Performance score {i} out of 10"
									tabindex={isSelected || (performanceScore === null && i === 0) ? 0 : -1}
									class="flex min-h-[44px] w-full items-center justify-center rounded-lg border-2 text-sm font-semibold transition-all {isSelected
										? buttonColors + ' scale-105'
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
						{#if performanceScore !== null}
							<p
								class="mt-2 text-center text-xs font-medium {getScoreColor(
									performanceScore,
									'performance'
								)}"
							>
								{getScoreLabel(performanceScore, 'performance')}
							</p>
						{/if}
					</div>

					<!-- Impact reinforcement (appears after both scores are filled) -->
					{#if effortScore !== null && performanceScore !== null}
						<div
							class="flex items-center gap-2.5 rounded-xl border border-success/10 bg-gradient-to-r from-success/5 to-transparent px-4 py-2.5"
						>
							<CircleCheck class="h-4 w-4 shrink-0 text-success" />
							<p class="text-xs text-text-secondary">
								Both scores recorded. Your perspective helps {data.invite.participantName} see blind spots
								they can't see alone.
							</p>
						</div>
					{/if}

					<!-- Comment (collapsed by default) -->
					{#if showComment}
						<div
							class="rounded-2xl border border-border-default bg-surface-raised p-6 transition-all hover:border-accent/30"
						>
							<label for="comment" class="mb-2 block text-sm font-medium text-text-secondary"
								>Optional comment</label
							>
							<textarea
								name="comment"
								id="comment"
								rows="3"
								maxlength="500"
								bind:value={notes}
								class="w-full rounded-xl border border-border-default bg-surface-subtle px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent/30 focus:outline-none"
								placeholder="Anything specific you've noticed? (optional, 1-2 sentences is plenty)"
							></textarea>
							<div class="mt-2 flex items-center justify-between">
								<p class="text-xs text-text-tertiary">
									Shared with {data.invite.participantName} and their coach.
								</p>
								<span class="text-xs text-text-muted">{notes.length} / 500</span>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (showComment = true)}
							class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-default bg-surface-raised py-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent/30 hover:bg-accent-muted/30 hover:text-accent"
						>
							<PenLine class="h-4 w-4" />
							Add a comment <span class="text-xs text-text-muted">(optional)</span>
						</button>
					{/if}

					<!-- Structured prompts (behavioral observation + suggestion) -->
					{#if showStructured}
						<div class="space-y-4">
							<div
								class="rounded-2xl border border-border-default bg-surface-raised p-6 transition-all hover:border-accent/30"
							>
								<label
									for="behavioralObservation"
									class="mb-1 block text-sm font-medium text-text-secondary"
									>Specific behavior you've observed</label
								>
								<p class="mb-2 text-xs text-text-muted">
									What has {data.invite.participantName} done well or struggled with recently?
								</p>
								<textarea
									name="behavioralObservation"
									id="behavioralObservation"
									rows="2"
									maxlength="500"
									bind:value={behavioralObservation}
									class="w-full rounded-xl border border-border-default bg-surface-subtle px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent/30 focus:outline-none"
									placeholder="e.g. Showed great active listening during the team meeting last Tuesday"
								></textarea>
								<span class="mt-1 block text-right text-xs text-text-muted"
									>{behavioralObservation.length} / 500</span
								>
							</div>
							<div
								class="rounded-2xl border border-border-default bg-surface-raised p-6 transition-all hover:border-accent/30"
							>
								<label for="suggestion" class="mb-1 block text-sm font-medium text-text-secondary"
									>Suggestion for improvement</label
								>
								<p class="mb-2 text-xs text-text-muted">
									What's one thing {data.invite.participantName} could try differently?
								</p>
								<textarea
									name="suggestion"
									id="suggestion"
									rows="2"
									maxlength="500"
									bind:value={suggestion}
									class="w-full rounded-xl border border-border-default bg-surface-subtle px-4 py-3 text-sm text-text-secondary placeholder:text-text-muted focus:border-accent focus:bg-surface-raised focus:ring-2 focus:ring-accent/30 focus:outline-none"
									placeholder="e.g. Could delegate more to build trust with the team"
								></textarea>
								<span class="mt-1 block text-right text-xs text-text-muted"
									>{suggestion.length} / 500</span
								>
							</div>
						</div>
					{:else}
						<button
							type="button"
							onclick={() => (showStructured = true)}
							class="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border-default bg-surface-raised py-3 text-sm font-medium text-text-secondary transition-colors hover:border-accent/30 hover:bg-accent-muted/30 hover:text-accent"
						>
							<Lightbulb class="h-4 w-4" />
							Share a specific observation or suggestion
							<span class="text-xs text-text-muted">(optional)</span>
						</button>
					{/if}

					<div
						class="flex items-center gap-2 rounded-lg bg-accent-muted px-3 py-2 text-xs text-accent"
					>
						<Eye class="h-3.5 w-3.5 shrink-0" />
						<span
							>After submitting, you'll see how {data.invite.participantName} rated themselves in Week
							{data.invite.weekNumber} for comparison.</span
						>
					</div>

					<!-- Validation message -->
					<div aria-live="assertive">
						{#if scoresRequired}
							<div
								class="rounded-xl border border-error-muted bg-error-muted p-4 text-sm text-error"
								role="alert"
							>
								<p class="font-medium">
									<AlertTriangle class="inline h-4 w-4" /> Please select at least one score or write an
									observation before submitting.
								</p>
							</div>
						{/if}
					</div>

					<!-- Submit Button with Enhanced Design -->
					<div
						class="flex flex-col gap-4 rounded-2xl border border-border-default bg-surface-base p-6 sm:flex-row sm:items-center sm:justify-between"
					>
						<div class="flex-1">
							<p class="font-semibold text-text-primary">Ready to submit your feedback?</p>
							<p class="mt-1 flex items-center gap-1.5 text-xs text-text-secondary">
								<Shield class="h-3.5 w-3.5 shrink-0 text-success" />
								Shared only with {data.invite.participantName} and their coach.
								<button
									type="button"
									onclick={() => (showPrivacyDetails = !showPrivacyDetails)}
									class="ml-1 font-medium text-accent underline decoration-solid underline-offset-2 hover:text-accent-hover"
								>
									{showPrivacyDetails ? 'Hide details' : 'Learn more'}
								</button>
							</p>
							{#if showPrivacyDetails}
								<div
									class="text-2xs mt-2 rounded-lg bg-surface-subtle px-3 py-2 leading-relaxed text-text-tertiary"
								>
									<ul class="space-y-1">
										<li>
											Your name and scores are visible to {data.invite.participantName} and their coach.
										</li>
										<li>
											Your feedback is never shared with HR, management, or anyone outside the
											coaching relationship.
										</li>
										<li>
											Data is encrypted in transit and at rest, hosted on enterprise-grade
											infrastructure.
										</li>
										<li>Data is retained for the duration of the coaching engagement.</li>
									</ul>
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<p class="mt-2">
										<a
											href="/privacy"
											target="_blank"
											rel="noopener noreferrer"
											class="text-accent underline decoration-dotted hover:text-accent-hover"
											>Full privacy policy</a
										>
									</p>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
								</div>
							{/if}
						</div>
						<div class="flex items-center gap-3">
							<button
								type="submit"
								disabled={isSubmitting || data.isPreview}
								class="rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition-all hover:bg-accent-hover focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
							>
								<span class="flex items-center gap-2">
									{#if isSubmitting}
										<span
											class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
										></span>
										Submitting...
									{:else}
										<Send class="h-4 w-4" />
										Submit Feedback
									{/if}
								</span>
							</button>
						</div>
					</div>
				</form>
			</div>
		{/if}
	</section>
{/if}

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

	@keyframes slide-in-from-bottom-4 {
		from {
			transform: translateY(1rem);
			opacity: 0;
		}
		to {
			transform: translateY(0);
			opacity: 1;
		}
	}

	.animate-in {
		animation:
			fade-in 0.3s ease-out,
			slide-in-from-top-2 0.3s ease-out;
	}

	.slide-in-from-bottom-4 {
		animation:
			fade-in 0.5s ease-out,
			slide-in-from-bottom-4 0.5s ease-out;
	}

	@keyframes success-pulse {
		0% {
			transform: scale(0.8);
			opacity: 0;
		}
		50% {
			transform: scale(1.1);
		}
		100% {
			transform: scale(1);
			opacity: 1;
		}
	}

	.success-pulse {
		animation: success-pulse 0.4s ease-out;
	}

	@media (prefers-reduced-motion: reduce) {
		.animate-in,
		.slide-in-from-bottom-4,
		.success-pulse {
			animation: none;
		}
	}
</style>
