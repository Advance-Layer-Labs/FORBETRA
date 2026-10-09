<script lang="ts">
	import type { ActionData, PageData } from './$types';

	const { data, form }: { data: PageData; form: ActionData | null } = $props();
</script>

<svelte:head>
	<title>Seed Data | Forbetra Admin</title>
</svelte:head>

<section class="mx-auto flex max-w-3xl flex-col gap-6 p-6">
	<header>
		<h1 class="text-2xl font-bold text-text-primary">Seed Data</h1>
		<p class="text-sm text-text-secondary">Manage test data for the platform</p>
	</header>

	{#if form?.error}
		<div class="rounded border border-border-default bg-error-muted p-3 text-sm text-error">
			{form.error}
		</div>
	{/if}
	{#if form?.cleanSuccess}
		<div class="rounded border border-border-default bg-success-muted p-3 text-sm text-success">
			{form.message}
		</div>
	{/if}

	<!-- Current Seed Status -->
	<div class="rounded-xl border border-border-default bg-surface-raised p-4">
		<h2 class="mb-3 text-sm font-bold tracking-wide text-text-tertiary uppercase">
			Current Seed Data
		</h2>
		{#if data.seedCount.users > 0}
			<div class="mb-3 grid grid-cols-3 gap-3">
				<div class="rounded-lg bg-accent-muted p-3 text-center">
					<p class="text-2xl font-bold text-accent">{data.seedCount.users}</p>
					<p class="text-xs text-accent">Total Seed Users</p>
				</div>
				<div class="rounded-lg bg-accent-muted p-3 text-center">
					<p class="text-2xl font-bold text-accent">{data.seedCount.coaches}</p>
					<p class="text-xs text-accent">Coaches</p>
				</div>
				<div class="rounded-lg bg-success-muted p-3 text-center">
					<p class="text-2xl font-bold text-success">{data.seedCount.individuals}</p>
					<p class="text-xs text-success">Individuals</p>
				</div>
			</div>
			<details class="mt-3">
				<summary
					class="cursor-pointer text-xs font-medium text-text-tertiary hover:text-text-secondary"
				>
					View seed users ({data.seedUsers.length})
				</summary>
				<ul class="mt-2 space-y-1 text-xs">
					{#each data.seedUsers as user (user.id)}
						<li class="flex items-center justify-between rounded bg-surface-raised px-3 py-1.5">
							<span>{user.name ?? 'Unnamed'} ({user.email})</span>
							<span class="rounded bg-surface-subtle px-1.5 py-0.5 text-xs font-semibold uppercase"
								>{user.role}</span
							>
						</li>
					{/each}
				</ul>
			</details>
		{:else}
			<p class="text-sm text-text-tertiary">No seed data in the database.</p>
		{/if}
	</div>

	<!-- Actions -->
	<div class="rounded-xl border border-border-default bg-surface-raised p-4">
		<h2 class="mb-3 text-sm font-bold tracking-wide text-text-tertiary uppercase">Actions</h2>

		<div class="space-y-4">
			<div class="rounded-lg border border-border-default bg-accent-muted p-4">
				<h3 class="font-semibold text-text-primary">Seed Comprehensive Data</h3>
				<p class="mt-1 text-xs text-text-secondary">
					Creates 8 individuals with diverse patterns, 3 coaches, ~24 reviewers, 200+ checkIns, 500+
					feedback entries, and 20+ coach notes.
				</p>
				<p class="mt-2 text-xs text-accent">
					Run from terminal: <code class="rounded bg-accent-muted px-1.5 py-0.5 font-mono"
						>npm run seed:comprehensive</code
					>
				</p>
			</div>

			<div class="rounded-lg border border-border-default bg-warning-muted p-4">
				<h3 class="font-semibold text-text-primary">Seed Basic Test Data</h3>
				<p class="mt-1 text-xs text-text-secondary">
					Creates 1 individual with 12 weeks of data and 3 reviewers (the original seed).
				</p>
				<p class="mt-2 text-xs text-warning">
					Run from terminal: <code class="rounded bg-warning-muted px-1.5 py-0.5 font-mono"
						>npm run seed:test-data</code
					>
				</p>
			</div>

			{#if data.seedCount.users > 0}
				<div class="rounded-lg border border-border-default bg-error-muted p-4">
					<h3 class="font-semibold text-text-primary">Clean Seed Data</h3>
					<p class="mt-1 text-xs text-text-secondary">
						Removes all {data.seedCount.users} seed users and their related data. This cannot be undone.
					</p>
					<form method="post" action="?/clean" class="mt-3">
						<button
							type="submit"
							class="rounded bg-error px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-error/80"
							onclick={(e) => {
								if (!confirm('Delete all seed data? This cannot be undone.')) {
									e.preventDefault();
								}
							}}
						>
							Clean All Seed Data
						</button>
					</form>
				</div>
			{/if}
		</div>
	</div>
</section>
