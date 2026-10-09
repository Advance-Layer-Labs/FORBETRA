<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import { CHART_COLORS } from '$lib/utils/scoreColors';
	import { SvelteSet } from 'svelte/reactivity';

	Chart.register(...registerables);

	interface Props {
		effortGaps: Array<{ weekNumber: number; difference: number }>;
		performanceGaps: Array<{ weekNumber: number; difference: number }>;
		reviewers?: Array<{
			id: string;
			name: string;
			effortGaps: Array<{ weekNumber: number; difference: number }>;
			performanceGaps: Array<{ weekNumber: number; difference: number }>;
		}>;
	}

	const { effortGaps, performanceGaps, reviewers = [] }: Props = $props();

	let effortChartCanvas = $state<HTMLCanvasElement | null>(null);
	let performanceChartCanvas = $state<HTMLCanvasElement | null>(null);
	let effortChartInstance = $state<Chart | null>(null);
	let performanceChartInstance = $state<Chart | null>(null);
	let showEffort = $state(true);
	let showPerformance = $state(true);
	let selectedReviewerId = $state<string | null>(null); // null = "All Reviewers"
	let isMounted = $state(false);

	// Get active gaps based on selected reviewer
	const activeEffortGaps = $derived(
		(() => {
			if (selectedReviewerId === null) {
				return effortGaps;
			}
			const reviewer = reviewers.find((s) => s.id === selectedReviewerId);
			return reviewer?.effortGaps ?? [];
		})()
	);

	const activePerformanceGaps = $derived(
		(() => {
			if (selectedReviewerId === null) {
				return performanceGaps;
			}
			const reviewer = reviewers.find((s) => s.id === selectedReviewerId);
			return reviewer?.performanceGaps ?? [];
		})()
	);

	// Get all unique week numbers
	const allWeeks = $derived(
		(() => {
			const weeks = new SvelteSet<number>();
			activeEffortGaps.forEach((g) => weeks.add(g.weekNumber));
			activePerformanceGaps.forEach((g) => weeks.add(g.weekNumber));
			return Array.from(weeks).sort((a, b) => a - b);
		})()
	);

	// Get selected reviewer name
	const selectedReviewerName = $derived(
		(() => {
			if (selectedReviewerId === null) return 'All Reviewers';
			return reviewers.find((s) => s.id === selectedReviewerId)?.name ?? 'Unknown';
		})()
	);

	const effortChartConfig = $derived(
		(() => {
			if (!showEffort) return null;

			const labels = allWeeks.map((w) => `Week ${w}`);
			const data = allWeeks.map((week) => {
				const gap = activeEffortGaps.find((g) => g.weekNumber === week);
				return gap?.difference ?? null;
			});

			return {
				type: 'line' as const,
				data: {
					labels,
					datasets: [
						{
							label:
								selectedReviewerId === null
									? 'Effort Gap (Self - Reviewers)'
									: `Effort Gap (Self - ${selectedReviewerName})`,
							data,
							borderColor: CHART_COLORS.effort.individual.border,
							backgroundColor: CHART_COLORS.effort.individual.bg,
							borderWidth: 3,
							borderDash: [],
							tension: 0.3,
							pointRadius: 5,
							pointHoverRadius: 7,
							spanGaps: true,
							fill: 'zero' as const
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {
						mode: 'index' as const,
						intersect: false
					},
					plugins: {
						legend: {
							display: false
						},
						tooltip: {
							backgroundColor: '#1c1c20',
							titleColor: '#f4f5f8',
							bodyColor: '#a1a1aa',
							borderColor: 'rgba(255,255,255,0.08)',
							borderWidth: 1,
							padding: 12,
							titleFont: {
								size: 14,
								weight: 600
							},
							bodyFont: {
								size: 13
							},
							callbacks: {
								label: function (context: unknown) {
									const ctx = context as { parsed: { y: number | null } };
									const value = ctx.parsed.y;
									if (value === null) return 'No data';
									const sign = value > 0 ? '+' : '';
									const interpretation =
										value > 0
											? ' (You see higher)'
											: value < 0
												? ' (Reviewers see higher)'
												: ' (Aligned)';
									return `Gap: ${sign}${value.toFixed(1)}${interpretation}`;
								}
							}
						}
					},
					scales: {
						y: {
							type: 'linear' as const,
							position: 'left' as const,
							title: {
								display: true,
								text: 'Difference (Self - Reviewers)',
								color: '#a1a1aa',
								font: {
									size: 12,
									weight: 600
								}
							},
							min: -5,
							max: 5,
							ticks: {
								color: '#a1a1aa',
								stepSize: 1,
								font: {
									size: 11
								},
								callback: function (value: unknown) {
									const num = Number(value);
									if (num === 0) return '0 (Aligned)';
									const sign = num > 0 ? '+' : '';
									return `${sign}${num}`;
								}
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.06)'
							}
						},
						x: {
							title: {
								display: true,
								text: 'Week',
								color: '#a1a1aa',
								font: {
									size: 12,
									weight: 600
								}
							},
							ticks: {
								color: '#a1a1aa',
								font: {
									size: 11
								}
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.06)'
							}
						}
					}
				}
			};
		})()
	);

	const performanceChartConfig = $derived(
		(() => {
			if (!showPerformance) return null;

			const labels = allWeeks.map((w) => `Week ${w}`);
			const data = allWeeks.map((week) => {
				const gap = activePerformanceGaps.find((g) => g.weekNumber === week);
				return gap?.difference ?? null;
			});

			return {
				type: 'line' as const,
				data: {
					labels,
					datasets: [
						{
							label:
								selectedReviewerId === null
									? 'Performance Gap (Self - Reviewers)'
									: `Performance Gap (Self - ${selectedReviewerName})`,
							data,
							borderColor: CHART_COLORS.performance.individual.border,
							backgroundColor: CHART_COLORS.performance.individual.bg,
							borderWidth: 3,
							borderDash: [],
							tension: 0.3,
							pointRadius: 5,
							pointHoverRadius: 7,
							spanGaps: true,
							fill: 'zero' as const
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					interaction: {
						mode: 'index' as const,
						intersect: false
					},
					plugins: {
						legend: {
							display: false
						},
						tooltip: {
							backgroundColor: '#1c1c20',
							titleColor: '#f4f5f8',
							bodyColor: '#a1a1aa',
							borderColor: 'rgba(255,255,255,0.08)',
							borderWidth: 1,
							padding: 12,
							titleFont: {
								size: 14,
								weight: 600
							},
							bodyFont: {
								size: 13
							},
							callbacks: {
								label: function (context: unknown) {
									const ctx = context as { parsed: { y: number | null } };
									const value = ctx.parsed.y;
									if (value === null) return 'No data';
									const sign = value > 0 ? '+' : '';
									const interpretation =
										value > 0
											? ' (You see higher)'
											: value < 0
												? ' (Reviewers see higher)'
												: ' (Aligned)';
									return `Gap: ${sign}${value.toFixed(1)}${interpretation}`;
								}
							}
						}
					},
					scales: {
						y: {
							type: 'linear' as const,
							position: 'left' as const,
							title: {
								display: true,
								text: 'Difference (Self - Reviewers)',
								color: '#a1a1aa',
								font: {
									size: 12,
									weight: 600
								}
							},
							min: -5,
							max: 5,
							ticks: {
								color: '#a1a1aa',
								stepSize: 1,
								font: {
									size: 11
								},
								callback: function (value: unknown) {
									const num = Number(value);
									if (num === 0) return '0 (Aligned)';
									const sign = num > 0 ? '+' : '';
									return `${sign}${num}`;
								}
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.06)'
							}
						},
						x: {
							title: {
								display: true,
								text: 'Week',
								color: '#a1a1aa',
								font: {
									size: 12,
									weight: 600
								}
							},
							ticks: {
								color: '#a1a1aa',
								font: {
									size: 11
								}
							},
							grid: {
								color: 'rgba(255, 255, 255, 0.06)'
							}
						}
					}
				}
			};
		})()
	);

	onMount(() => {
		isMounted = true;
	});

	// Initialize charts when canvas elements are ready
	$effect(() => {
		if (!isMounted) return;

		// Initialize effort chart
		if (showEffort && !effortChartInstance && effortChartCanvas && effortChartConfig) {
			const ctx = effortChartCanvas.getContext('2d');
			if (ctx) {
				effortChartInstance = new Chart(ctx, effortChartConfig);
			}
		}

		// Initialize performance chart
		if (
			showPerformance &&
			!performanceChartInstance &&
			performanceChartCanvas &&
			performanceChartConfig
		) {
			const ctx = performanceChartCanvas.getContext('2d');
			if (ctx) {
				performanceChartInstance = new Chart(ctx, performanceChartConfig);
			}
		}
	});

	// Update effort chart when data changes - only after mount
	$effect(() => {
		if (!isMounted) return;

		// Access reactive dependencies to track them
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _effortGapsData = activeEffortGaps;
		const showEff = showEffort;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _selectedStk1 = selectedReviewerId;

		const config = effortChartConfig;
		const instance = effortChartInstance;

		if (instance && config && showEff) {
			instance.data.labels = config.data.labels;
			instance.data.datasets = config.data.datasets;
			instance.update('none');
		}
	});

	// Update performance chart when data changes - only after mount
	$effect(() => {
		if (!isMounted) return;

		// Access reactive dependencies to track them
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _perfGapsData = activePerformanceGaps;
		const showPerf = showPerformance;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _selectedStk2 = selectedReviewerId;

		const config = performanceChartConfig;
		const instance = performanceChartInstance;

		if (instance && config && showPerf) {
			instance.data.labels = config.data.labels;
			instance.data.datasets = config.data.datasets;
			instance.update('none');
		}
	});

	// Handle showing/hiding charts
	$effect(() => {
		if (!showEffort && effortChartInstance) {
			effortChartInstance.destroy();
			effortChartInstance = null;
		} else if (showEffort && !effortChartInstance && effortChartCanvas && effortChartConfig) {
			const ctx = effortChartCanvas.getContext('2d');
			if (ctx) {
				effortChartInstance = new Chart(ctx, effortChartConfig);
			}
		}

		if (!showPerformance && performanceChartInstance) {
			performanceChartInstance.destroy();
			performanceChartInstance = null;
		} else if (
			showPerformance &&
			!performanceChartInstance &&
			performanceChartCanvas &&
			performanceChartConfig
		) {
			const ctx = performanceChartCanvas.getContext('2d');
			if (ctx) {
				performanceChartInstance = new Chart(ctx, performanceChartConfig);
			}
		}
	});

	onDestroy(() => {
		if (effortChartInstance) {
			effortChartInstance.destroy();
		}
		if (performanceChartInstance) {
			performanceChartInstance.destroy();
		}
	});

	// Calculate current gap values (latest week with data)
	const currentEffortGap = $derived(
		(() => {
			if (activeEffortGaps.length === 0) return null;
			const sorted = [...activeEffortGaps].sort((a, b) => b.weekNumber - a.weekNumber);
			return sorted[0]?.difference ?? null;
		})()
	);

	const currentPerformanceGap = $derived(
		(() => {
			if (activePerformanceGaps.length === 0) return null;
			const sorted = [...activePerformanceGaps].sort((a, b) => b.weekNumber - a.weekNumber);
			return sorted[0]?.difference ?? null;
		})()
	);
</script>

<div class="space-y-4">
	<div>
		<h2 class="text-xl font-bold text-text-primary">Gap Lens</h2>
		<p class="mt-1 text-sm text-text-secondary">
			See the difference between your self-assessment and reviewer observations. Positive values
			mean you see yourself higher; negative means reviewers see you higher. Reveals blind spots.
		</p>
	</div>

	<!-- Controls -->
	<div class="space-y-4">
		<div
			class="flex flex-wrap items-center gap-4 rounded-xl border border-border-default bg-surface-raised p-4"
		>
			<span class="text-xs font-semibold tracking-wide text-text-tertiary uppercase">Show:</span>
			<div class="flex items-center gap-3">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={showEffort}
						class="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
					/>
					<span class="text-sm font-semibold text-text-secondary">Effort Gap</span>
				</label>
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={showPerformance}
						class="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
					/>
					<span class="text-sm font-semibold text-text-secondary">Performance Gap</span>
				</label>
			</div>
		</div>

		{#if reviewers.length > 0}
			<div
				class="flex flex-wrap items-center gap-4 rounded-xl border border-border-default bg-surface-raised p-4"
			>
				<span class="text-xs font-semibold tracking-wide text-text-tertiary uppercase"
					>Filter Reviewer:</span
				>
				<div class="flex flex-wrap items-center gap-2">
					<label class="flex cursor-pointer items-center gap-2">
						<input
							type="radio"
							name="reviewer-filter"
							checked={selectedReviewerId === null}
							onchange={() => (selectedReviewerId = null)}
							class="h-4 w-4 border-border-strong text-accent focus:ring-accent"
						/>
						<span class="text-sm font-medium text-text-secondary">All Reviewers</span>
					</label>
					{#each reviewers as reviewer (reviewer.id)}
						<label class="flex cursor-pointer items-center gap-2">
							<input
								type="radio"
								name="reviewer-filter"
								checked={selectedReviewerId === reviewer.id}
								onchange={() => (selectedReviewerId = reviewer.id)}
								class="h-4 w-4 border-border-strong text-accent focus:ring-accent"
							/>
							<span class="text-sm font-medium text-text-secondary">{reviewer.name}</span>
						</label>
					{/each}
				</div>
			</div>
		{/if}
	</div>

	<!-- Current Gap Indicators -->
	{#if currentEffortGap !== null || currentPerformanceGap !== null}
		<div class="rounded-lg border border-border-default bg-surface-raised p-4">
			<div class="flex gap-6">
				{#if currentEffortGap !== null}
					<div class="flex-1">
						<div class="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
							Current Effort Gap
						</div>
						<div class="mt-1 flex items-baseline gap-2">
							<span class="text-2xl font-bold text-text-primary">
								{currentEffortGap > 0 ? '+' : ''}{currentEffortGap.toFixed(1)}
							</span>
							<span class="text-sm font-medium text-text-secondary">
								{currentEffortGap > 0
									? '(You see higher)'
									: currentEffortGap < 0
										? '(Reviewers see higher)'
										: '(Aligned)'}
							</span>
						</div>
					</div>
				{/if}
				{#if currentPerformanceGap !== null}
					<div
						class="flex-1 {currentEffortGap !== null ? 'border-l border-border-strong pl-6' : ''}"
					>
						<div class="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
							Current Performance Gap
						</div>
						<div class="mt-1 flex items-baseline gap-2">
							<span class="text-2xl font-bold text-text-primary">
								{currentPerformanceGap > 0 ? '+' : ''}{currentPerformanceGap.toFixed(1)}
							</span>
							<span class="text-sm font-medium text-text-secondary">
								{currentPerformanceGap > 0
									? '(You see higher)'
									: currentPerformanceGap < 0
										? '(Reviewers see higher)'
										: '(Aligned)'}
							</span>
						</div>
					</div>
				{/if}
			</div>
			<div class="mt-3 border-t border-border-default pt-3">
				<p class="text-xs text-text-secondary">
					<strong>What this means:</strong> Gap shows the difference between your self-assessment and
					reviewer observations. Positive values mean you rate yourself higher than reviewers see
					you. Negative values mean reviewers see you higher than you see yourself. Values closer to
					zero indicate better alignment. Large gaps reveal potential blind spots in self-awareness.
				</p>
			</div>
		</div>
	{/if}

	<!-- Custom Legend/Key -->
	<div class="rounded-lg border border-border-default bg-surface-raised p-4">
		<div class="mb-2 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
			Gap Lines
		</div>
		<div class="flex flex-wrap gap-6">
			{#if showEffort}
				<div class="flex items-center gap-2">
					<div class="h-1 w-8 rounded-full bg-cyan-500"></div>
					<span class="text-sm font-medium text-text-secondary">
						Effort Gap {selectedReviewerId === null
							? '(Self - Reviewers)'
							: `(Self - ${selectedReviewerName})`}
					</span>
				</div>
			{/if}
			{#if showPerformance}
				<div class="flex items-center gap-2">
					<div class="h-1 w-8 rounded-full bg-amber-500"></div>
					<span class="text-sm font-medium text-text-secondary">
						Performance Gap {selectedReviewerId === null
							? '(Self - Reviewers)'
							: `(Self - ${selectedReviewerName})`}
					</span>
				</div>
			{/if}
		</div>
	</div>

	<!-- Charts -->
	<div class="grid gap-6 md:grid-cols-2">
		{#if showEffort}
			<div class="rounded-xl border border-border-default bg-surface-raised p-6">
				<h3 class="mb-4 text-lg font-semibold text-text-primary">Effort Gap</h3>
				<div class="h-[350px] w-full">
					{#if activeEffortGaps.length >= 2}
						<canvas bind:this={effortChartCanvas}></canvas>
					{:else if activeEffortGaps.length === 1}
						<div class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
							<p class="text-sm font-medium">
								Gap analysis requires reviewer feedback from at least 2 weeks.
							</p>
							<p class="text-xs">You have 1 week so far. Keep going!</p>
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-text-tertiary">
							<p class="text-sm">Not enough data to display effort gap.</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}

		{#if showPerformance}
			<div class="rounded-xl border border-border-default bg-surface-raised p-6">
				<h3 class="mb-4 text-lg font-semibold text-text-primary">Performance Gap</h3>
				<div class="h-[350px] w-full">
					{#if activePerformanceGaps.length >= 2}
						<canvas bind:this={performanceChartCanvas}></canvas>
					{:else if activePerformanceGaps.length === 1}
						<div class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
							<p class="text-sm font-medium">
								Gap analysis requires reviewer feedback from at least 2 weeks.
							</p>
							<p class="text-xs">You have 1 week so far. Keep going!</p>
						</div>
					{:else}
						<div class="flex h-full items-center justify-center text-text-tertiary">
							<p class="text-sm">Not enough data to display performance gap.</p>
						</div>
					{/if}
				</div>
			</div>
		{/if}
	</div>

	{#if (!showEffort && !showPerformance) || (activeEffortGaps.length === 0 && activePerformanceGaps.length === 0)}
		<div class="rounded-xl border border-border-default bg-surface-raised p-6">
			<div class="flex h-[200px] items-center justify-center text-text-tertiary">
				<p>
					Select at least one metric to view the gap analysis, or complete more check-ins and
					reviewer feedback to see data.
				</p>
			</div>
		</div>
	{/if}
</div>
