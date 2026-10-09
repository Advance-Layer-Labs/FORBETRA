<script lang="ts">
	import type { ActionData, PageData } from './$types';
	import { enhance } from '$app/forms';

	import { CheckCircle, Copy, Check, Smartphone } from 'lucide-svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';

	let copiedLink = $state<string | null>(null);
	let submittingReviewerId = $state<string | null>(null);
	let phonelessReviewerId = $state<string | null>(null);
	let phonePromptValue = $state('');

	const copyToClipboard = async (url: string) => {
		try {
			await navigator.clipboard.writeText(url);
			copiedLink = url;
			setTimeout(() => {
				copiedLink = null;
			}, 2000);
		} catch {
			// Clipboard API not available
		}
	};

	const { data, form }: { data: PageData; form: ActionData | null } = $props();

	const reviewerFormValues =
		form?.action === 'reviewer' && form?.values
			? {
					name: form.values.name ?? '',
					email: form.values.email ?? '',
					relationship: form.values.relationship ?? '',
					phone: form.values.phone ?? '',
					cadence: form.values.cadence ?? 'WEEKLY'
				}
			: { name: '', email: '', relationship: '', phone: '', cadence: 'WEEKLY' };

	const reviewerError = form?.action === 'reviewer' && form?.error ? form.error : null;
	const cadenceError = form?.action === 'cadence' && form?.error ? form.error : null;
	const reviewerSuccess = form?.action === 'reviewer' && form?.success ? true : false;

	const formatDateTime = (value: string | null) => {
		if (!value) return '\u2014';
		return new Intl.DateTimeFormat('en-US', {
			dateStyle: 'medium',
			timeStyle: 'short'
		}).format(new Date(value));
	};
</script>

