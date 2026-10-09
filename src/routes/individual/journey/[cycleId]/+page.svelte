<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables, type ChartConfiguration } from 'chart.js';
	import { CHART_COLORS } from '$lib/utils/scoreColors';
	import { ArrowLeft, Quote, Sparkles, TrendingUp, Users } from 'lucide-svelte';

	Chart.register(...registerables);

	const { data } = $props();
	const { story, firstName } = data;

	let chartCanvas: HTMLCanvasElement | undefined = $state();
	let chartInstance: Chart | null = null;

	function buildChart(canvas: HTMLCanvasElement) {
		const labels = story.scores.map((s) => `Week ${s.weekNumber}`);
		const effortData = story.scores.map((s) => s.effort);
		const performanceData = story.scores.map((s) => s.performance);

		const config: ChartConfiguration = {
			type: 'line',
			data: {
				labels,
				datasets: [
					{
						label: 'Effort',
						data: effortData,
						borderColor: CHART_COLORS.effort.individual.border,
						backgroundColor: CHART_COLORS.effort.individual.bg,
						borderWidth: 2,
						tension: 0.3,
						fill: true,
						spanGaps: true,
						pointRadius: 4,
						pointHoverRadius: 6
					},
					{
						label: 'Performance',
						data: performanceData,
						borderColor: CHART_COLORS.performance.individual.border,
						backgroundColor: CHART_COLORS.performance.individual.bg,
						borderWidth: 2,
						tension: 0.3,
						fill: true,
						spanGaps: true,
						pointRadius: 4,
						pointHoverRadius: 6
					}
				]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'bottom',
						labels: { usePointStyle: true, padding: 16 }
					}
				},
				scales: {
					y: {
						min: 0,
						max: 10,
						ticks: { stepSize: 2 },
						grid: { color: 'rgba(255,255,255,0.06)' }
					},
					x: {
						grid: { display: false }
					}
				}
			}
		};

		return new Chart(canvas, config);
	}

	onMount(() => {
		if (chartCanvas) {
			chartInstance = buildChart(chartCanvas);
		}
	});

	onDestroy(() => {
		chartInstance?.destroy();
	});

	function formatChange(value: number | null): string {
		if (value === null) return '--';
		return value > 0 ? `+${value}` : `${value}`;
	}

	function changeColor(value: number | null): string {
		if (value === null) return 'text-text-muted';
		if (value > 0) return 'text-success';
		if (value < 0) return 'text-danger';
		return 'text-text-secondary';
	}
</script>

<svelte:head>
	<title>{firstName}'s Growth Story — Forbetra</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-4 py-8">
	<!-- eslint-disable svelte/no-navigation-without-resolve -->
	<!-- Back link -->
	<a
		href="/individual"
		class="mb-6 inline-flex items-center gap-1.5 text-sm text-text-secondary transition-colors hover:text-text-primary"
	>
		<ArrowLeft class="h-4 w-4" /> Back to journeys
	</a>

	<!-- Header -->
	<div class="mb-8 text-center">
		<h1 class="text-2xl font-bold text-text-primary">{firstName}'s Growth Story</h1>
		<p class="mt-2 text-lg font-medium text-accent">"{story.goalTitle}"</p>
		<div class="mt-3 flex flex-wrap justify-center gap-3 text-sm text-text-secondary">
			<span class="rounded-full bg-surface-subtle px-3 py-1">
				{story.durationWeeks} week{story.durationWeeks !== 1 ? 's' : ''}
			</span>
			<span class="rounded-full bg-surface-subtle px-3 py-1">
				{story.checkInCount} check-in{story.checkInCount !== 1 ? 's' : ''}
			</span>
			<span class="rounded-full bg-surface-subtle px-3 py-1">
				{story.raterCount} reviewer{story.raterCount !== 1 ? 's' : ''}
			</span>
		</div>
	</div>

	<!-- Progress Chart -->
	{#if story.scores.length > 0}
		<section class="mb-8 rounded-2xl border border-border-default bg-surface-raised p-5">
			<div class="mb-3 flex items-center gap-2">
				<TrendingUp class="h-5 w-5 text-accent" />
				<h2 class="text-lg font-semibold text-text-primary">Your Progress</h2>
			</div>
			<div class="h-64">
				<canvas bind:this={chartCanvas}></canvas>
			</div>
			<div class="mt-4 grid grid-cols-2 gap-4">
				<div class="rounded-xl bg-surface-subtle px-4 py-3">
					<p class="text-2xs font-semibold tracking-wider text-text-muted uppercase">Effort</p>
					<p class="text-lg font-bold text-text-primary tabular-nums">
						{story.effortStart ?? '--'} &rarr; {story.effortEnd ?? '--'}
					</p>
					<p class="text-sm font-medium {changeColor(story.effortChange)} tabular-nums">
						{formatChange(story.effortChange)}
					</p>
				</div>
				<div class="rounded-xl bg-surface-subtle px-4 py-3">
					<p class="text-2xs font-semibold tracking-wider text-text-muted uppercase">Performance</p>
					<p class="text-lg font-bold text-text-primary tabular-nums">
						{story.performanceStart ?? '--'} &rarr; {story.performanceEnd ?? '--'}
					</p>
					<p class="text-sm font-medium {changeColor(story.performanceChange)} tabular-nums">
						{formatChange(story.performanceChange)}
					</p>
				</div>
			</div>
		</section>
	{/if}

	<!-- Key Moments -->
	{#if story.keyMoments.length > 0}
		<section class="mb-8 rounded-2xl border border-border-default bg-surface-raised p-5">
			<div class="mb-3 flex items-center gap-2">
				<Sparkles class="h-5 w-5 text-accent" />
				<h2 class="text-lg font-semibold text-text-primary">Key Moments</h2>
			</div>
			<ul class="space-y-3">
				{#each story.keyMoments as moment (moment.weekNumber)}
					<li class="flex items-start gap-3">
						<span
							class="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent/10 text-xs font-bold text-accent"
						>
							{moment.weekNumber}
						</span>
						<p class="text-sm text-text-secondary">{moment.description}</p>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<!-- What Your Reviewers Said -->
	{#if story.topComments.length > 0}
		<section class="mb-8 rounded-2xl border border-border-default bg-surface-raised p-5">
			<div class="mb-3 flex items-center gap-2">
				<Users class="h-5 w-5 text-accent" />
				<h2 class="text-lg font-semibold text-text-primary">What Your Reviewers Said</h2>
			</div>
			<div class="space-y-4">
				{#each story.topComments as comment (comment.raterName + comment.weekNumber)}
					<blockquote
						class="rounded-xl border-l-2 border-accent/30 bg-surface-subtle py-3 pr-4 pl-4"
					>
						<div class="mb-1 flex items-start gap-2">
							<Quote class="mt-0.5 h-4 w-4 shrink-0 text-accent/50" />
							<p class="text-sm text-text-primary italic">{comment.comment}</p>
						</div>
						<p class="mt-2 pl-6 text-xs text-text-muted">
							— {comment.raterName}, Week {comment.weekNumber}
						</p>
					</blockquote>
				{/each}
			</div>
		</section>
	{/if}

	<!-- Identity Anchor -->
	{#if story.identityAnchor}
		<section class="mb-8 rounded-2xl border border-accent/20 bg-accent/5 p-5 text-center">
			<p class="mb-2 text-sm font-medium tracking-wider text-accent uppercase">
				Your Identity Anchor
			</p>
			<p class="text-lg text-text-primary italic">"{story.identityAnchor}"</p>
		</section>
	{/if}
</div>
