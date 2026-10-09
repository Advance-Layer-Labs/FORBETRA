<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { addToast } from '$lib/stores/toasts.svelte';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	let toastShownForForm: ActionData | null = null;
	$effect(() => {
		if (form && 'error' in form && form !== toastShownForForm) {
			toastShownForForm = form;
			addToast(String(form.error), 'error');
		}
	});

	const formValues = (form as { values?: Record<string, string> } | null)?.values;
	let cycleLabel = $state(formValues?.cycleLabel ?? data.defaults.cycleLabel);
	let cycleStartDate = $state(formValues?.cycleStartDate ?? data.defaults.startDate);
	const initialDurationWeeks = String(formValues?.lengthWeeks ?? data.defaults.durationWeeks);
	let cycleDurationWeeks = $state(
		data.journeyLengths.includes(Number(initialDurationWeeks)) ? initialDurationWeeks : '12'
	);
	// Journey mode: continue with same goal or start fresh
	let cycleMode: 'continue' | 'fresh' = $state('continue');
	let freshGoalTitle = $state('');
	let freshGoalDescription = $state('');

	let isSubmitting = $state(false);
	// Quick-start: one-click continue with defaults
	let showQuickStart = $state(!!data.lastCycle && !!data.goal);

	function selectPresetDuration(weeks: number) {
		cycleDurationWeeks = String(weeks);
	}

	const cycleDurationNumber = $derived(Number(cycleDurationWeeks) || 12);
	const endDatePreview = $derived(
		(() => {
			if (!cycleStartDate || !cycleDurationNumber) return '';
			const start = new Date(cycleStartDate);
			if (isNaN(start.getTime())) return '';
			// eslint-disable-next-line svelte/prefer-svelte-reactivity
			const end = new Date(start);
			end.setDate(end.getDate() + cycleDurationNumber * 7);
			return end.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
		})()
	);

	function getDurationGuidance(weeks: number): string {
		if (weeks <= 7) return 'Short sprint — focused skill experiments';
		if (weeks <= 12) return 'Standard — enough time for meaningful patterns';
		if (weeks <= 16) return 'Extended — deeper behavioral shifts';
		return 'Long-arc — major transitions';
	}

	// === Wizard step state ===
	let step = $state(1);
	const totalSteps = 3;
	const stepLabels = ['Goal', 'Schedule', 'Settings'];

	// Validation per step
	const step1Valid = $derived(cycleMode === 'continue' || freshGoalTitle.trim().length >= 3);
	const step2Valid = $derived(
		!!cycleLabel.trim() && !!cycleStartDate && data.journeyLengths.includes(cycleDurationNumber)
	);

	function nextStep() {
		if (step < totalSteps) step++;
	}

	function prevStep() {
		if (step > 1) step--;
	}
</script>

<svelte:head>
	<title>New Journey | Forbetra</title>
</svelte:head>

