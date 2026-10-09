<script lang="ts">
	import { page } from '$app/stores';
	import { AlertTriangle, ArrowLeft, RotateCcw } from 'lucide-svelte';
</script>

<section
	class="mx-auto flex max-w-md flex-col items-center justify-center gap-6 p-4 py-20 text-center"
>
	<div class="flex h-14 w-14 items-center justify-center rounded-full bg-error/10">
		<AlertTriangle class="h-7 w-7 text-error" />
	</div>

	{#if $page.status === 404}
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Page not found</h1>
			<p class="mt-2 text-sm text-text-secondary">
				The page you're looking for doesn't exist or has been moved.
			</p>
		</div>
	{:else}
		<div>
			<h1 class="text-2xl font-bold text-text-primary">Something went wrong</h1>
			<p class="mt-2 text-sm text-text-secondary">
				{$page.error?.message ?? 'An unexpected error occurred. Please try again.'}
			</p>
		</div>
	{/if}

	<div class="flex gap-3">
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/individual/today"
			class="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
		>
			<ArrowLeft class="h-4 w-4" />
			Back to Home
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
		<button
			type="button"
			onclick={() => location.reload()}
			class="inline-flex items-center gap-2 rounded-lg border border-border-default bg-surface-raised px-5 py-2.5 text-sm font-semibold text-text-secondary transition-colors hover:bg-surface-subtle"
		>
			<RotateCcw class="h-4 w-4" />
			Try Again
		</button>
	</div>
</section>
