<script lang="ts">
	import { page } from '$app/stores';
	import { Shield } from 'lucide-svelte';
</script>

<svelte:head>
	<title>Error | Forbetra</title>
</svelte:head>

<section
	class="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-4 p-6 text-center"
>
	<div class="pb-2 text-center">
		<p
			class="flex items-center justify-center gap-1.5 text-lg font-bold tracking-[0.02em] text-text-primary italic"
		>
			<Shield class="h-5 w-5 text-accent" />
			forbetra
		</p>
		<p class="text-xs text-text-tertiary">You. And Improved.</p>
	</div>

	<div class="rounded-2xl border border-border-default bg-surface-raised p-8" role="alert">
		<div
			class="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-error-muted"
		>
			<svg class="h-8 w-8 text-error" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path
					stroke-linecap="round"
					stroke-linejoin="round"
					stroke-width="2"
					d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
				/>
			</svg>
		</div>
		{#if $page.status === 404}
			<h1 class="text-2xl font-bold text-text-primary">Page not found</h1>
			<p class="mt-2 text-sm text-text-secondary">This feedback link may be invalid or expired.</p>
		{:else}
			<h1 class="text-2xl font-bold text-text-primary">Something went wrong</h1>
			<p class="mt-2 text-sm text-text-secondary">
				{$page.error?.message ?? 'This feedback link may be invalid or expired.'}
			</p>
		{/if}
		<div class="mt-4 space-y-3">
			<div class="flex items-center justify-center gap-3">
				<button
					onclick={() => window.location.reload()}
					class="rounded-xl bg-accent px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-accent-hover"
				>
					Try Again
				</button>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/stakeholder/invalid"
					class="rounded-xl border border-border-default px-6 py-2.5 text-sm font-semibold text-text-primary transition-all hover:bg-surface-subtle"
				>
					Request a new link
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
			<p class="text-xs text-text-tertiary">
				If this keeps happening, ask the person who invited you to send a fresh link.
			</p>
		</div>
	</div>
</section>
