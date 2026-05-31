<script lang="ts">
	import { Shield } from 'lucide-svelte';
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData | null } = $props();

	let submitting = $state(false);
	let showForm = $state(false);
</script>

<svelte:head>
	<title>Invalid Link | Forbetra</title>
</svelte:head>

<section
	class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
	role="alert"
>
	<!-- Forbetra brand header -->
	<div class="pb-2 text-center">
		<p
			class="flex items-center justify-center gap-1.5 text-lg font-bold tracking-[0.02em] text-text-primary italic"
		>
			<Shield class="h-5 w-5 text-accent" />
			forbetra
		</p>
		<p class="text-xs text-text-tertiary">You. And Improved.</p>
	</div>

	<h1 class="text-2xl font-semibold text-text-primary">This feedback link is no longer valid</h1>
	<p class="text-text-secondary">
		This feedback link may have expired or already been used. If you'd still like to give feedback,
		we can let the person who invited you know.
	</p>

	{#if form && 'success' in form && form.success}
		<div
			class="mt-4 w-full rounded-xl border border-success/30 bg-success-muted px-5 py-4 text-sm text-success"
		>
			{form.message}
		</div>
		<p class="mt-2 text-sm text-text-muted">You can close this tab.</p>
	{:else if !showForm}
		<button
			type="button"
			onclick={() => (showForm = true)}
			class="mt-4 inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
		>
			Request a new link
		</button>
		<p class="mt-2 text-sm text-text-muted">Or you can safely close this tab.</p>
	{:else}
		<form
			method="post"
			action="?/requestNewLink"
			class="mt-4 w-full space-y-3 text-left"
			use:enhance={() => {
				submitting = true;
				return async ({ update }) => {
					submitting = false;
					await update();
				};
			}}
		>
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-text-secondary">Your email</span>
				<input
					type="email"
					name="email"
					required
					autocomplete="email"
					class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
				/>
			</label>
			<label class="block text-sm">
				<span class="mb-1 block font-medium text-text-secondary">Your name (optional)</span>
				<input
					type="text"
					name="name"
					autocomplete="name"
					class="w-full rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:outline-none"
				/>
			</label>
			{#if form && 'error' in form && form.error}
				<p class="text-sm text-error">{form.error}</p>
			{/if}
			<div class="flex items-center gap-2 pt-2">
				<button
					type="submit"
					disabled={submitting}
					class="inline-flex items-center gap-2 rounded-xl bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover disabled:opacity-60"
				>
					{submitting ? 'Sending…' : 'Notify them'}
				</button>
				<button
					type="button"
					onclick={() => (showForm = false)}
					class="text-sm text-text-muted underline-offset-2 hover:underline"
				>
					Cancel
				</button>
			</div>
		</form>
	{/if}
</section>
