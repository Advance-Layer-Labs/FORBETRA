<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import {
		Compass,
		Mail,
		Smartphone,
		Users,
		BarChart3,
		MessageSquare,
		Copy,
		Check
	} from 'lucide-svelte';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	type Step = 'welcome' | 'practice' | 'invite';
	const allSteps: Step[] = ['welcome', 'practice', 'invite'];

	function stepFromForm(value: ActionData | null): Step | null {
		if (!value) return null;
		if ('practiceSaved' in value && value.practiceSaved) return 'invite';
		if ('practiceError' in value && value.practiceError) return 'practice';
		if (('error' in value && value.error) || ('success' in value && value.success)) return 'invite';
		return null;
	}

	let currentStep = $state<Step>(stepFromForm(form) ?? 'welcome');

	const focusPresets = [
		'Executive leadership',
		'Operations',
		'Military / operational',
		'Youth sports'
	];
	let focusChoice = $state('');
	let customFocus = $state('');
	let practiceName = $state('');
	let practiceDescription = $state('');
	let hydratedPractice = $state(false);

	const resolvedFocus = $derived(focusChoice === 'other' ? customFocus.trim() : focusChoice);
	const practiceReady = $derived(
		resolvedFocus.length >= 2 &&
			resolvedFocus.length <= 80 &&
			practiceName.trim().length >= 2 &&
			practiceName.trim().length <= 80 &&
			practiceDescription.trim().length <= 160
	);

	const currentStepIndex = $derived(allSteps.indexOf(currentStep));

	function goNext() {
		const next = allSteps[currentStepIndex + 1];
		if (next) currentStep = next;
	}

	function goBack() {
		const prev = allSteps[currentStepIndex - 1];
		if (prev) currentStep = prev;
	}

	// Pre-fill state
	type PrefillReviewer = { id: number; name: string; email: string };
	let showPrefill = $state(false);
	let prefillGoalTitle = $state('');
	let nextReviewerId = $state(1);
	let prefillReviewers = $state<PrefillReviewer[]>([{ id: 0, name: '', email: '' }]);

	function addPrefillReviewer() {
		if (prefillReviewers.length < 3) {
			prefillReviewers = [...prefillReviewers, { id: nextReviewerId++, name: '', email: '' }];
		}
	}
	function removePrefillReviewer(index: number) {
		prefillReviewers = prefillReviewers.filter((_, i) => i !== index);
	}

	// Form state for invite step
	let email = $state('');
	let name = $state('');
	let phone = $state('');
	let message = $state(
		"I'd like to invite you to join Forbetra so I can support your development journey. You'll set your own goal, track weekly progress, and get feedback from the people around you — and I'll be here to guide you through it."
	);
	let isSubmitting = $state(false);
	let copiedInviteUrl = $state(false);

	async function copyInviteUrl(url: string) {
		await navigator.clipboard.writeText(url);
		copiedInviteUrl = true;
	}

	const stepLabels = ['Welcome', 'Your practice', 'Invite'];

	$effect(() => {
		if (hydratedPractice) return;
		hydratedPractice = true;
		const submitted =
			form && 'values' in form && form.values && 'coachingFocus' in form.values
				? form.values
				: undefined;
		const savedFocus = submitted?.coachingFocus || data.coach.coachingFocus;
		if (focusPresets.includes(savedFocus)) {
			focusChoice = savedFocus;
		} else if (savedFocus) {
			focusChoice = 'other';
			customFocus = savedFocus;
		}
		practiceName = submitted?.practiceName || data.coach.practiceName;
		practiceDescription = submitted?.practiceDescription || data.coach.practiceDescription;
	});

	// Leave onboarding once the invite email went out. If it failed, stay so the link can be copied.
	let seenForm = $state<ActionData | null>(null);
	$effect(() => {
		if (!form || form === seenForm) return;
		seenForm = form;
		if ('practiceSaved' in form && form.practiceSaved) currentStep = 'invite';
		else if ('practiceError' in form && form.practiceError) currentStep = 'practice';
		else if (('error' in form && form.error) || ('success' in form && form.success)) {
			currentStep = 'invite';
		}
		if ('skipped' in form && form.skipped) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/coach');
		}
		if ('success' in form && form.success && !('emailFailed' in form && form.emailFailed)) {
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			goto('/coach');
		}
	});