<svelte:head>
	<title>Reviewers | Forbetra</title>
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
						>Journeys</a
					>
				</li>
				<li aria-hidden="true" class="text-text-muted">/</li>
				<li><span class="font-medium text-text-primary">Reviewers</span></li>
			</ol>
		</nav>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<h1 class="text-2xl font-bold text-text-primary">Reviewers</h1>
		<p class="mt-1 text-text-secondary">Manage the people who provide feedback on your progress</p>
	</header>

	{#if form?.action === 'feedback' && !('phonePromptFor' in form)}
		{#if form.error}
			<div class="rounded-xl border border-error/20 bg-error-muted p-4 text-sm text-error">
				{form.error}
			</div>
		{:else if form.feedbackLink}
			<div class="rounded-xl border border-success/20 bg-success-muted p-4 text-sm text-success">
				<p class="mb-2 flex items-center gap-1.5 font-semibold">
					<CheckCircle class="h-4 w-4" /> Feedback link generated!{#if form.smsSent}
						<span class="text-xs font-normal">(SMS sent too)</span>{/if}
				</p>
				<div class="mb-2 flex items-center gap-2">
					<p class="flex-1 font-mono text-xs break-all">{form.feedbackLink}</p>
					<button
						type="button"
						onclick={() => copyToClipboard(form.feedbackLink ?? '')}
						class="shrink-0 rounded-md border border-success/30 bg-success-muted p-1.5 text-success transition-all hover:bg-success/20"
						aria-label="Copy feedback link"
					>
						{#if copiedLink === form.feedbackLink}
							<Check class="h-4 w-4" />
						{:else}
							<Copy class="h-4 w-4" />
						{/if}
					</button>
					{#if copiedLink === form.feedbackLink}
						<span class="text-xs font-medium text-success">Copied</span>
					{/if}
				</div>
				{#if form.expiresAt}
					<p class="text-xs text-success">Expires {formatDateTime(form.expiresAt)}.</p>
				{/if}
			</div>
		{/if}
	{/if}

	<div class="grid gap-6 lg:grid-cols-3">
		<!-- Reviewers List -->
		<div class="space-y-4 lg:col-span-2">
			<h2 class="text-lg font-bold text-text-primary">Your Reviewers</h2>
			{#if data.reviewers.length}
				<div class="space-y-4">
					{#if cadenceError}
						<p
							class="mb-3 rounded-lg border border-error/30 bg-error-muted px-3 py-2 text-sm text-error"
						>
							{cadenceError}
						</p>
					{/if}
					{#each data.reviewers as reviewer (reviewer.id)}
						<div class="rounded-2xl border border-border-default bg-surface-raised p-6">
							<div class="mb-4">
								<p class="text-lg font-semibold text-text-primary">{reviewer.name}</p>
								<p class="text-sm text-text-secondary">{reviewer.email}</p>
								{#if reviewer.relationship}
									<p class="mt-1 text-xs font-medium tracking-wide text-text-tertiary uppercase">
										{reviewer.relationship}
									</p>
								{/if}
								<form
									method="post"
									action="?/updateCadence"
									use:enhance
									class="mt-2 flex items-center gap-2 text-xs text-text-secondary"
								>
									<input type="hidden" name="reviewerId" value={reviewer.id} />
									<label for="cadence-{reviewer.id}">Feedback cadence</label>
									<InfoTip text="How often this person is asked to rate you." />
									<select
										id="cadence-{reviewer.id}"
										name="cadence"
										value={reviewer.cadence}
										onchange={(event) => event.currentTarget.form?.requestSubmit()}
										class="rounded-md border border-border-default bg-surface-raised px-2 py-1 text-xs text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
									>
										<option value="WEEKLY">Weekly</option>
										<option value="BIWEEKLY">Every other week</option>
									</select>
									{#if !reviewer.isDueThisWeek}
										<span class="text-text-tertiary">Not due this week</span>
									{/if}
								</form>
							</div>
							{#if reviewer.lastFeedback}
								<div class="mb-4 rounded-lg border border-success/20 bg-success-muted p-3 text-xs">
									<p class="font-semibold text-success">Last feedback</p>
									<p class="text-success">
										{formatDateTime(reviewer.lastFeedback.submittedAt)}
									</p>
									{#if reviewer.lastFeedback.isCurrentWeek}
										<p class="mt-1 flex items-center gap-1 font-semibold text-success">
											<CheckCircle class="h-3.5 w-3.5" /> Responded this week
										</p>
									{/if}
								</div>
							{/if}

							{#if phonelessReviewerId === reviewer.id}
								<!-- Inline phone prompt for reviewers without a phone -->
								<div class="mt-3 rounded-xl border border-border-default bg-surface-raised p-4">
									<p class="mb-3 flex items-center gap-1.5 text-xs text-text-secondary">
										<Smartphone class="h-3.5 w-3.5 shrink-0" />
										Add {reviewer.name}'s phone to also send an SMS invite (98% open rate vs 20% for
										email)
									</p>
									{#if form?.action === 'feedback' && form?.error && 'phonePromptFor' in form && form.phonePromptFor === reviewer.id}
										<div
											class="mb-3 rounded-lg border border-error/20 bg-error-muted px-3 py-2 text-xs text-error"
										>
											{form.error}
										</div>
									{/if}
									<form
										method="post"
										action="?/addPhoneAndGenerateFeedback"
										class="space-y-3"
										use:enhance={() => {
											submittingReviewerId = reviewer.id;
											return async ({ update, result }) => {
												await update();
												submittingReviewerId = null;
												if (result.type === 'success') {
													phonelessReviewerId = null;
													phonePromptValue = '';
												}
											};
										}}
									>
										<input type="hidden" name="reviewerId" value={reviewer.id} />
										<div>
											<label
												for="phone-prompt-{reviewer.id}"
												class="mb-1.5 block text-xs font-medium text-text-primary"
												>Phone number</label
											>
											<input
												id="phone-prompt-{reviewer.id}"
												name="phone"
												type="tel"
												placeholder="+1 555 123 4567"
												bind:value={phonePromptValue}
												class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
											/>
										</div>
										<div class="flex gap-2">
											<button
												type="submit"
												disabled={submittingReviewerId === reviewer.id}
												class="flex-1 rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white transition-all hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
											>
												{#if submittingReviewerId === reviewer.id}
													<span class="inline-flex items-center justify-center gap-2">
														<span
															class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent"
														></span>
														Sending...
													</span>
												{:else}
													Send invite with SMS
												{/if}
											</button>
										</div>
									</form>
									<form
										method="post"
										action="?/generateFeedback"
										class="mt-2"
										use:enhance={() => {
											submittingReviewerId = reviewer.id;
											return async ({ update }) => {
												await update();
												submittingReviewerId = null;
												phonelessReviewerId = null;
												phonePromptValue = '';
											};
										}}
									>
										<input type="hidden" name="reviewerId" value={reviewer.id} />
										<button
											type="submit"
											disabled={submittingReviewerId === reviewer.id}
											class="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-xs font-semibold text-text-secondary transition-all hover:border-border-strong hover:bg-surface-subtle disabled:cursor-not-allowed disabled:opacity-60"
										>
											{#if submittingReviewerId === reviewer.id}
												<span class="inline-flex items-center justify-center gap-2">
													<span
														class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-secondary border-t-transparent"
													></span>
													Sending...
												</span>
											{:else}
												Send email only
											{/if}
										</button>
									</form>
								</div>
							{:else if reviewer.phone}
								<!-- Reviewer has phone: submit directly -->
								<form
									method="post"
									action="?/generateFeedback"
									class="mt-3"
									use:enhance={() => {
										submittingReviewerId = reviewer.id;
										return async ({ update }) => {
											await update();
											submittingReviewerId = null;
										};
									}}
								>
									<input type="hidden" name="reviewerId" value={reviewer.id} />
									<button
										type="submit"
										disabled={submittingReviewerId !== null}
										class="w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-xs font-semibold text-text-secondary transition-all hover:border-accent/30 hover:bg-accent-muted hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
									>
										{#if submittingReviewerId === reviewer.id}
											<span class="inline-flex items-center gap-2">
												<span
													class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-text-secondary border-t-transparent"
												></span>
												Generating...
											</span>
										{:else}
											Generate Feedback Link
										{/if}
									</button>
								</form>
							{:else}
								<!-- Reviewer has no phone: show prompt on click -->
								<button
									type="button"
									onclick={() => {
										phonelessReviewerId = reviewer.id;
										phonePromptValue = '';
									}}
									disabled={submittingReviewerId !== null}
									class="mt-3 w-full rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-xs font-semibold text-text-secondary transition-all hover:border-accent/30 hover:bg-accent-muted hover:text-accent disabled:cursor-not-allowed disabled:opacity-60"
								>
									Generate Feedback Link
								</button>
							{/if}
						</div>
					{/each}
				</div>
			{:else}
				<div class="rounded-2xl border border-dashed border-border-strong bg-surface-raised p-8">
					<div class="mb-4 flex justify-center">
						<div class="flex h-12 w-12 items-center justify-center rounded-full bg-accent-muted">
							<svg class="h-6 w-6 text-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"
								><path
									stroke-linecap="round"
									stroke-linejoin="round"
									stroke-width="2"
									d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"
								/></svg
							>
						</div>
					</div>
					<h3 class="mb-1 text-center text-sm font-semibold text-text-primary">
						Add 3&#8211;5 reviewers to unlock 360 insights
					</h3>
					<p class="mb-4 text-center text-xs text-text-secondary">
						Reviewer feedback reveals perception gaps — the differences between how you see yourself
						and how others experience you.
					</p>
					<div class="space-y-2 text-xs text-text-secondary">
						<p class="font-semibold text-text-primary">Who to invite:</p>
						<ul class="space-y-1.5 pl-1">
							<li class="flex items-start gap-2">
								<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>Your direct
								manager — sees your strategic impact
							</li>
							<li class="flex items-start gap-2">
								<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>1&#8211;2
								peers — observe your day-to-day collaboration
							</li>
							<li class="flex items-start gap-2">
								<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>A direct
								report — experiences your leadership firsthand
							</li>
							<li class="flex items-start gap-2">
								<span class="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent"></span>A
								cross-functional partner — sees how you operate across teams
							</li>
						</ul>
					</div>
					<p class="text-2xs mt-3 text-center text-text-muted">
						Reviewers receive a simple 60-second form. Their name is shown with their feedback.
					</p>
				</div>
			{/if}
		</div>

		<!-- Add Reviewer Form -->
		<div class="space-y-4">
			<h2 class="text-lg font-bold text-text-primary">Add a Reviewer</h2>
			<div class="rounded-2xl border border-border-default bg-surface-raised p-6">
				<p class="mb-4 text-sm text-text-secondary">
					Invite 3&#8211;5 people who regularly observe your development.
				</p>
				<div aria-live="polite" role="status">
					{#if reviewerError}
						<div
							class="mb-3 rounded-lg border border-error/20 bg-error-muted px-3 py-2 text-xs text-error"
						>
							{reviewerError}
						</div>
					{:else if reviewerSuccess}
						<div
							class="mb-3 rounded-lg border border-success/20 bg-success-muted px-3 py-2 text-xs text-success"
						>
							<CheckCircle class="inline h-3.5 w-3.5" /> Reviewer added successfully!
						</div>
					{/if}
				</div>
				<form method="post" action="?/addReviewer" class="space-y-3">
					<div>
						<label for="reviewer-name" class="mb-1.5 block text-sm font-medium text-text-primary"
							>Name</label
						>
						<input
							id="reviewer-name"
							name="name"
							type="text"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							placeholder="e.g. Jane Smith"
							value={reviewerFormValues.name}
							required
						/>
					</div>
					<div>
						<label for="reviewer-email" class="mb-1.5 block text-sm font-medium text-text-primary"
							>Email</label
						>
						<input
							id="reviewer-email"
							name="email"
							type="email"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							placeholder="jane@company.com"
							value={reviewerFormValues.email}
							required
						/>
						<p class="text-2xs mt-1 text-text-muted">
							They'll receive a link to rate you. Their name is shown with their feedback.
						</p>
					</div>
					<div>
						<div class="mb-1.5 flex items-center gap-1.5">
							<label for="reviewer-relationship" class="text-sm font-medium text-text-primary"
								>Relationship <span class="font-normal text-text-tertiary">(optional)</span></label
							>
							<InfoTip
								text="Skip-level is your manager’s manager. Cross-functional is someone on another team."
							/>
						</div>
						<select
							id="reviewer-relationship"
							name="relationship"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							value={reviewerFormValues.relationship}
						>
							<option value="" disabled selected={!reviewerFormValues.relationship}
								>Select relationship</option
							>
							<option value="Direct Manager">Direct Manager</option>
							<option value="Skip-Level Manager">Skip-Level Manager</option>
							<option value="Peer">Peer</option>
							<option value="Direct Report">Direct Report</option>
							<option value="Cross-Functional Partner">Cross-Functional Partner</option>
							<option value="HR Partner">HR Partner</option>
							<option value="Other">Other</option>
						</select>
					</div>
					<div>
						<div class="mb-1.5 flex items-center gap-1.5">
							<label for="reviewer-cadence" class="text-sm font-medium text-text-primary"
								>Feedback cadence</label
							>
							<InfoTip text="How often this person is asked to rate you." />
						</div>
						<select
							id="reviewer-cadence"
							name="cadence"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							value={reviewerFormValues.cadence}
						>
							<option value="WEEKLY">Weekly</option>
							<option value="BIWEEKLY">Every other week</option>
						</select>
					</div>
					<div>
						<label for="reviewer-phone" class="mb-1.5 block text-sm font-medium text-text-primary"
							>Phone <span class="font-normal text-text-tertiary">(optional)</span></label
						>
						<input
							id="reviewer-phone"
							name="phone"
							type="tel"
							class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
							placeholder="Phone"
							value={reviewerFormValues.phone}
						/>
					</div>
					<button
						type="submit"
						class="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
					>
						Add Reviewer
					</button>
				</form>
			</div>
		</div>
	</div>
</section>