<div class="min-h-screen bg-surface-base">
	<section class="mx-auto max-w-3xl px-4 pt-8 pb-12">
		<!-- Header -->
		<div class="mb-6 space-y-2">
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a
				href="/individual"
				class="inline-flex items-center gap-1 text-sm text-text-tertiary transition-colors hover:text-text-secondary"
			>
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15 19l-7-7 7-7"
					/>
				</svg>
				Back to journeys
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
			<h1 class="text-2xl font-bold text-text-primary">Start a New Journey</h1>
		</div>

		{#if showQuickStart}
			<!-- Quick-start: one-click continue -->
			<div
				class="mb-8 rounded-2xl border border-accent/30 bg-gradient-to-r from-accent-muted to-surface-raised p-8"
			>
				<p class="text-2xs font-semibold tracking-wider text-accent uppercase">
					Continue your journey
				</p>
				<p class="mt-3 text-lg font-bold text-text-primary">
					Same goal: "{data.goal.title}"
				</p>
				<p class="mt-1 text-sm text-text-secondary">
					Same focus areas, same reviewers, {data.defaults.durationWeeks} weeks starting {cycleStartDate}.
				</p>
				<div class="mt-6 flex items-center gap-3">
					<form
						method="post"
						use:enhance={() => {
							isSubmitting = true;
							return async ({ update }) => {
								isSubmitting = false;
								await update();
							};
						}}
					>
						<input type="hidden" name="cycleMode" value="continue" />
						<input type="hidden" name="cycleLabel" value={data.defaults.cycleLabel} />
						<input type="hidden" name="cycleStartDate" value={cycleStartDate} />
						<input type="hidden" name="lengthWeeks" value={data.defaults.durationWeeks} />
						<button
							type="submit"
							disabled={isSubmitting}
							class="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-60"
						>
							{#if isSubmitting}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>
								Starting...
							{:else}
								Start New Journey &rarr;
							{/if}
						</button>
					</form>
					<button
						type="button"
						onclick={() => (showQuickStart = false)}
						class="rounded-xl border border-border-default bg-surface-raised px-6 py-3 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-subtle"
					>
						Customize instead
					</button>
				</div>
			</div>
		{/if}

		{#if !showQuickStart}
			<!-- Progress dots -->
			<div class="mb-8 flex items-center justify-center gap-3">
				{#each stepLabels as label, i (label)}
					{@const stepNum = i + 1}
					<button
						type="button"
						onclick={() => {
							if (stepNum < step) step = stepNum;
						}}
						class="flex items-center gap-2 {stepNum < step ? 'cursor-pointer' : 'cursor-default'}"
						disabled={stepNum > step}
					>
						<div
							class="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-all {stepNum ===
							step
								? 'bg-accent text-white'
								: stepNum < step
									? 'bg-accent/20 text-accent'
									: 'bg-surface-subtle text-text-muted'}"
						>
							{stepNum}
						</div>
						<span
							class="hidden text-sm font-medium sm:inline {stepNum === step
								? 'text-text-primary'
								: 'text-text-muted'}"
						>
							{label}
						</span>
					</button>
					{#if i < stepLabels.length - 1}
						<div class="h-px w-8 bg-border-default sm:w-12"></div>
					{/if}
				{/each}
			</div>

			<!-- Form errors -->
			{#if form?.error}
				<div class="mb-6 rounded-xl border border-error/20 bg-error-muted p-4 text-sm text-error">
					<p class="font-medium">{form.error}</p>
				</div>
			{/if}

			<form
				method="post"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
			>
				<input type="hidden" name="lengthWeeks" value={cycleDurationWeeks} />
				<input type="hidden" name="cycleMode" value={cycleMode} />
				{#if cycleMode === 'fresh'}
					<input type="hidden" name="freshGoalTitle" value={freshGoalTitle} />
					<input type="hidden" name="freshGoalDescription" value={freshGoalDescription} />
				{/if}

				<!-- ═══ STEP 1: Goal ═══ -->
				{#if step === 1}
					<div class="space-y-6">
						<div class="space-y-4 rounded-2xl border border-border-default bg-surface-raised p-6">
							<p class="text-sm font-semibold text-text-secondary">What would you like to do?</p>
							<div class="grid gap-3 md:grid-cols-2">
								<button
									type="button"
									onclick={() => (cycleMode = 'continue')}
									class="flex items-start gap-3 rounded-xl border p-4 text-left transition-all {cycleMode ===
									'continue'
										? 'border-accent bg-accent-muted'
										: 'border-border-default bg-surface-raised hover:border-accent/30 hover:bg-surface-subtle'}"
								>
									<div
										class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 {cycleMode ===
										'continue'
											? 'border-accent bg-accent'
											: 'border-border-strong bg-surface-raised'}"
									>
										{#if cycleMode === 'continue'}
											<div class="h-2 w-2 rounded-full bg-white"></div>
										{/if}
									</div>
									<div>
										<p class="font-semibold text-text-primary">Continue with same goal</p>
										<p class="text-xs text-text-tertiary">Keep your current goal and focus areas</p>
									</div>
								</button>
								<button
									type="button"
									onclick={() => (cycleMode = 'fresh')}
									class="flex items-start gap-3 rounded-xl border p-4 text-left transition-all {cycleMode ===
									'fresh'
										? 'border-accent bg-accent-muted'
										: 'border-border-default bg-surface-raised hover:border-accent/30 hover:bg-surface-subtle'}"
								>
									<div
										class="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 {cycleMode ===
										'fresh'
											? 'border-accent bg-accent'
											: 'border-border-strong bg-surface-raised'}"
									>
										{#if cycleMode === 'fresh'}
											<div class="h-2 w-2 rounded-full bg-white"></div>
										{/if}
									</div>
									<div>
										<p class="font-semibold text-text-primary">Start with a new goal</p>
										<p class="text-xs text-text-tertiary">Set a fresh goal and focus areas</p>
									</div>
								</button>
							</div>
						</div>

						{#if cycleMode === 'continue'}
							<div class="rounded-2xl border border-border-default bg-surface-raised p-6">
								<p class="text-2xs mb-1 font-semibold tracking-wider text-text-muted uppercase">
									Your Goal
								</p>
								<h2 class="text-xl font-bold text-text-primary">{data.goal.title}</h2>
								{#if data.goal.description}
									<p class="mt-1 text-sm text-text-secondary">{data.goal.description}</p>
								{/if}
								{#if data.focusAreas.length > 0}
									<div class="mt-4">
										<p class="mb-2 text-xs font-semibold tracking-wider text-text-muted uppercase">
											Focus areas
										</p>
										<ul class="space-y-1">
											{#each data.focusAreas as focusArea (focusArea.label)}
												<li class="flex items-start gap-2 text-sm text-text-secondary">
													<span class="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>
													{focusArea.label}
												</li>
											{/each}
										</ul>
									</div>
								{/if}
								{#if data.lastCycle}
									<div
										class="mt-4 rounded-lg bg-surface-subtle px-3 py-2 text-xs text-text-tertiary"
									>
										Previous journey: <strong>{data.lastCycle.label ?? 'Journey'}</strong>
									</div>
								{/if}
							</div>
						{:else}
							<div class="space-y-4 rounded-2xl border border-border-default bg-surface-raised p-6">
								<p class="text-2xs font-semibold tracking-wider text-text-muted uppercase">
									New Goal
								</p>
								<div class="space-y-2">
									<label
										class="block text-sm font-semibold text-text-secondary"
										for="freshGoalTitle">What do you want to work on?</label
									>
									<input
										id="freshGoalTitle"
										type="text"
										required
										placeholder="e.g. Develop executive presence in team meetings"
										class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-text-primary transition-all focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none"
										value={freshGoalTitle}
										oninput={(e) => (freshGoalTitle = e.currentTarget.value)}
									/>
								</div>
								<div class="space-y-2">
									<label
										class="block text-sm font-semibold text-text-secondary"
										for="freshGoalDescription">Description (optional)</label
									>
									<textarea
										id="freshGoalDescription"
										rows="3"
										placeholder="Add any context about what success looks like..."
										class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary transition-all focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none"
										value={freshGoalDescription}
										oninput={(e) => (freshGoalDescription = e.currentTarget.value)}
									></textarea>
								</div>
							</div>
						{/if}
					</div>

					<!-- Step 1 actions -->
					<div class="mt-8 flex items-center justify-between gap-4">
						<!-- eslint-disable svelte/no-navigation-without-resolve -->
						<a
							href="/individual"
							class="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-6 py-3 font-medium text-text-secondary transition-all hover:border-border-default hover:bg-surface-subtle"
						>
							Cancel
						</a>
						<!-- eslint-enable svelte/no-navigation-without-resolve -->
						<button
							type="button"
							disabled={!step1Valid}
							onclick={nextStep}
							class="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
						>
							Next: Schedule
							<svg
								class="h-5 w-5 transition-transform group-hover:translate-x-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 7l5 5m0 0l-5 5m5-5H6"
								/>
							</svg>
						</button>
					</div>
				{/if}

				<!-- ═══ STEP 2: Schedule ═══ -->
				{#if step === 2}
					<div class="space-y-6 rounded-2xl border border-border-default bg-surface-raised p-8">
						<div class="space-y-1">
							<h2 class="text-2xl font-bold text-text-primary">Schedule</h2>
							<p class="text-sm text-text-secondary">Set the timing for your new journey.</p>
						</div>

						<div class="grid gap-6 md:grid-cols-2">
							<div class="space-y-2">
								<label class="block text-sm font-semibold text-text-secondary" for="cycleLabel"
									>Journey Name</label
								>
								<input
									id="cycleLabel"
									name="cycleLabel"
									type="text"
									required
									placeholder="e.g. Q2 2026 Leadership Journey"
									class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-text-primary transition-all focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none"
									value={cycleLabel}
									oninput={(e) => (cycleLabel = e.currentTarget.value)}
								/>
							</div>

							<div class="space-y-2">
								<label class="block text-sm font-semibold text-text-secondary" for="cycleStartDate"
									>Start Date</label
								>
								<input
									id="cycleStartDate"
									name="cycleStartDate"
									type="date"
									required
									class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-text-primary transition-all focus:border-accent focus:ring-4 focus:ring-accent/10 focus:outline-none"
									value={cycleStartDate}
									oninput={(e) => (cycleStartDate = e.currentTarget.value)}
								/>
							</div>

							<!-- Duration -->
							<div class="space-y-3 md:col-span-2">
								<p class="block text-sm font-semibold text-text-secondary">Duration</p>
								<div class="grid grid-cols-3 gap-3">
									{#each data.journeyLengths as weeks (weeks)}
										<button
											type="button"
											onclick={() => selectPresetDuration(weeks)}
											class="relative rounded-xl border px-4 py-3 text-center transition-all {cycleDurationWeeks ===
											String(weeks)
												? 'border-accent bg-accent-muted'
												: 'border-border-default bg-surface-raised hover:border-accent/30 hover:bg-surface-subtle'}"
										>
											<div class="text-lg font-bold text-text-primary">{weeks}</div>
											<div class="text-xs text-text-tertiary">weeks</div>
											{#if weeks === 12}
												<div class="text-2xs mt-1 font-semibold text-accent">recommended</div>
											{/if}
										</button>
									{/each}
								</div>
								{#if endDatePreview}
									<p class="text-sm text-text-tertiary">
										Your journey will end on <strong>{endDatePreview}</strong>
									</p>
								{/if}
								<p class="text-xs text-text-muted">{getDurationGuidance(cycleDurationNumber)}</p>
							</div>

							<!-- Check-in rhythm -->
							<div class="space-y-3 md:col-span-2">
								<p class="block text-sm font-semibold text-text-secondary">Check-ins</p>
								<div class="rounded-xl border border-border-default bg-surface-subtle p-4">
									<p class="text-sm text-text-secondary">
										Check in at least once a week, on any day. Each check-in is one effort score and
										one performance score, plus an optional note (~2 min). Extra check-ins in the
										same week are welcome.
									</p>
								</div>
							</div>
						</div>
					</div>
					<!-- Step 2 actions -->
					<div class="mt-8 flex items-center justify-between gap-4">
						<button
							type="button"
							onclick={prevStep}
							class="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-6 py-3 font-medium text-text-secondary transition-all hover:border-border-default hover:bg-surface-subtle"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 19l-7-7 7-7"
								/>
							</svg>
							Back
						</button>
						<button
							type="button"
							disabled={!step2Valid}
							onclick={nextStep}
							class="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
						>
							Next: Settings
							<svg
								class="h-5 w-5 transition-transform group-hover:translate-x-1"
								fill="none"
								stroke="currentColor"
								viewBox="0 0 24 24"
							>
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M13 7l5 5m0 0l-5 5m5-5H6"
								/>
							</svg>
						</button>
					</div>
				{/if}

				<!-- ═══ STEP 3: Settings & Review ═══ -->
				{#if step === 3}
					<div class="space-y-6">
						<div class="space-y-6 rounded-2xl border border-border-default bg-surface-raised p-8">
							<div class="space-y-1">
								<h2 class="text-2xl font-bold text-text-primary">Settings</h2>
								<p class="text-sm text-text-secondary">Fine-tune how your journey runs.</p>
							</div>

							<!-- Feedback Frequency -->
							<div class="space-y-2">
								<p class="block text-sm font-semibold text-text-secondary">Feedback frequency</p>
								<p class="text-sm text-text-secondary">
									Each reviewer has their own cadence, weekly or every other week. You can change it
									any time on the
									<!-- eslint-disable svelte/no-navigation-without-resolve -->
									<a
										href="/individual/stakeholders"
										class="font-semibold text-accent hover:underline">Reviewers</a
									>
									<!-- eslint-enable svelte/no-navigation-without-resolve -->
									page.
								</p>
							</div>
						</div>
						<!-- Review summary -->
						<div class="rounded-2xl border border-accent/20 bg-surface-raised p-6">
							<p class="mb-4 text-xs font-semibold tracking-wider text-text-muted uppercase">
								Review
							</p>
							<div class="grid gap-3 text-sm sm:grid-cols-2">
								<div>
									<span class="text-text-muted">Goal:</span>
									<span class="ml-1 font-medium text-text-primary"
										>{cycleMode === 'continue' ? data.goal.title : freshGoalTitle}</span
									>
								</div>
								<div>
									<span class="text-text-muted">Journey:</span>
									<span class="ml-1 font-medium text-text-primary">{cycleLabel || '—'}</span>
								</div>
								<div>
									<span class="text-text-muted">Duration:</span>
									<span class="ml-1 font-medium text-text-primary">{cycleDurationNumber} weeks</span
									>
								</div>
								<div>
									<span class="text-text-muted">Starts:</span>
									<span class="ml-1 font-medium text-text-primary">{cycleStartDate || '—'}</span>
								</div>
								<div>
									<span class="text-text-muted">Check-ins:</span>
									<span class="ml-1 font-medium text-text-primary">At least weekly</span>
								</div>
								<div>
									<span class="text-text-muted">Feedback frequency:</span>
									<span class="ml-1 font-medium text-text-primary">Set per reviewer</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Step 3 actions -->
					<div class="mt-8 flex items-center justify-between gap-4">
						<button
							type="button"
							onclick={prevStep}
							class="inline-flex items-center gap-2 rounded-xl border border-border-strong bg-surface-raised px-6 py-3 font-medium text-text-secondary transition-all hover:border-border-default hover:bg-surface-subtle"
						>
							<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 19l-7-7 7-7"
								/>
							</svg>
							Back
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							class="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 font-semibold text-white transition-all hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						>
							{#if isSubmitting}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>
								Creating...
							{:else}
								Start Journey
								<svg
									class="h-5 w-5 transition-transform group-hover:translate-x-1"
									fill="none"
									stroke="currentColor"
									viewBox="0 0 24 24"
								>
									<path
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="2"
										d="M13 7l5 5m0 0l-5 5m5-5H6"
									/>
								</svg>
							{/if}
						</button>
					</div>
				{/if}
			</form>
		{/if}
	</section>
</div>