</script>

<svelte:head>
	<title>Coach Setup | Forbetra</title>
</svelte:head>

<section
	class="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center gap-8 p-4 pb-12"
>
	<!-- Progress Steps -->
	<div class="flex items-center gap-6">
		{#each allSteps as step, i (step)}
			<button
				type="button"
				onclick={() => {
					if (i <= currentStepIndex) currentStep = step;
				}}
				class="flex flex-col items-center gap-1.5"
				aria-label="Step {i + 1}: {stepLabels[i]}"
			>
				<span
					class="h-3 w-3 rounded-full transition-all {i === currentStepIndex
						? 'scale-110 bg-accent shadow-md shadow-accent/30'
						: i < currentStepIndex
							? 'bg-accent/60 hover:bg-accent/70'
							: 'bg-surface-subtle'}"
				></span>
				<span
					class="text-2xs font-medium {i === currentStepIndex
						? 'text-accent'
						: i < currentStepIndex
							? 'text-text-secondary'
							: 'text-text-muted'}"
				>
					{stepLabels[i]}
				</span>
			</button>
		{/each}
	</div>
	<p class="text-xs text-text-muted">Step {currentStepIndex + 1} of {allSteps.length}</p>

	<!-- Step 1: Welcome -->
	{#if currentStep === 'welcome'}
		<div class="w-full space-y-8 text-center">
			<div class="space-y-4">
				<div
					class="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent shadow-xl shadow-accent/20"
				>
					<Compass class="h-10 w-10 text-white" />
				</div>
				<h1 class="text-4xl font-bold text-text-primary">Welcome to Forbetra, {data.coach.name}</h1>
				<p class="mx-auto max-w-lg text-lg text-text-secondary">
					Prep faster, spot blind spots earlier, and see the impact of your coaching — all in one
					place.
				</p>
			</div>

			<div class="mx-auto max-w-xl space-y-4">
				<div class="rounded-2xl border border-border-default bg-surface-raised p-6 text-left">
					<h3 class="mb-3 text-sm font-semibold tracking-wide text-accent uppercase">
						How it works
					</h3>
					<div class="space-y-4">
						<div class="flex items-start gap-3">
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white"
							>
								1
							</div>
							<div>
								<p class="text-sm font-semibold text-text-primary">Name your practice</p>
								<p class="text-xs text-text-secondary">
									A focus and a one-line description are yours alone — no one else has to show up
									first.
								</p>
							</div>
						</div>
						<div class="flex items-start gap-3">
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/70 text-sm font-bold text-white"
							>
								2
							</div>
							<div>
								<p class="text-sm font-semibold text-text-primary">Use the dashboard on your own</p>
								<p class="text-xs text-text-secondary">
									The practice is set up even before a client joins. Invite someone when you have
									one.
								</p>
							</div>
						</div>
						<div class="flex items-start gap-3">
							<div
								class="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/50 text-sm font-bold text-white"
							>
								3
							</div>
							<div>
								<p class="text-sm font-semibold text-text-primary">Coach with precision</p>
								<p class="text-xs text-text-secondary">
									Use data-driven insights to guide each conversation. Track real change over weeks,
									not assumptions.
								</p>
							</div>
						</div>
					</div>
				</div>
				<div class="rounded-2xl border border-border-default bg-surface-raised p-6 text-left">
					<h3 class="mb-3 text-sm font-semibold tracking-wide text-accent uppercase">Your tools</h3>
					<ul class="space-y-2 text-sm text-text-secondary">
						<li class="flex items-start gap-2">
							<Users class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
							Client roster with at-a-glance status and alerts
						</li>
						<li class="flex items-start gap-2">
							<BarChart3 class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
							Portfolio analytics — consistency trends, cross-client patterns
						</li>
						<li class="flex items-start gap-2">
							<MessageSquare class="mt-0.5 h-4 w-4 shrink-0 text-accent" />
							AI coaching prep generated before every session
						</li>
					</ul>
				</div>
			</div>

			<button
				type="button"
				onclick={goNext}
				class="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition-all hover:bg-accent-hover"
			>
				Set up your practice
				<span>&#8594;</span>
			</button>
		</div>
	{/if}

	<!-- Step 2: Your practice -->
	{#if currentStep === 'practice'}
		<div class="w-full space-y-8 text-center">
			<div class="space-y-3">
				<h1 class="text-3xl font-bold text-text-primary">Name your practice</h1>
				<p class="mx-auto max-w-md text-base text-text-secondary">
					This is your setup. A client invitation can wait until you have someone to invite.
				</p>
			</div>

			{#if form && 'practiceError' in form && form.practiceError}
				<div
					class="mx-auto max-w-md rounded-xl border border-error/50 bg-error-muted p-4 text-sm text-error"
				>
					<p class="font-medium">{form.practiceError}</p>
				</div>
			{/if}

			<form method="post" action="?/savePractice" class="mx-auto max-w-md space-y-5 text-left">
				<fieldset>
					<legend class="mb-2 text-sm font-semibold text-text-primary">Coaching focus</legend>
					<div class="flex flex-wrap gap-2">
						{#each focusPresets as preset (preset)}
							<button
								type="button"
								onclick={() => (focusChoice = preset)}
								class="rounded-full border px-3 py-1.5 text-sm transition-colors {focusChoice ===
								preset
									? 'border-accent bg-accent/15 text-accent'
									: 'border-border-default text-text-secondary hover:border-border-strong'}"
							>
								{preset}
							</button>
						{/each}
						<button
							type="button"
							onclick={() => (focusChoice = 'other')}
							class="rounded-full border px-3 py-1.5 text-sm transition-colors {focusChoice ===
							'other'
								? 'border-accent bg-accent/15 text-accent'
								: 'border-border-default text-text-secondary hover:border-border-strong'}"
						>
							Other
						</button>
					</div>
					{#if focusChoice === 'other'}
						<input
							type="text"
							bind:value={customFocus}
							maxlength="80"
							placeholder="Your focus"
							class="mt-3 w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
						/>
					{/if}
					<input type="hidden" name="coachingFocus" value={resolvedFocus} />
				</fieldset>

				<div>
					<label for="practiceName" class="mb-1.5 block text-sm font-semibold text-text-primary">
						Practice name
					</label>
					<input
						id="practiceName"
						name="practiceName"
						type="text"
						bind:value={practiceName}
						required
						minlength="2"
						maxlength="80"
						placeholder="e.g. Northside Leadership"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					/>
				</div>

				<div>
					<label
						for="practiceDescription"
						class="mb-1.5 block text-sm font-semibold text-text-primary"
					>
						One-line description
						<span class="text-xs font-normal text-text-tertiary"
							>(optional — shown in client invitations)</span
						>
					</label>
					<input
						id="practiceDescription"
						name="practiceDescription"
						type="text"
						bind:value={practiceDescription}
						maxlength="160"
						placeholder="e.g. Weekly coaching for operators who want clearer decisions"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					/>
				</div>

				<div class="flex flex-col gap-3 pt-2 sm:flex-row">
					<button
						type="button"
						onclick={goBack}
						class="rounded-xl border border-border-default px-6 py-3 text-sm font-semibold text-text-secondary transition-all hover:border-border-strong hover:bg-surface-subtle"
					>
						&#8592; Back
					</button>
					<button
						type="submit"
						disabled={!practiceReady}
						class="flex-1 rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
					>
						Continue
					</button>
				</div>
			</form>
		</div>
	{/if}

	<!-- Step 3: Invite a client (optional) -->
	{#if currentStep === 'invite'}
		<div class="w-full space-y-8 text-center">
			<div class="space-y-3">
				<div
					class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-accent to-accent shadow-lg shadow-accent/20"
				>
					<Mail class="h-8 w-8 text-white" />
				</div>
				<h1 class="text-3xl font-bold text-text-primary">Invite a client</h1>
				<p class="mx-auto max-w-md text-base text-text-secondary">
					When you have someone to coach, send an invitation. You can also do this later from the
					dashboard — the practice is already set up.
				</p>
				<p class="mx-auto max-w-md text-xs text-text-tertiary">
					You can optionally pre-fill their goal and reviewers below.
				</p>
			</div>

			{#if form?.error}
				<div
					class="mx-auto max-w-md rounded-xl border border-error/50 bg-error-muted p-4 text-sm text-error"
				>
					<p class="font-medium">{form.error}</p>
				</div>
			{/if}

			{#if form?.success && form.emailFailed}
				<div
					class="mx-auto max-w-md space-y-3 rounded-xl border border-warning/40 bg-warning-muted p-4 text-left text-sm text-warning"
				>
					<p class="font-semibold">Invitation created, but the email could not be sent.</p>
					<p>Share this link with your client directly.</p>
					{#if form.inviteUrl}
						<div
							class="flex items-center gap-2 rounded-lg border border-warning/30 bg-surface-raised px-3 py-2"
						>
							<p class="flex-1 font-mono text-xs break-all text-text-primary">{form.inviteUrl}</p>
							<button
								type="button"
								onclick={() => copyInviteUrl(form?.inviteUrl ?? '')}
								class="shrink-0 rounded-md border border-warning/30 p-1.5 text-warning transition-all hover:bg-warning/20"
								aria-label="Copy invite link"
							>
								{#if copiedInviteUrl}
									<Check class="h-4 w-4" />
								{:else}
									<Copy class="h-4 w-4" />
								{/if}
							</button>
						</div>
					{/if}
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href="/coach" class="inline-block text-sm font-semibold text-text-primary underline">
						Continue to your dashboard
					</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
			{/if}

			<form
				method="post"
				action="?/createInvite"
				use:enhance={() => {
					isSubmitting = true;
					return async ({ update }) => {
						isSubmitting = false;
						await update();
					};
				}}
				class="mx-auto max-w-md space-y-5 text-left"
			>
				<div>
					<label for="email" class="mb-1.5 block text-sm font-semibold text-text-primary">
						Email address <span class="text-error">*</span>
					</label>
					<input
						type="email"
						id="email"
						name="email"
						bind:value={email}
						required
						placeholder="client@example.com"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					/>
				</div>

				<div>
					<label for="name" class="mb-1.5 block text-sm font-semibold text-text-primary">
						Name <span class="text-xs font-normal text-text-tertiary">(optional)</span>
					</label>
					<input
						type="text"
						id="name"
						name="name"
						bind:value={name}
						placeholder="Their name"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					/>
				</div>

				<div>
					<label
						for="phone"
						class="mb-1.5 flex items-center gap-1.5 text-sm font-semibold text-text-primary"
					>
						<Smartphone class="h-3.5 w-3.5" />
						Phone
						<span class="text-xs font-normal text-text-tertiary"
							>(optional — enables SMS invite)</span
						>
					</label>
					<input
						type="tel"
						id="phone"
						name="phone"
						bind:value={phone}
						placeholder="+1 555 123 4567"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
					/>
				</div>

				<div>
					<label for="message" class="mb-1.5 block text-sm font-semibold text-text-primary">
						Personal message <span class="text-xs font-normal text-text-tertiary">(optional)</span>
					</label>
					<textarea
						id="message"
						name="message"
						bind:value={message}
						rows="4"
						class="w-full rounded-xl border border-border-default bg-surface-raised px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
						placeholder="Add a personal note to your invitation..."
					></textarea>
				</div>

				<!-- Pre-fill toggle -->
				<div class="rounded-xl border border-border-default bg-surface-subtle p-4">
					<div class="flex items-center justify-between">
						<div>
							<p class="text-sm font-semibold text-text-primary">Pre-fill client's setup</p>
							<p class="text-xs text-text-tertiary">
								Save them time by pre-filling their goal and reviewers. e.g. "Enhance strategic
								thinking" + 2 reviewer slots.
							</p>
						</div>
						<button
							type="button"
							onclick={() => (showPrefill = !showPrefill)}
							class="relative ml-3 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors {showPrefill
								? 'bg-accent'
								: 'border border-border-default bg-surface-subtle'}"
							role="switch"
							aria-checked={showPrefill}
							aria-label="Pre-fill onboarding"
						>
							<span
								class="inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform {showPrefill
									? 'translate-x-5'
									: 'translate-x-1'}"
							></span>
						</button>
					</div>
					{#if showPrefill}
						<div class="mt-4 space-y-4">
							<div>
								<label for="prefillGoalTitle" class="text-xs font-semibold text-text-secondary"
									>Goal title</label
								>
								<input
									id="prefillGoalTitle"
									type="text"
									name="prefillGoalTitle"
									bind:value={prefillGoalTitle}
									placeholder="e.g. Improve executive presence"
									class="mt-1 w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-1 focus:ring-accent/30 focus:outline-none"
								/>
							</div>

							<div>
								<p class="text-xs font-semibold text-text-secondary">Reviewers</p>
								{#each prefillReviewers as sh, i (sh.id)}
									<div class="mt-1.5 flex items-center gap-2">
										<input
											type="text"
											bind:value={sh.name}
											placeholder="Name"
											class="flex-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
										/>
										<input
											type="email"
											bind:value={sh.email}
											placeholder="Email"
											class="flex-1 rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none"
										/>
										{#if prefillReviewers.length > 1}
											<button
												type="button"
												onclick={() => removePrefillReviewer(i)}
												class="text-xs text-text-muted hover:text-error"
											>
												&times;
											</button>
										{/if}
									</div>
								{/each}
								{#if prefillReviewers.length < 3}
									<button
										type="button"
										onclick={addPrefillReviewer}
										class="mt-1.5 text-xs font-medium text-accent hover:underline"
									>
										+ Add reviewer
									</button>
								{/if}
							</div>

							<!-- Hidden serialized fields -->
							<input
								type="hidden"
								name="prefillReviewers"
								value={JSON.stringify(
									prefillReviewers.filter((s) => s.name.trim() && s.email.trim())
								)}
							/>
						</div>
					{/if}
				</div>

				<div class="flex flex-col gap-3 pt-2">
					<button
						type="submit"
						disabled={isSubmitting || !email}
						class="w-full rounded-xl bg-accent px-8 py-3.5 font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
					>
						{#if isSubmitting}
							<span class="inline-flex items-center gap-2">
								<span
									class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"
								></span>
								Sending Invitation...
							</span>
						{:else}
							Send Invitation & Continue
						{/if}
					</button>
				</div>
			</form>

			<div class="mx-auto flex max-w-md flex-col gap-3 pt-2">
				<form
					method="post"
					action="?/skip"
					use:enhance={() => {
						return async ({ update }) => {
							await update();
						};
					}}
				>
					<button
						type="submit"
						class="w-full rounded-xl border border-border-strong bg-surface-raised px-8 py-3.5 font-semibold text-text-primary transition-all hover:border-accent hover:bg-surface-subtle"
					>
						I'll invite later
					</button>
				</form>
				<button
					type="button"
					onclick={goBack}
					class="text-sm font-medium text-text-tertiary transition-colors hover:text-text-secondary"
				>
					&#8592; Back
				</button>
			</div>
		</div>
	{/if}
</section>
