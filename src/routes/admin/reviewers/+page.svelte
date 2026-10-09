<script lang="ts">
	import type { PageData } from './$types';

	const { data }: { data: PageData } = $props();

	let searchTerm = $state('');

	const filtered = $derived(
		data.reviewers.filter((sh) => {
			if (!searchTerm) return true;
			const q = searchTerm.toLowerCase();
			return (
				sh.name.toLowerCase().includes(q) ||
				sh.email.toLowerCase().includes(q) ||
				(sh.individual?.name ?? '').toLowerCase().includes(q)
			);
		})
	);

	const formatDate = (value: string | Date | null) => {
		if (!value) return 'Never';
		return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium' }).format(new Date(value));
	};
</script>

<svelte:head>
	<title>Reviewers | Forbetra Admin</title>
</svelte:head>

<section class="mx-auto flex max-w-5xl flex-col gap-6 p-6">
	<header>
		<h1 class="text-2xl font-bold text-text-primary">Reviewers ({data.reviewers.length})</h1>
		<p class="text-sm text-text-secondary">All reviewers across all individuals</p>
	</header>

	<div class="flex items-center gap-3">
		<input
			type="search"
			placeholder="Search by reviewer or individual name..."
			class="rounded-lg border border-border-default bg-surface-raised px-3 py-2 text-sm text-text-primary focus:border-accent focus:ring-2 focus:ring-accent/30 focus:outline-none"
			bind:value={searchTerm}
		/>
		<span class="text-xs text-text-tertiary">{filtered.length} shown</span>
	</div>

	<div class="overflow-hidden rounded-lg border border-border-default bg-surface-raised">
		<table class="min-w-full divide-y divide-border-default text-sm">
			<thead
				class="bg-surface-subtle text-left text-xs font-semibold tracking-wide text-text-tertiary uppercase"
			>
				<tr>
					<th class="px-4 py-3">Name</th>
					<th class="px-4 py-3">Email</th>
					<th class="px-4 py-3">Phone</th>
					<th class="px-4 py-3">Relationship</th>
					<th class="px-4 py-3">Individual</th>
					<th class="px-4 py-3">Goal</th>
					<th class="px-4 py-3">Feedback</th>
					<th class="px-4 py-3">Last Feedback</th>
				</tr>
			</thead>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<tbody class="divide-y divide-border-default">
				{#each filtered as sh (sh.id)}
					<tr class="hover:bg-surface-subtle">
						<td class="px-4 py-3 font-medium text-text-primary">{sh.name}</td>
						<td class="px-4 py-3 text-text-secondary">{sh.email}</td>
						<td class="px-4 py-3 text-text-secondary">{sh.phone ?? '--'}</td>
						<td class="px-4 py-3"
							>{sh.attribution === 'COACH' ? 'Coach' : (sh.relationship ?? '--')}</td
						>
						<td class="px-4 py-3">
							<a href="/admin/users/{sh.individual.id}" class="text-accent hover:underline">
								{sh.individual.name ?? sh.individual.email}
							</a>
						</td>
						<td class="px-4 py-3">
							{#if sh.goal}
								<a href="/admin/goals/{sh.goal.id}" class="text-accent hover:underline">
									{sh.goal.title}
								</a>
							{:else}
								--
							{/if}
						</td>
						<td class="px-4 py-3 font-medium">{sh._count.feedback}</td>
						<td class="px-4 py-3 text-text-tertiary">{formatDate(sh.feedback[0]?.submittedAt)}</td>
					</tr>
				{/each}
			</tbody>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</table>
	</div>
</section>
