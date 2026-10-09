<script lang="ts">
	import type { PageData } from './$types';
	import {
		AlertTriangle,
		ChevronRight,
		Mail,
		BarChart3,
		MessageSquare,
		PenLine,
		ShieldCheck,
		Lock
	} from 'lucide-svelte';
	import InfoTip from '$lib/components/InfoTip.svelte';

	const { data }: { data: PageData } = $props();

	const greeting = $derived.by(() => {
		const hour = new Date().getHours();
		if (hour < 12) return 'Good morning';
		if (hour < 17) return 'Good afternoon';
		return 'Good evening';
	});
</script>

<svelte:head>
	<title>Coach Dashboard | Forbetra</title>
</svelte:head>

<section class="mx-auto flex max-w-3xl flex-col gap-5 p-4 pb-12">
	<!-- Header -->
	<div class="anim-slide-up">
		<p class="text-sm text-text-tertiary">{greeting}</p>
		<h1 class="text-2xl font-bold text-text-primary">{data.coach.name}</h1>
		<p class="text-sm text-text-muted">
			{data.rosterSummary.active} active client{data.rosterSummary.active !== 1 ? 's' : ''}
			{#if data.rosterSummary.pendingInvites > 0}
				· {data.rosterSummary.pendingInvites} pending invite{data.rosterSummary.pendingInvites !== 1
					? 's'
					: ''}
			{/if}
		</p>
	</div>

	<!-- Alert Banner -->
	{#if data.atRiskClients.length > 0}
		{@const topClient = data.atRiskClients[0]}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/coach/session/{topClient.id}"
			class="group flex items-center gap-3 rounded-xl border border-warning/30 bg-gradient-to-r from-warning/10 to-transparent p-4 transition-all hover:border-warning/50"
		>
			<AlertTriangle class="h-5 w-5 shrink-0 text-warning" />
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold text-text-primary">{topClient.name} needs attention</p>
				{#if topClient.topAlert}
					<p class="text-xs text-text-secondary">{topClient.topAlert.message}</p>
				{/if}
			</div>
			<ChevronRight
				class="h-4 w-4 shrink-0 text-warning transition-transform group-hover:translate-x-0.5"
			/>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{:else if data.allOnTrack}
		<div class="rounded-xl border border-success/20 bg-success/5 px-4 py-3 text-sm text-success">
			<p class="text-center font-medium">
				{#if data.portfolio.feedbackRate !== null && data.portfolio.feedbackRate >= 90}
					Excellent week — all clients on track, {data.portfolio.feedbackRate}% reviewer engagement
				{:else if data.portfolio.avgCompletion !== null && data.portfolio.avgCompletion >= 80}
					Strong momentum — all clients on track with {data.portfolio.avgCompletion}% avg completion
				{:else}
					All clients on track — your coaching is making a difference
				{/if}
			</p>
			<p class="mt-1 text-center text-xs text-success/70">
				{data.rosterSummary.active} active client{data.rosterSummary.active !== 1 ? 's' : ''}
				{#if data.portfolio.feedbackRate !== null && data.portfolio.feedbackRate >= 80}
					· {data.portfolio.feedbackRate}% reviewer response rate
				{/if}
				{#if data.portfolio.reflectionsThisWeek > 0}
					· {data.portfolio.reflectionsThisWeek} check-in{data.portfolio.reflectionsThisWeek !== 1
						? 's'
						: ''} this week
				{/if}
			</p>
		</div>
	{/if}

	<!-- Portfolio Metrics -->
	{#if data.rosterSummary.active > 0}
		<div class="anim-slide-up grid grid-cols-1 gap-3 sm:grid-cols-3" style="animation-delay: 50ms">
			<div class="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
				<div class="flex items-center justify-center gap-1.5 text-text-muted">
					<BarChart3 class="h-3.5 w-3.5" />
					<p class="text-2xs font-semibold tracking-wider uppercase">
						Avg Progress <InfoTip text="Average journey completion across active clients" />
					</p>
				</div>
				<p class="mt-1 text-xl font-bold text-text-primary tabular-nums">
					{data.portfolio.avgCompletion !== null ? `${data.portfolio.avgCompletion}%` : '—'}
				</p>
			</div>
			<div class="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
				<div class="flex items-center justify-center gap-1.5 text-text-muted">
					<MessageSquare class="h-3.5 w-3.5" />
					<p class="text-2xs font-semibold tracking-wider uppercase">
						Feedback Rate <InfoTip
							text="How often reviewers respond to feedback requests. 80%+ means strong engagement."
						/>
					</p>
				</div>
				<p class="mt-1 text-xl font-bold text-text-primary tabular-nums">
					{data.portfolio.feedbackRate !== null ? `${data.portfolio.feedbackRate}%` : '—'}
				</p>
			</div>
			<div class="rounded-xl border border-border-default bg-surface-raised p-4 text-center">
				<div class="flex items-center justify-center gap-1.5 text-text-muted">
					<PenLine class="h-3.5 w-3.5" />
					<p class="text-2xs font-semibold tracking-wider uppercase">
						Check-ins <InfoTip
							text="Total client self-checkIns submitted this week across your portfolio"
						/>
					</p>
				</div>
				<p class="mt-1 text-xl font-bold text-text-primary tabular-nums">
					{data.portfolio.reflectionsThisWeek}
				</p>
				<p class="text-2xs text-text-muted">this week</p>
			</div>
		</div>
	{/if}

	<!-- Portfolio Milestone -->
	{#if data.rosterSummary.active >= 2 && data.portfolio.avgCompletion !== null && data.portfolio.avgCompletion > 0}
		<div
			class="anim-slide-up flex items-center gap-3 rounded-xl border border-accent/15 bg-accent/5 px-4 py-3"
			style="animation-delay: 100ms"
		>
			<div
				class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent"
			>
				{data.rosterSummary.active}
			</div>
			<p class="text-xs text-text-secondary">
				{#if data.portfolio.avgCompletion >= 75}
					Your clients are averaging {data.portfolio.avgCompletion}% completion — strong coaching
					momentum.
				{:else if data.portfolio.avgCompletion >= 50}
					{data.rosterSummary.active} active clients at {data.portfolio.avgCompletion}% avg
					completion — building steady progress.
				{:else}
					{data.rosterSummary.active} active clients — early in their journeys. Your guidance is setting
					the foundation.
				{/if}
			</p>
		</div>
	{/if}

	<!-- Client List -->
	<div class="anim-slide-up space-y-3" style="animation-delay: 150ms">
		<h2 class="text-sm font-semibold text-text-secondary">Your Clients</h2>
		{#if data.rosterSummary.active === 0}
			<div class="rounded-xl border border-border-default bg-surface-raised p-8 text-center">
				<p class="text-text-secondary">No clients yet. Invite your first client to get started.</p>
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href="/coach/invitations"
					class="mt-3 inline-block rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-accent-hover"
				>
					Send an Invitation
				</a>
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</div>
			<div class="rounded-xl border border-border-default bg-surface-subtle p-5">
				<p class="text-xs font-semibold text-text-primary">What you'll see once a client joins</p>
				<div class="mt-3 space-y-2">
					<div class="flex items-start gap-2 text-xs text-text-secondary">
						<BarChart3 class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
						<span>Real-time effort and performance scores — self-rated and reviewer-rated</span>
					</div>
					<div class="flex items-start gap-2 text-xs text-text-secondary">
						<MessageSquare class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
						<span>AI coaching prep generated before every session, tailored to each client</span>
					</div>
					<div class="flex items-start gap-2 text-xs text-text-secondary">
						<AlertTriangle class="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
						<span>Automatic alerts when a client misses check-ins or trends downward</span>
					</div>
				</div>
			</div>
		{:else}
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			{#each data.atRiskClients as client (client.id)}
				<a
					href="/coach/session/{client.id}"
					class="group flex items-center justify-between rounded-xl border border-warning/20 bg-surface-raised p-4 transition-all hover:border-accent/30"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<p class="font-medium text-text-primary">{client.name}</p>
							<span
								class="text-2xs rounded-full bg-warning/10 px-2 py-0.5 font-semibold text-warning"
								>Needs attention</span
							>
						</div>
						{#if client.goal}
							<p class="text-sm text-text-muted">{client.goal}</p>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						{#if client.trajectory !== null}
							<span
								class="text-xs tabular-nums {client.trajectory > 0
									? 'text-success'
									: client.trajectory < 0
										? 'text-warning'
										: 'text-text-muted'}"
							>
								{client.trajectory > 0 ? '↑' : client.trajectory < 0 ? '↓' : '→'}
							</span>
						{/if}
						{#if client.completionPct !== null}
							<span class="text-xs text-text-muted tabular-nums">{client.completionPct}%</span>
						{/if}
						<ChevronRight
							class="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5"
						/>
					</div>
				</a>
			{/each}
			{#each data.healthyClients as client (client.id)}
				<a
					href="/coach/session/{client.id}"
					class="group flex items-center justify-between rounded-xl border border-border-default bg-surface-raised p-4 transition-all hover:border-accent/30"
				>
					<div class="min-w-0 flex-1">
						<div class="flex items-center gap-2">
							<p class="font-medium text-text-primary">{client.name}</p>
							{#if client.trajectory !== null && client.trajectory > 5}
								<span
									class="text-2xs rounded-full bg-success/10 px-2 py-0.5 font-semibold text-success"
									>Improving</span
								>
							{:else if client.completionPct !== null && client.completionPct >= 75}
								<span
									class="text-2xs rounded-full bg-accent/10 px-2 py-0.5 font-semibold text-accent"
									>Strong</span
								>
							{/if}
						</div>
						{#if client.goal}
							<p class="text-sm text-text-muted">{client.goal}</p>
						{/if}
					</div>
					<div class="flex items-center gap-3">
						{#if client.trajectory !== null}
							<span
								class="text-xs tabular-nums {client.trajectory > 0
									? 'text-success'
									: client.trajectory < 0
										? 'text-warning'
										: 'text-text-muted'}"
							>
								{client.trajectory > 0 ? '↑' : client.trajectory < 0 ? '↓' : '→'}
							</span>
						{/if}
						{#if client.completionPct !== null}
							<span class="text-xs text-text-muted tabular-nums">{client.completionPct}%</span>
						{/if}
						<ChevronRight
							class="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5"
						/>
					</div>
				</a>
			{/each}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		{/if}
	</div>

	<!-- First-time coach guidance (shown when portfolio has no data yet) -->
	{#if data.rosterSummary.active > 0 && data.portfolio.avgCompletion === null && data.portfolio.reflectionsThisWeek === 0}
		<div class="rounded-xl border border-accent/20 bg-accent/5 p-4">
			<p class="text-sm font-semibold text-text-primary">What happens next</p>
			<div class="mt-2 space-y-2">
				<div class="flex items-start gap-2 text-xs text-text-secondary">
					<span
						class="text-2xs mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-white"
						>1</span
					>
					<span
						>Your clients complete their weekly check-ins (effort + performance self-ratings)</span
					>
				</div>
				<div class="flex items-start gap-2 text-xs text-text-secondary">
					<span
						class="text-2xs mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/70 font-bold text-white"
						>2</span
					>
					<span>Their reviewers provide 360 feedback — perception gaps become visible</span>
				</div>
				<div class="flex items-start gap-2 text-xs text-text-secondary">
					<span
						class="text-2xs mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/50 font-bold text-white"
						>3</span
					>
					<span
						>AI generates coaching prep before each session — tailored to each client's data</span
					>
				</div>
			</div>
			<p class="text-2xs mt-2 text-text-muted">
				Alerts and insights will appear here as data flows in.
			</p>
		</div>
	{/if}

	<!-- Analytics CTA -->
	{#if data.rosterSummary.active > 0}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/coach/analytics"
			class="group flex items-center gap-3 rounded-xl border border-border-default bg-surface-raised p-4 transition-all hover:border-accent/30"
		>
			<div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent/10">
				<BarChart3 class="h-4 w-4 text-accent" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="text-sm font-semibold text-text-primary">Portfolio Analytics</p>
				<p class="text-xs text-text-secondary">
					Consistency trends, alerts, and cross-client patterns.
				</p>
			</div>
			<ChevronRight
				class="h-4 w-4 text-text-muted transition-transform group-hover:translate-x-0.5"
			/>
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}

	<!-- Invite CTA -->
	{#if data.rosterSummary.active < 3}
		<!-- eslint-disable svelte/no-navigation-without-resolve -->
		<a
			href="/coach/invitations"
			class="group flex items-center gap-3 rounded-xl border border-accent/30 bg-accent-muted p-5 transition-all hover:border-accent/50"
		>
			<div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15">
				<Mail class="h-5 w-5 text-accent" />
			</div>
			<div class="min-w-0 flex-1">
				<p class="font-semibold text-text-primary">Invite a client</p>
				<p class="text-sm text-text-secondary">Send a coaching invitation to get started.</p>
			</div>
			<ChevronRight class="h-4 w-4 text-accent transition-transform group-hover:translate-x-0.5" />
		</a>
		<!-- eslint-enable svelte/no-navigation-without-resolve -->
	{/if}

	<!-- Trust & Security -->
	<div class="rounded-xl border border-border-default bg-surface-raised px-5 py-4">
		<div class="mb-2 flex items-center gap-2">
			<ShieldCheck class="h-4 w-4 text-success" />
			<p class="text-xs font-semibold text-text-secondary">Client data is protected</p>
		</div>
		<div class="grid grid-cols-1 gap-2 sm:grid-cols-3">
			<div class="flex items-center gap-2">
				<Lock class="h-3 w-3 shrink-0 text-text-muted" />
				<p class="text-xs text-text-tertiary">Encrypted in transit and at rest</p>
			</div>
			<div class="flex items-center gap-2">
				<ShieldCheck class="h-3 w-3 shrink-0 text-text-muted" />
				<p class="text-xs text-text-tertiary">Only you and your client see their data</p>
			</div>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<a href="/privacy" class="group flex items-center gap-2">
				<Lock class="h-3 w-3 shrink-0 text-text-muted" />
				<p class="text-xs text-text-tertiary group-hover:text-text-secondary group-hover:underline">
					Enterprise-grade security &amp; privacy
				</p>
			</a>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>
	</div>
</section>
