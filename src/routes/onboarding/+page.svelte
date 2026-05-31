<script lang="ts">
	import { onMount } from 'svelte';
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import type { ObjectiveTemplate, OnboardingContext } from '$lib/content/onboardingTemplates';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	type ReviewerFormValue = { name: string; email: string; phone?: string };

	const DRAFT_KEY = 'forbetra-onboarding-draft';
	const DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

	const contexts = data.contexts;
	let errors: Record<string, string[]> = $derived((form?.errors as Record<string, string[]>) ?? {});
	const isEditing = data.isEditing;

	// Reset isSubmitting when form response arrives (success or error)
	$effect(() => {
		if (form) {
			isSubmitting = false;
		}
	});
	const isPrePopulated = (data as unknown as Record<string, unknown>).isPrePopulated ?? false;
	const existingData = data.existingData;

	// Form state
	let objectiveTitle = $state(
		((form?.values as Record<string, unknown>)?.objectiveTitle as string) ??
			existingData?.objectiveTitle ??
			''
	);
	let objectiveDescription = $state(
		((form?.values as Record<string, unknown>)?.objectiveDescription as string) ??
			existingData?.objectiveDescription ??
			''
	);

	// Reviewer state (simplified from stakeholders)
	const existingReviewers = existingData?.stakeholders ?? [];
	let reviewerForms: ReviewerFormValue[] = $state(
		existingReviewers.length > 0
			? existingReviewers.map((s: { name: string; email: string; phone?: string }) => ({
					name: s.name,
					email: s.email,
					phone: s.phone ?? ''
				}))
			: [{ name: '', email: '', phone: '' }]
	);

	// Measure state (up to 3 ways to define/measure the objective)
	let measureForms: string[] = $state(['']);

	// Suggested-subgoals state (Item #2 of the 9/10 plan): when the user blurs
	// the objective field with a substantive value, ask Claude for 3 candidate
	// subgoals to lower cold-start cognitive load. Chips appear above the
	// measure inputs; clicking a chip drops it into the first empty slot.
	let suggestedSubgoals: string[] = $state([]);
	let suggestionStatus: 'idle' | 'loading' | 'ready' | 'error' = $state('idle');
	let lastSuggestionInput: string = $state('');

	async function fetchSubgoalSuggestions() {
		const objective = objectiveTitle.trim();
		// Skip if too short, already requested for this exact text, or any
		// measure input already has user content (don't overwrite their work).
		if (objective.length < 20) return;
		if (objective === lastSuggestionInput) return;
		if (measureForms.some((m) => m.trim().length > 0)) return;
		lastSuggestionInput = objective;
		suggestionStatus = 'loading';
		try {
			const res = await fetch('/api/onboarding/suggest-subgoals', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ objective })
			});
			if (!res.ok) {
				suggestionStatus = 'error';
				return;
			}
			const json = await res.json();
			const list = Array.isArray(json.subgoals)
				? json.subgoals.filter((s: unknown) => typeof s === 'string')
				: [];
			suggestedSubgoals = list.slice(0, 3);
			suggestionStatus = suggestedSubgoals.length > 0 ? 'ready' : 'idle';
		} catch {
			suggestionStatus = 'error';
		}
	}

	function acceptSubgoalSuggestion(text: string) {
		// Place into the first empty measure slot, or replace the only slot
		// if just one and it's empty. If all 3 are filled already, do nothing.
		const emptyIdx = measureForms.findIndex((m) => m.trim().length === 0);
		if (emptyIdx === -1) {
			if (measureForms.length < 3) {
				measureForms = [...measureForms, text];
			}
		} else {
			measureForms[emptyIdx] = text;
		}
		// Auto-add the next empty slot if available so the user can keep picking.
		if (measureForms.length < 3 && measureForms.every((m) => m.trim().length > 0)) {
			measureForms = [...measureForms, ''];
		}
		// Remove the accepted suggestion from the chip list.
		suggestedSubgoals = suggestedSubgoals.filter((s) => s !== text);
	}

	// Template state
	let selectedContextId: string | null = $state(null);
	let selectedContext: OnboardingContext | null = $derived(
		selectedContextId !== null
			? (contexts.find((c: OnboardingContext) => c.id === selectedContextId) ?? null)
			: null
	);
	let expandedObjectiveId: string | null = $state(null);
	let appliedObjectiveId: string | null = $state(null);

	// Step wizard — 2 steps
	type Step = 'goal' | 'reviewers';
	let currentStep: Step = $state(
		Object.keys(errors).length > 0 ? 'reviewers' : isEditing || isPrePopulated ? 'goal' : 'goal'
	);

	let isSubmitting = $state(false);
	let draftRestored = $state(false);
	let mobileTemplatesOpen = $state(false);

	// Client validation
	let clientErrors: Record<string, string> = $state({});

	// Draft restore
	onMount(() => {
		if (isEditing || isPrePopulated || existingData) return;
		try {
			const raw = localStorage.getItem(DRAFT_KEY);
			if (raw) {
				const draft = JSON.parse(raw);
				if (draft.savedAt && Date.now() - draft.savedAt < DRAFT_MAX_AGE_MS) {
					if (draft.objectiveTitle) objectiveTitle = draft.objectiveTitle;
					if (draft.objectiveDescription) objectiveDescription = draft.objectiveDescription;
					if (Array.isArray(draft.reviewerForms) && draft.reviewerForms.length > 0) {
						reviewerForms = draft.reviewerForms;
					}
					if (draft.currentStep === 'goal' || draft.currentStep === 'reviewers') {
						currentStep = draft.currentStep;
					}
					draftRestored = true;
					setTimeout(() => {
						draftRestored = false;
					}, 3000);
				} else {
					localStorage.removeItem(DRAFT_KEY);
				}
			}
		} catch {
			/* intentionally empty */
		}
	});

	// Draft auto-save
	$effect(() => {
		if (typeof window === 'undefined' || isEditing || isPrePopulated) return;
		const timeout = setTimeout(() => {
			try {
				localStorage.setItem(
					DRAFT_KEY,
					JSON.stringify({
						objectiveTitle,
						objectiveDescription,
						reviewerForms,
						currentStep,
						savedAt: Date.now()
					})
				);
			} catch {
				/* intentionally empty */
			}
		}, 1000);
		return () => clearTimeout(timeout);
	});

	function selectContext(contextId: string) {
		selectedContextId = contextId;
		expandedObjectiveId = null;
	}

	function applyObjective(contextId: string, template: ObjectiveTemplate) {
		selectContext(contextId);
		appliedObjectiveId = template.id;
		expandedObjectiveId = template.id;
		objectiveTitle = template.title;
		objectiveDescription = `${template.description}\n\n${template.contextSummary}`.trim();
	}

	function startCustomBuild() {
		appliedObjectiveId = null;
		selectedContextId = null;
		expandedObjectiveId = null;
		objectiveTitle = '';
		objectiveDescription = '';
	}

	function toggleObjective(contextId: string, objectiveId: string) {
		if (selectedContextId !== contextId) selectContext(contextId);
		expandedObjectiveId = expandedObjectiveId === objectiveId ? null : objectiveId;
	}

	function addReviewer() {
		if (reviewerForms.length >= 10) return;
		reviewerForms = [...reviewerForms, { name: '', email: '', phone: '' }];
	}

	function removeReviewer(index: number) {
		if (reviewerForms.length <= 1) return;
		reviewerForms = reviewerForms.filter((_, i) => i !== index);
	}

	function goToStep(step: Step) {
		currentStep = step;
		window.scrollTo({ top: 0, behavior: 'smooth' });
	}

	let canAdvance = $derived(currentStep === 'goal' ? objectiveTitle.trim().length >= 3 : true);

	function validateField(field: string) {
		if (field === 'objectiveTitle') {
			if (objectiveTitle.trim().length === 0)
				clientErrors = { ...clientErrors, objectiveTitle: 'Goal title is required.' };
			else if (objectiveTitle.trim().length < 3)
				clientErrors = { ...clientErrors, objectiveTitle: 'Title must be at least 3 characters.' };
			else {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { objectiveTitle: _unused, ...rest } = clientErrors;
				clientErrors = rest;
			}
		} else if (field.startsWith('reviewerEmail')) {
			const idx = Number(field.replace('reviewerEmail', '')) - 1;
			const email = reviewerForms[idx]?.email ?? '';
			if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
				clientErrors = { ...clientErrors, [field]: 'Please enter a valid email address.' };
			} else {
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				const { [field]: _unused, ...rest } = clientErrors;
				clientErrors = rest;
			}
		}
	}

	const getError = (path: string) => errors[path]?.[0];
	const getClientError = (field: string) => clientErrors[field] ?? null;
