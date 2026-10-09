<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';

	const MAX_FOCUS_AREAS = 5;

	let { data, form }: { data: PageData; form: ActionData | null } = $props();

	type FocusAreaForm = { label: string; description: string };

	const seeded: FocusAreaForm[] =
		form?.focusAreas && form.focusAreas.length > 0
			? form.focusAreas
			: data.focusAreas.length > 0
				? data.focusAreas
				: [{ label: '', description: '' }];

	let areas: FocusAreaForm[] = $state(seeded.slice(0, MAX_FOCUS_AREAS));
	let suggestions: string[] = $state([]);
	let suggestionStatus: 'idle' | 'loading' | 'ready' | 'error' | 'short' | 'empty' = $state('idle');
	let suggestionMessage = $state('');
	let isSubmitting = $state(false);

	async function loadSuggestions() {
		suggestions = [];
		suggestionMessage = '';
		if (data.goalTitle.trim().length < 10) {
			suggestionStatus = 'short';
			suggestionMessage = 'Suggestions need a slightly longer goal.';
			return;
		}
		suggestionStatus = 'loading';
		try {
			const res = await fetch('/api/onboarding/suggest-focusAreas', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ goal: data.goalTitle })
			});
			if (!res.ok) {
				suggestionStatus = 'error';
				suggestionMessage = 'Suggestions are unavailable right now. You can try again.';
				return;
			}
			const json = await res.json();
			suggestions = Array.isArray(json.focusAreas)
				? json.focusAreas.filter((item: unknown) => typeof item === 'string')
				: [];
			if (suggestions.length === 0) {
				suggestionStatus = 'empty';
				suggestionMessage = 'No suggestions came back. You can try again.';
				return;
			}
			suggestionStatus = 'ready';
		} catch {
			suggestionStatus = 'error';
			suggestionMessage = 'Suggestions are unavailable right now. You can try again.';
		}
	}

	function addSuggestion(label: string) {
		const empty = areas.find((area) => area.label.trim().length === 0);
		if (empty) {
			empty.label = label;
			areas = [...areas];
			return;
		}
		if (areas.length >= MAX_FOCUS_AREAS) return;
		areas = [...areas, { label, description: '' }];
	}
</script>

<svelte:head>
	<title>Focus areas | Forbetra</title>
</svelte:head>

<section class="mx-auto max-w-lg px-6 pt-10 pb-24">
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<a href="/individual" class="text-sm text-text-secondary hover:text-text-primary"
		>Back to journeys</a
	>
	<!-- eslint-enable svelte/no-navigation-without-resolve -->

	<h1 class="mt-6 text-3xl font-bold tracking-tight text-text-primary">Focus areas</h1>
	<p class="mt-3 text-base leading-relaxed text-text-secondary">
		Optional hints for “{data.goalTitle}”. They are not scored — they give you and your reviewers
		something concrete to watch for.
	</p>

	{#if suggestionStatus === 'loading'}
		<p class="mt-6 text-sm text-text-tertiary">Looking at your goal…</p>
	{:else}
		<button type="button" onclick={loadSuggestions} class="mt-6 text-sm font-semibold text-accent">
			Suggest some from this goal
		</button>
	{/if}
	{#if suggestionMessage}
		<p class="mt-3 text-sm text-text-secondary">{suggestionMessage}</p>
	{/if}
	{#if suggestions.length > 0}
		<ul class="mt-6 flex flex-wrap gap-2">
			{#each suggestions as suggestion (suggestion)}
				<li>
					<button
						type="button"
						onclick={() => addSuggestion(suggestion)}
						class="rounded-full border border-border-default px-3 py-1.5 text-sm text-text-secondary hover:border-border-strong hover:text-text-primary"
					>
						{suggestion}
					</button>
				</li>
			{/each}
		</ul>
	{/if}

	<form
		method="POST"
		class="mt-8 space-y-4"
		use:enhance={() => {
			isSubmitting = true;
			return async ({ update }) => {
				await update();
				isSubmitting = false;
			};
		}}
	>
		{#each areas as area, index (index)}
			<div class="rounded-xl border border-border-default bg-surface-raised p-4">
				<label class="text-sm font-medium text-text-primary" for="label-{index}">Focus area</label>
				<input
					id="label-{index}"
					name="focusAreaLabel"
					bind:value={area.label}
					maxlength="200"
					class="mt-2 w-full rounded-[10px] border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary focus:border-border-accent focus:outline-none"
				/>
				<label class="mt-3 block text-sm text-text-secondary" for="desc-{index}">
					Details <span class="text-text-tertiary">optional</span>
				</label>
				<input
					id="desc-{index}"
					name="focusAreaDescription"
					bind:value={area.description}
					maxlength="500"
					class="mt-2 w-full rounded-[10px] border border-border-default bg-surface-base px-3 py-2.5 text-sm text-text-primary focus:border-border-accent focus:outline-none"
				/>
			</div>
		{/each}

		{#if areas.length < MAX_FOCUS_AREAS}
			<button
				type="button"
				onclick={() => (areas = [...areas, { label: '', description: '' }])}
				class="text-sm font-medium text-text-secondary"
			>
				Add another
			</button>
		{/if}

		{#if form?.error}
			<p class="text-sm text-signal-attention">{form.error}</p>
		{/if}

		<button
			type="submit"
			disabled={isSubmitting}
			class="w-full rounded-full bg-accent px-8 py-3.5 text-sm font-semibold text-surface-base disabled:opacity-40"
		>
			{isSubmitting ? 'Saving…' : 'Save focus areas'}
		</button>
	</form>
</section>
