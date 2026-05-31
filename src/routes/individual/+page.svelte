<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { ArrowRight } from 'lucide-svelte';
	import RatingBar from '$lib/components/RatingBar.svelte';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	// Inline check-in state
	let effortScore: number | null = $state(null);
	let performanceScore: number | null = $state(null);
	let notes = $state('');
	let isSubmitting = $state(false);
	let justSaved = $state(false);

	const bothScoresSelected = $derived(effortScore !== null && performanceScore !== null);

	// After successful form submission, switch to caught-up state
	$effect(() => {
		if (form?.success) {
			justSaved = true;
			isSubmitting = false;
		}
	});

	// Determine screen state
	const screenState = $derived.by(() => {
		if (!data.isOnboardingComplete) return 'welcome' as const;
		if (data.cycle?.isCycleCompleted) return 'complete' as const;
		if (justSaved) return 'caught-up' as const;
		if (data.isCheckInDue) return 'check-in' as const;
		return 'caught-up' as const;
	});
</script>

<svelte:head>
	<title>Today | Forbetra</title>
</svelte:head>

<section class="mx-auto max-w-lg px-6 pb-24">
	{#if screenState === 'welcome'}
		<!-- ═══ Welcome — no cycle yet ═══ -->
		<div class="anim-fade-in py-20 text-center">
			<div
				class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border-strong"
			>
				<span class="text-3xl font-extralight text-accent">/</span>
			</div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Start your growth journey</h1>
			<p class="mx-auto mt-4 max-w-xs text-base leading-relaxed text-text-secondary">
				Set a goal, invite your reviewers, and begin tracking your progress.
			</p>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/onboarding"
				class="mt-10 inline-flex items-center gap-2.5 rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-surface-base shadow-[0_0_24px_rgba(224,181,128,0.2)] transition-all duration-350 hover:bg-accent-hover hover:shadow-[0_0_32px_rgba(224,181,128,0.3)] active:scale-[0.98]"
			>
				Get Started <ArrowRight class="h-4 w-4" />
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	{:else if screenState === 'complete'}
		<!-- ═══ Cycle complete ═══ -->
		<div class="anim-fade-in py-20 text-center">
			<div
				class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full border border-border-strong"
			>
				<span class="text-3xl font-extralight text-accent">&#10003;</span>
			</div>
			<h1 class="text-3xl font-bold tracking-tight text-text-primary">Journey complete</h1>
			<p class="mx-auto mt-4 max-w-xs text-base leading-relaxed text-text-secondary">
				You did the work. See what the data says.
			</p>
			<div class="mt-10 flex justify-center gap-3">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/progress"
					class="inline-flex items-center gap-2 rounded-full bg-accent px-7 py-3.5 text-sm font-semibold text-surface-base shadow-[0_0_24px_rgba(224,181,128,0.2)] transition-all duration-350 hover:bg-accent-hover active:scale-[0.98]"
				>
					View Report <ArrowRight class="h-4 w-4" />
				</a>
				<a
					href="/onboarding"
					class="rounded-full border border-border-strong px-7 py-3.5 text-sm font-semibold text-text-primary transition-all duration-350 hover:bg-surface-raised active:scale-[0.98]"
				>
					Start New
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
		</div>
	{:else}
		<!-- ═══ Active journey — Today screen ═══ -->
		<div class="pt-10">
			<!-- First-cycle orientation banner: decays after Week 2 OR once user
			     has 4+ reflections (whichever comes first), so seasoned users
			     never see it again. -->
			{#if data.maturityStage === 'new' && data.currentWeek !== null && data.currentWeek <= 2}
				<div
					class="mb-6 rounded-lg border border-accent/20 bg-accent-muted/30 px-4 py-3 text-[12px] leading-relaxed text-text-secondary"
				>
					<p>
						<span class="font-semibold text-accent">You're early</span> — Insights, Scorecard, and Feedback
						views fill in once you have ~2 weeks of check-ins and reviewer responses. Just keep showing
						up here each week.
					</p>
				</div>
			{/if}

			<!-- Identity anchor -->
			{#if data.identityAnchor}
				<p class="mb-2 text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase">
					I am becoming {data.identityAnchor.length > 80
						? data.identityAnchor.slice(0, 80) + '...'
						: data.identityAnchor}
				</p>
			{/if}

			<!-- Week indicator -->
			{#if data.currentWeek && data.totalWeeks}
				<p class="mb-8 font-mono text-[11px] tracking-[0.06em] text-text-muted">
					Week {data.currentWeek} of {data.totalWeeks}
				</p>
			{/if}

			{#if screenState === 'check-in'}
				<!-- ═══ Check-in due — inline form ═══ -->
				<div class="pt-8">
					<!-- Prompt -->
					<p class="mb-8 text-[13px] text-text-tertiary">How would you describe your week?</p>

					<!-- Rating bars -->
					<form
						method="POST"
						action="?/checkin"
						use:enhance={() => {
							isSubmitting = true;
							return async ({
								update
							}: {
								update: (opts?: { reset?: boolean }) => Promise<void>;
							}) => {
								await update({ reset: false });
								isSubmitting = false;
							};
						}}
					>
						<input type="hidden" name="effortScore" value={effortScore ?? ''} />
						<input type="hidden" name="performanceScore" value={performanceScore ?? ''} />

						<div class="mb-5 flex justify-center gap-12">
							<RatingBar
								dimension="effort"
								bind:value={effortScore}
								lastValue={data.lastEffortScore}
							/>
							<RatingBar
								dimension="performance"
								bind:value={performanceScore}
								lastValue={data.lastPerformanceScore}
							/>
						</div>

						<!-- Note prompt (always visible) -->
						<div class="mt-8">
							<p class="mb-3 text-sm text-text-secondary">
								What shaped your week? <span class="text-text-tertiary"
									>-- even one sentence helps your coach</span
								>
							</p>
							<textarea
								name="notes"
								rows="3"
								maxlength="500"
								bind:value={notes}
								class="w-full rounded-[10px] border border-border-default bg-surface-raised px-4 py-3.5 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-border-accent focus:outline-none"
								placeholder="A specific moment, a challenge, something you noticed..."
							></textarea>
						</div>

						<!-- Error display -->
						{#if form?.error}
							<div
								class="mt-4 rounded-lg border border-signal-attention/30 bg-signal-attention-muted px-4 py-3 text-sm text-signal-attention"
							>
								{form.error}
							</div>
						{/if}

						<!-- Submit button -->
						<button
							type="submit"
							disabled={!bothScoresSelected || isSubmitting}
							class="mt-6 w-full rounded-lg bg-accent px-6 py-3.5 text-sm font-semibold text-surface-base transition-all duration-350 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
						>
							{#if isSubmitting}
								Saving...
							{:else}
								Save check-in
							{/if}
						</button>
					</form>
				</div>
			{:else}
				<!-- ═══ Caught up ═══ -->
				<div class="py-12 text-center">
					<p class="text-[15px] leading-relaxed text-text-secondary">
						{#if justSaved}
							Check-in saved. Your next check-in opens {data.nextCheckInDay}.
						{:else}
							You're on track. Your next check-in opens {data.nextCheckInDay}.
						{/if}
					</p>
				</div>
			{/if}

			<!-- New feedback notification (one-shot — overrides ambient scorecard nudge below) -->
			{#if data.hasNewFeedback}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/feedback"
					class="group mt-8 block border-l-2 border-accent/25 py-3 pr-4 pl-4 transition-colors hover:border-accent"
				>
					<p class="text-[13px] text-text-secondary">
						{data.newFeedbackRaterName ?? 'A reviewer'} shared their perspective.
						<span class="font-semibold text-accent transition-colors group-hover:text-accent-hover"
							>View scores</span
						>
					</p>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{:else if data.signals?.scorecardReady}
				<!-- Ambient nudge: pull the user toward the blind-spot view once there's
				     enough data for it to be meaningful. -->
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/individual/feedback"
					class="group mt-8 block border-l-2 border-accent/25 py-3 pr-4 pl-4 transition-colors hover:border-accent"
				>
					<p class="text-[13px] text-text-secondary">
						Your blind-spot view is ready — see how your self-rating compares to your reviewers'.
						<span class="font-semibold text-accent transition-colors group-hover:text-accent-hover"
							>Open scorecard</span
						>
					</p>
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			{/if}

			<!-- Coach nudge -->
			{#if data.coachNudge}
				<div class="mt-8 border-l-2 border-accent/20 py-4 pr-4 pl-5">
					<p class="text-sm leading-relaxed text-text-secondary italic">
						"{data.coachNudge.text}"
					</p>
					<p class="mt-2 text-[11px] text-text-muted">
						-- Your coach, {data.coachNudge.coachName}
					</p>
				</div>
			{/if}
		</div>
	{/if}
</section>