</script>

<svelte:head>
	<title>{isEditing ? 'Edit Setup' : 'Get Started'} | Forbetra</title>
</svelte:head>

<div class="min-h-screen bg-surface-base">
	{#if draftRestored}
		<div
			class="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-success/30 bg-success-muted px-4 py-2 text-sm font-medium text-success transition-opacity"
		>
			Draft restored
		</div>
	{/if}
	{#if isPrePopulated}
		<div class="mx-auto max-w-3xl px-4 pt-4">
			<div class="rounded-xl border border-accent/30 bg-accent-muted px-4 py-3 text-sm text-accent">
				<p class="font-medium">
					Your coach has pre-filled some details. Feel free to adjust anything below.
				</p>
			</div>
		</div>
	{/if}

	<section class="mx-auto max-w-5xl space-y-8 px-4 pt-8 pb-12">
		<!-- Progress -->
		<div class="mb-4">
			<div class="mb-1 flex items-center justify-between text-sm text-text-secondary">
				<span class="font-medium">
					Step {currentStep === 'goal' ? 1 : 2} of 2: {currentStep === 'goal'
						? 'Set your goal'
						: 'Add reviewers'}
				</span>
				<span class="text-text-muted">{currentStep === 'goal' ? '50' : '100'}%</span>
			</div>
			<div
				class="h-2 overflow-hidden rounded-full bg-surface-subtle"
				role="progressbar"
				aria-valuenow={currentStep === 'goal' ? 50 : 100}
				aria-valuemin={0}
				aria-valuemax={100}
				aria-label="Onboarding progress"
			>
				<div
					class="h-full rounded-full bg-accent transition-all duration-500 ease-out"
					style="width: {currentStep === 'goal' ? 50 : 100}%"
				></div>
			</div>
		</div>

		<div class="grid gap-6 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
			<form
				method="post"
				class="space-y-8"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ result, update }) => {
						isSubmitting = false;
						if (result.type === 'redirect') {
							try {
								localStorage.removeItem(DRAFT_KEY);
							} catch {
								/* ignore */
							}
						}
						await update();
					};
				}}
			>
				<!-- General form errors -->
				{#if getError('_general')}
					<div class="rounded-xl border border-error/30 bg-error-muted p-4 text-sm text-error">
						<p class="font-medium">{getError('_general')}</p>
					</div>
				{/if}

				<!-- Hidden inputs for edit mode -->
				{#if isEditing && existingData}
					<input type="hidden" name="objectiveId" value={existingData.objectiveId} />
				{/if}

				<!-- Smart defaults as hidden inputs -->
				<input type="hidden" name="checkInFrequency" value="mon,wed,fri" />
				<input type="hidden" name="stakeholderCadence" value="weekly" />
				<input type="hidden" name="revealScores" value="false" />
				<input type="hidden" name="sendStakeholderIntro" value="true" />
				<input type="hidden" name="cycleStartDate" value={data.defaults.startDate} />
				<input type="hidden" name="cycleDurationWeeks" value="12" />
				<input type="hidden" name="notificationTime" value="17:00" />
				<input type="hidden" name="deliveryMethod" value="email" />
				<input type="hidden" name="reminderDays" value="wednesday_friday" />
				<input type="hidden" name="stakeholderFeedbackTime" value="09:00" />

				<!-- Step 1: Set your goal -->
				{#if currentStep === 'goal'}
					<div class="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
						<div class="rounded-2xl border border-border-default bg-surface-raised p-8">
							<div class="mb-6 space-y-2">
								<h2 class="text-3xl font-bold text-text-primary">
									{isEditing ? 'Edit your goal' : 'Set your goal'}
								</h2>
								<p class="text-text-secondary">
									What do you want to develop? Pick a template or write your own.
								</p>
							</div>

							<div class="space-y-6">
								<div class="space-y-2">
									<label
										class="flex items-center gap-2 text-sm font-semibold text-text-secondary"
										for="objectiveTitle"
									>
										<span>Goal Title</span>
										{#if objectiveTitle.trim().length > 0}
											<span
												class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-success-muted text-xs text-success"
											>
												✓
											</span>
										{/if}
									</label>
									<input
										id="objectiveTitle"
										name="objectiveTitle"
										type="text"
										required
										placeholder="e.g., Enhance strategic thinking"
										class="w-full rounded-xl border px-4 py-3 text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none {getClientError(
											'objectiveTitle'
										)
											? 'border-error'
											: 'border-border-default bg-surface-raised'}"
										value={objectiveTitle}
										oninput={(event) => {
											objectiveTitle = event.currentTarget.value;
											if (getClientError('objectiveTitle')) validateField('objectiveTitle');
										}}
										onblur={() => {
											validateField('objectiveTitle');
											fetchSubgoalSuggestions();
										}}
									/>
									{#if getClientError('objectiveTitle')}
										<p class="text-sm text-error">{getClientError('objectiveTitle')}</p>
									{:else if getError('objectiveTitle')}
										<p class="text-sm text-error">{getError('objectiveTitle')}</p>
									{/if}
								</div>

								<div class="space-y-2">
									<label
										class="flex items-center gap-2 text-sm font-semibold text-text-secondary"
										for="objectiveDescription"
									>
										<span>Description</span>
										<span class="font-normal text-text-muted">(optional)</span>
									</label>
									<textarea
										id="objectiveDescription"
										name="objectiveDescription"
										rows="4"
										placeholder="Describe what this goal means to you and why it matters right now..."
										class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
										bind:value={objectiveDescription}
									></textarea>
									{#if getError('objectiveDescription')}
										<p class="text-sm text-error">{getError('objectiveDescription')}</p>
									{/if}
								</div>

								<div class="space-y-2">
									<label class="flex items-center gap-2 text-sm font-semibold text-text-secondary">
										<span>How will you measure progress?</span>
										<span class="font-normal text-text-muted">(optional, up to 3)</span>
									</label>
									<p class="text-xs text-text-muted">
										Define observable behaviors or outcomes that would signal you're on track.
									</p>
									<!-- Suggested-subgoals chips (AI-generated from objective text) -->
									{#if suggestionStatus === 'loading'}
										<p class="flex items-center gap-1.5 text-xs text-text-muted">
											<span
												class="h-1.5 w-1.5 animate-pulse rounded-full bg-accent"
												aria-hidden="true"
											></span>
											Suggesting measures based on your goal…
										</p>
									{:else if suggestedSubgoals.length > 0}
										<div class="space-y-1.5 pb-1">
											<p class="text-xs text-text-muted">
												Tap a suggestion to add it, or write your own below.
											</p>
											<div class="flex flex-wrap gap-1.5">
												{#each suggestedSubgoals as suggestion (suggestion)}
													<button
														type="button"
														onclick={() => acceptSubgoalSuggestion(suggestion)}
														class="rounded-full border border-accent/30 bg-accent-muted px-3 py-1 text-xs text-accent transition-all hover:border-accent hover:bg-accent-muted/80"
													>
														+ {suggestion}
													</button>
												{/each}
											</div>
										</div>
									{/if}
									{#each measureForms as measure, mIndex (mIndex)}
										<div class="flex items-center gap-2">
											<span class="w-5 text-right font-mono text-xs text-text-muted"
												>{mIndex + 1}.</span
											>
											<input
												name={`measure${mIndex + 1}`}
												type="text"
												aria-label={`Progress measure ${mIndex + 1}`}
												placeholder={mIndex === 0
													? 'e.g., Team members volunteer ideas in meetings'
													: mIndex === 1
														? 'e.g., Decisions communicated within 24 hours'
														: 'e.g., Direct reports rate trust 7+ on surveys'}
												class="flex-1 rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-sm text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
												value={measure}
												oninput={(event) => {
													measureForms[mIndex] = event.currentTarget.value;
												}}
											/>
											{#if mIndex > 0 && measure === ''}
												<button
													type="button"
													onclick={() => {
														measureForms = measureForms.filter((_, i) => i !== mIndex);
													}}
													class="px-1 text-xs text-text-muted transition-colors hover:text-signal-attention"
												>
													&times;
												</button>
											{/if}
										</div>
									{/each}
									{#if measureForms.length < 3}
										<button
											type="button"
											onclick={() => {
												measureForms = [...measureForms, ''];
											}}
											class="text-xs text-accent transition-colors hover:text-accent-hover"
										>
											+ Add another measure
										</button>
									{/if}
								</div>

								<div
									class="rounded-xl border border-accent/30 bg-accent-muted p-4 text-sm text-text-secondary"
								>
									<p class="font-medium text-accent">Tip:</p>
									<p class="mt-1">
										Be specific about the impact you want. Instead of "be a better leader," try
										"communicate decisions clearly and inspire my team to take ownership."
									</p>
								</div>

								<div
									class="rounded-xl border border-border-default bg-surface-subtle p-4 text-sm text-text-secondary"
								>
									<p class="font-medium text-text-primary">How scoring works</p>
									<p class="mt-1 text-xs">
										Each week, you'll rate your effort and performance on a 0–10 scale. Your
										reviewers do the same independently. The gap between your view and theirs
										reveals blind spots that drive real growth.
									</p>
									<div class="text-2xs mt-2 flex flex-wrap gap-x-3 gap-y-1 text-text-muted">
										<span><span class="font-semibold">0–2</span> Minimal</span>
										<span><span class="font-semibold">3–4</span> Below average</span>
										<span><span class="font-semibold">5–6</span> Moderate</span>
										<span><span class="font-semibold">7–8</span> Strong</span>
										<span><span class="font-semibold">9–10</span> Exceptional</span>
									</div>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Mobile: Browse Templates button (visible below lg breakpoint) -->
				{#if currentStep === 'goal'}
					<button
						type="button"
						onclick={() => (mobileTemplatesOpen = true)}
						class="flex w-full items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent-muted px-4 py-3 text-sm font-semibold text-accent transition-all hover:border-accent/50 lg:hidden"
					>
						<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 6h16M4 12h16M4 18h7"
							></path>
						</svg>
						Browse Templates
					</button>
				{/if}

				<!-- Step 2: Add reviewers -->
				{#if currentStep === 'reviewers'}
					<!-- Hidden fields for goal data -->
					<input type="hidden" name="objectiveTitle" value={objectiveTitle} />
					<input type="hidden" name="objectiveDescription" value={objectiveDescription} />

					<div class="animate-in fade-in slide-in-from-right-4 space-y-6 duration-300">
						<div class="rounded-2xl border border-border-default bg-surface-raised p-8">
							<div class="mb-6 space-y-2">
								<h2 class="text-3xl font-bold text-text-primary">Add your reviewers</h2>
								<p class="text-text-secondary">
									Add people who regularly see you in action. We recommend 3–10 reviewers for
									meaningful feedback. You can always add more later.
								</p>
								<p class="text-xs text-text-muted">
									Each reviewer receives a simple email with a link to rate your effort and
									performance (takes ~60 seconds).
								</p>
							</div>

							{#if getError('stakeholders')}
								<div
									class="mb-6 rounded-xl border border-error/30 bg-error-muted p-4 text-sm text-error"
								>
									<p class="font-medium">{getError('stakeholders')}</p>
								</div>
							{/if}

							<div class="space-y-4">
								{#each reviewerForms as reviewer, index (index)}
									<div
										class="group rounded-xl border border-border-default bg-surface-subtle p-5 transition-all hover:border-accent/30"
									>
										<div class="mb-3 flex items-center justify-between">
											<div class="flex items-center gap-2">
												<div
													class="flex h-7 w-7 items-center justify-center rounded-full bg-accent-muted text-sm font-semibold text-accent"
												>
													{index + 1}
												</div>
												<h3 class="text-sm font-semibold text-text-primary">
													Reviewer {index + 1}
												</h3>
											</div>
											{#if reviewerForms.length > 1}
												<button
													type="button"
													onclick={() => removeReviewer(index)}
													class="rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-error-muted hover:text-error"
												>
													Remove
												</button>
											{/if}
										</div>

										<div class="grid gap-3 sm:grid-cols-2">
											<div class="space-y-1">
												<label
													class="block text-sm font-medium text-text-secondary"
													for={`stakeholderName${index + 1}`}>Name</label
												>
												<input
													id={`stakeholderName${index + 1}`}
													name={`stakeholderName${index + 1}`}
													type="text"
													placeholder="John Smith"
													class="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
													value={reviewer.name}
													oninput={(event) => {
														reviewerForms[index].name = event.currentTarget.value;
													}}
												/>
											</div>

											<div class="space-y-1">
												<label
													class="block text-sm font-medium text-text-secondary"
													for={`stakeholderEmail${index + 1}`}>Email</label
												>
												<input
													id={`stakeholderEmail${index + 1}`}
													name={`stakeholderEmail${index + 1}`}
													type="email"
													placeholder="john@example.com"
													class="w-full rounded-lg border px-4 py-2.5 text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none {getClientError(
														`reviewerEmail${index + 1}`
													)
														? 'border-error'
														: 'border-border-default bg-surface-raised'}"
													value={reviewer.email}
													oninput={(event) => {
														reviewerForms[index].email = event.currentTarget.value;
														if (getClientError(`reviewerEmail${index + 1}`))
															validateField(`reviewerEmail${index + 1}`);
													}}
													onblur={() => validateField(`reviewerEmail${index + 1}`)}
												/>
												{#if getClientError(`reviewerEmail${index + 1}`)}
													<p class="text-sm text-error">
														{getClientError(`reviewerEmail${index + 1}`)}
													</p>
												{:else if getError(`stakeholders.${index}.email`)}
													<p class="text-sm text-error">
														{getError(`stakeholders.${index}.email`)}
													</p>
												{/if}
											</div>

											<div class="space-y-1 sm:col-span-2">
												<label
													class="block text-sm font-medium text-text-secondary"
													for={`stakeholderPhone${index + 1}`}
												>
													Mobile <span class="font-normal text-text-muted"
														>(optional, for SMS reminders)</span
													>
												</label>
												<input
													id={`stakeholderPhone${index + 1}`}
													name={`stakeholderPhone${index + 1}`}
													type="tel"
													placeholder="+1 (555) 123-4567"
													class="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-2.5 text-text-primary transition-all focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
													value={reviewer.phone ?? ''}
													oninput={(event) => {
														reviewerForms[index].phone = event.currentTarget.value;
													}}
												/>
											</div>
										</div>
									</div>
								{/each}

								{#if reviewerForms.length < 10}
									<button
										type="button"
										onclick={addReviewer}
										class="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-border-strong bg-surface-subtle px-4 py-3 text-sm font-medium text-text-secondary transition-all hover:border-accent hover:bg-accent-muted"
									>
										<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path
												stroke-linecap="round"
												stroke-linejoin="round"
												stroke-width="2"
												d="M12 4v16m8-8H4"
											></path>
										</svg>
										Add another reviewer
									</button>
								{/if}

								<div
									class="rounded-xl border border-accent/30 bg-accent-muted p-4 text-sm text-text-secondary"
								>
									<p class="font-medium text-accent">This step is optional</p>
									<p class="mt-1">
										You can skip this and add reviewers later from your Feedback page. Reviewers you
										add here will receive a welcome email when you complete setup.
									</p>
								</div>
							</div>
						</div>
					</div>
				{/if}

				<!-- Navigation buttons -->
				<div class="flex items-center justify-between gap-4 pt-4">
					{#if currentStep === 'reviewers'}
						<button
							type="button"
							onclick={() => goToStep('goal')}
							class="inline-flex items-center gap-2 rounded-xl border border-border-default bg-surface-raised px-6 py-3 font-medium text-text-secondary transition-all hover:border-border-strong hover:bg-surface-subtle focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none"
						>
							<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M15 19l-7-7 7-7"
								></path>
							</svg>
							Back
						</button>
						<button
							type="submit"
							disabled={isSubmitting}
							class="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 font-semibold text-[#0c0a09] transition-all hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						>
							{#if isSubmitting}
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-[#0c0a09] border-t-transparent"
								></span>
								Launching your journey...
							{:else}
								{isEditing ? 'Save Changes' : 'Complete Setup'}
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
										d="M5 13l4 4L19 7"
									></path>
								</svg>
							{/if}
						</button>
					{:else}
						<div></div>
						<button
							type="button"
							onclick={() => goToStep('reviewers')}
							disabled={!canAdvance}
							class="group inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3 font-semibold text-[#0c0a09] transition-all hover:bg-accent-hover focus:ring-2 focus:ring-accent focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
						>
							Continue
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
								></path>
							</svg>
						</button>
					{/if}
				</div>
			</form>

			<!-- Template Sidebar -->
			{#if currentStep === 'goal'}
				<aside
					class="sticky top-8 hidden h-fit space-y-6 rounded-2xl border border-border-default bg-surface-raised p-6 lg:block"
				>
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<h2 class="text-xl font-bold text-text-primary">Browse Templates</h2>
							<button
								type="button"
								onclick={startCustomBuild}
								class="text-sm font-medium text-accent underline-offset-4 hover:text-accent-hover hover:underline"
							>
								Start from scratch
							</button>
						</div>
						<p class="text-sm text-text-secondary">
							Choose a context to explore curated goals. Click "Use this goal" to fill the form.
						</p>

						<div class="flex flex-wrap gap-2">
							{#each contexts as context (context.id)}
								<button
									type="button"
									class="rounded-full border px-4 py-2 text-sm font-semibold transition-all {selectedContextId ===
									context.id
										? 'border-accent bg-accent text-white'
										: 'border-border-strong bg-surface-raised text-text-secondary hover:border-accent/30 hover:bg-accent-muted'}"
									onclick={() => selectContext(context.id)}
								>
									{context.title}
								</button>
							{/each}
						</div>
					</div>

					{#if selectedContext}
						<div class="space-y-4">
							{#each selectedContext.objectives as objective (objective.id)}
								<article
									class="group rounded-xl border p-5 transition-all {appliedObjectiveId ===
									objective.id
										? 'border-success/30 bg-success-muted'
										: 'border-border-default bg-surface-raised hover:border-accent/30'}"
								>
									<div class="space-y-3">
										<div class="space-y-2">
											<h3 class="font-bold text-text-primary">{objective.title}</h3>
											<p class="text-sm leading-relaxed text-text-secondary">
												{objective.description}
											</p>
										</div>
										<div class="flex flex-wrap gap-2">
											<button
												type="button"
												class="rounded-lg px-4 py-2 text-sm font-semibold transition-all {appliedObjectiveId ===
												objective.id
													? 'bg-success text-white'
													: 'bg-accent text-white hover:bg-accent-hover'}"
												onclick={() =>
													selectedContext && applyObjective(selectedContext.id, objective)}
											>
												{appliedObjectiveId === objective.id ? '✓ Applied' : 'Use this goal'}
											</button>
											<button
												type="button"
												class="rounded-lg border border-border-default bg-surface-raised px-4 py-2 text-sm font-semibold text-text-secondary transition-all hover:border-accent/30 hover:bg-accent-muted"
												onclick={() =>
													selectedContext && toggleObjective(selectedContext.id, objective.id)}
											>
												{expandedObjectiveId === objective.id ? 'Hide details' : 'View details'}
											</button>
										</div>
									</div>

									{#if expandedObjectiveId === objective.id}
										<div
											class="mt-4 space-y-3 rounded-lg border border-dashed border-border-strong bg-surface-subtle p-4"
										>
											<p class="text-xs font-bold tracking-wide text-text-tertiary uppercase">
												Focus Areas
											</p>
											<div class="space-y-2">
												{#each objective.subgoals as subgoal (subgoal.label)}
													<div
														class="rounded-lg border border-border-default bg-surface-raised p-3"
													>
														<p class="font-semibold text-text-primary">{subgoal.label}</p>
														<p class="mt-1 text-xs text-text-secondary">{subgoal.description}</p>
													</div>
												{/each}
											</div>
										</div>
									{/if}
								</article>
							{/each}
						</div>
					{/if}
				</aside>
			{/if}
		</div>
	</section>

	<!-- Mobile Template Drawer -->
	{#if mobileTemplatesOpen}
		<div
			class="fixed inset-0 z-50 lg:hidden"
			role="dialog"
			aria-modal="true"
			aria-label="Browse templates"
			onkeydown={(e) => e.key === 'Escape' && (mobileTemplatesOpen = false)}
		>
			<!-- Backdrop -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				class="absolute inset-0 bg-black/40"
				onclick={() => (mobileTemplatesOpen = false)}
				onkeydown={(e) => e.key === 'Escape' && (mobileTemplatesOpen = false)}
			></div>
			<!-- Drawer -->
			<div
				class="absolute right-0 bottom-0 left-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-surface-raised"
			>
				<div
					class="sticky top-0 z-10 flex items-center justify-between border-b border-border-default bg-surface-raised px-5 py-4"
				>
					<h2 class="text-lg font-bold text-text-primary">Browse Templates</h2>
					<button
						type="button"
						onclick={() => (mobileTemplatesOpen = false)}
						class="rounded-lg p-2 text-text-muted transition-colors hover:bg-surface-subtle"
						aria-label="Close templates"
					>
						<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M6 18L18 6M6 6l12 12"
							></path>
						</svg>
					</button>
				</div>
				<div class="space-y-6 p-5">
					<div class="space-y-3">
						<p class="text-sm text-text-secondary">Choose a context to explore curated goals.</p>
						<div class="flex flex-wrap gap-2">
							{#each contexts as context (context.id)}
								<button
									type="button"
									class="rounded-full border px-3 py-1.5 text-sm font-semibold transition-all {selectedContextId ===
									context.id
										? 'border-accent bg-accent text-white'
										: 'border-border-strong bg-surface-raised text-text-secondary hover:border-accent/30 hover:bg-accent-muted'}"
									onclick={() => selectContext(context.id)}
								>
									{context.title}
								</button>
							{/each}
						</div>
					</div>

					{#if selectedContext}
						<div class="space-y-3">
							{#each selectedContext.objectives as objective (objective.id)}
								<article
									class="rounded-xl border p-4 transition-all {appliedObjectiveId === objective.id
										? 'border-success/30 bg-success-muted'
										: 'border-border-default bg-surface-subtle'}"
								>
									<h3 class="font-bold text-text-primary">{objective.title}</h3>
									<p class="mt-1 text-sm leading-relaxed text-text-secondary">
										{objective.description}
									</p>
									<div class="mt-3 flex flex-wrap gap-2">
										<button
											type="button"
											class="rounded-lg px-3 py-1.5 text-sm font-semibold transition-all {appliedObjectiveId ===
											objective.id
												? 'bg-success text-white'
												: 'bg-accent text-white hover:bg-accent-hover'}"
											onclick={() => {
												if (selectedContext) applyObjective(selectedContext.id, objective);
												mobileTemplatesOpen = false;
											}}
										>
											{appliedObjectiveId === objective.id ? 'Applied' : 'Use this goal'}
										</button>
										<button
											type="button"
											class="rounded-lg border border-border-default bg-surface-raised px-3 py-1.5 text-sm font-semibold text-text-secondary transition-all hover:border-accent/30"
											onclick={() =>
												selectedContext && toggleObjective(selectedContext.id, objective.id)}
										>
											{expandedObjectiveId === objective.id ? 'Hide details' : 'View details'}
										</button>
									</div>

									{#if expandedObjectiveId === objective.id}
										<div
											class="mt-3 space-y-2 rounded-lg border border-dashed border-border-strong bg-surface-raised p-3"
										>
											<p class="text-xs font-bold tracking-wide text-text-tertiary uppercase">
												Focus Areas
											</p>
											{#each objective.subgoals as subgoal (subgoal.label)}
												<div
													class="rounded-lg border border-border-default bg-surface-subtle p-2.5"
												>
													<p class="text-sm font-semibold text-text-primary">{subgoal.label}</p>
													<p class="mt-0.5 text-xs text-text-secondary">{subgoal.description}</p>
												</div>
											{/each}
										</div>
									{/if}
								</article>
							{/each}
						</div>
					{/if}

					<button
						type="button"
						onclick={() => {
							startCustomBuild();
							mobileTemplatesOpen = false;
						}}
						class="w-full rounded-xl border border-border-default bg-surface-subtle px-4 py-3 text-sm font-medium text-text-secondary transition-all hover:border-accent/30"
					>
						Start from scratch
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>
