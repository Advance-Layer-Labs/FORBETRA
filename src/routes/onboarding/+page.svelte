<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	let errors = $derived((form?.errors as Record<string, string[]>) ?? {});
	let isSubmitting = $state(false);

	$effect(() => {
		if (form) isSubmitting = false;
	});

	let goalTitle = $state(
		((form?.values as { goalTitle?: string } | undefined)?.goalTitle ?? data.prefill?.goalTitle) ||
			''
	);
	let goalDescription = $state(
		((form?.values as { goalDescription?: string } | undefined)?.goalDescription ??
			data.prefill?.goalDescription) ||
			''
	);

	function applyTemplate(title: string, description: string) {
		goalTitle = title;
		goalDescription = description;
	}
</script>

<svelte:head>
	<title>Start a journey | Forbetra</title>
</svelte:head>

<section class="mx-auto max-w-lg px-6 py-16">
	{#if data.isPreview}
		<p
			class="mb-6 rounded-lg border border-accent/30 bg-accent-muted px-4 py-3 text-xs text-accent"
		>
			Preview mode. If this person already has a journey, saving returns to their board.
		</p>
	{/if}

	<p class="text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase">
		New journey
	</p>
	<h1 class="mt-2 text-3xl font-bold tracking-tight text-text-primary">Name the goal</h1>
	<p class="mt-3 text-base leading-relaxed text-text-secondary">
		One goal starts a 12-week journey. You can add reviewers after your first check-in.
	</p>

	<div class="mt-8 rounded-2xl border border-border-default bg-surface-raised p-5">
		<p class="text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase">
			How Forbetra works
		</p>
		<ol class="mt-4 space-y-3 text-sm leading-relaxed text-text-secondary">
			<li>Name one goal. That starts a 12-week journey.</li>
			<li>Check in each week on effort and performance. The first one is the baseline.</li>
			<li>Invite a few reviewers when ready. Their view shows the gap with yours.</li>
		</ol>
	</div>

	<form
		method="POST"
		class="mt-10 space-y-6"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
	>
		<div>
			<label for="goalTitle" class="text-sm font-medium text-text-primary">Goal</label>
			<input
				id="goalTitle"
				name="goalTitle"
				type="text"
				required
				minlength="3"
				maxlength="200"
				bind:value={goalTitle}
				placeholder="Have a stronger executive presence"
				class="mt-2 w-full rounded-[10px] border border-border-default bg-surface-raised px-4 py-3.5 text-sm text-text-primary placeholder:text-text-muted focus:border-border-accent focus:outline-none"
			/>
			{#if errors.goalTitle}
				<p class="mt-2 text-sm text-signal-attention">{errors.goalTitle[0]}</p>
			{/if}
		</div>

		<div>
			<label for="goalDescription" class="text-sm font-medium text-text-primary">
				What does better look like? <span class="font-normal text-text-tertiary">Optional</span>
			</label>
			<textarea
				id="goalDescription"
				name="goalDescription"
				rows="4"
				maxlength="1000"
				bind:value={goalDescription}
				placeholder="A sentence or two is enough."
				class="mt-2 w-full rounded-[10px] border border-border-default bg-surface-raised px-4 py-3.5 text-sm leading-relaxed text-text-primary placeholder:text-text-muted focus:border-border-accent focus:outline-none"
			></textarea>
			{#if errors.goalDescription}
				<p class="mt-2 text-sm text-signal-attention">{errors.goalDescription[0]}</p>
			{/if}
		</div>

		{#if errors.form}
			<p class="text-sm text-signal-attention">{errors.form[0]}</p>
		{/if}

		<button
			type="submit"
			disabled={isSubmitting || goalTitle.trim().length < 3}
			class="w-full rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-surface-base shadow-[0_0_24px_rgba(224,181,128,0.2)] transition-all duration-350 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
		>
			{isSubmitting ? 'Starting…' : 'Start journey'}
		</button>
	</form>

	<div class="mt-14">
		<p class="text-[11px] font-semibold tracking-[0.08em] text-text-tertiary uppercase">
			Or start from an example
		</p>
		<div class="mt-4 space-y-6">
			{#each data.contexts as context (context.id)}
				<div>
					<p class="text-sm font-medium text-text-primary">{context.title}</p>
					<ul class="mt-2 space-y-2">
						{#each context.goals as goal (goal.id)}
							<li>
								<button
									type="button"
									onclick={() => applyTemplate(goal.title, goal.description)}
									class="w-full rounded-lg border border-border-default bg-surface-raised px-4 py-3 text-left text-sm text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
								>
									{goal.title}
								</button>
							</li>
						{/each}
					</ul>
				</div>
			{/each}
		</div>
	</div>
</section>
