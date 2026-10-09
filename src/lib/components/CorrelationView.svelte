<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Chart, registerables } from 'chart.js';
	import { SvelteMap } from 'svelte/reactivity';

	Chart.register(...registerables);

	interface Props {
		individualData: Array<{ effort: number; progress: number; weekNumber: number }>;
		reviewerData: Array<{
			effort: number;
			progress: number;
			weekNumber: number;
			reviewerName: string;
		}>;
	}

	const { individualData, reviewerData }: Props = $props();

	let chartCanvas = $state<HTMLCanvasElement | null>(null);
	let chartInstance = $state<Chart | null>(null);
	let showReviewers = $state(true);
	let showIndividualReviewers = $state(false);
	let isMounted = $state(false);

	// Calculate Pearson correlation coefficient
	function calculateCorrelation(
		effortValues: number[],
		performanceValues: number[]
	): number | null {
		if (effortValues.length !== performanceValues.length || effortValues.length < 2) {
			return null;
		}

		const n = effortValues.length;
		const sumX = effortValues.reduce((sum, val) => sum + val, 0);
		const sumY = performanceValues.reduce((sum, val) => sum + val, 0);
		const sumXY = effortValues.reduce((sum, val, i) => sum + val * performanceValues[i], 0);
		const sumX2 = effortValues.reduce((sum, val) => sum + val * val, 0);
		const sumY2 = performanceValues.reduce((sum, val) => sum + val * val, 0);

		const numerator = n * sumXY - sumX * sumY;
		const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

		if (denominator === 0) return null;

		return numerator / denominator;
	}

	// Calculate linear regression line for correlation visualization
	function calculateRegressionLine(
		effortValues: number[],
		performanceValues: number[]
	): Array<{ x: number; y: number }> | null {
		if (effortValues.length !== performanceValues.length || effortValues.length < 2) {
			return null;
		}

		const n = effortValues.length;
		const sumX = effortValues.reduce((sum, val) => sum + val, 0);
		const sumY = performanceValues.reduce((sum, val) => sum + val, 0);
		const sumXY = effortValues.reduce((sum, val, i) => sum + val * performanceValues[i], 0);
		const sumX2 = effortValues.reduce((sum, val) => sum + val * val, 0);

		const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
		const intercept = (sumY - slope * sumX) / n;

		const minX = Math.min(...effortValues);
		const maxX = Math.max(...effortValues);

		return [
			{ x: minX, y: slope * minX + intercept },
			{ x: maxX, y: slope * maxX + intercept }
		];
	}

	// Prepare data organized by week
	const weeklyData = $derived(
		(() => {
			const weeksMap = new SvelteMap<
				number,
				{
					weekNumber: number;
					individualEffort: number | null;
					individualPerformance: number | null;
					reviewerEfforts: number[];
					reviewerPerformances: number[];
				}
			>();

			// Add individual data
			individualData.forEach((d) => {
				if (!weeksMap.has(d.weekNumber)) {
					weeksMap.set(d.weekNumber, {
						weekNumber: d.weekNumber,
						individualEffort: null,
						individualPerformance: null,
						reviewerEfforts: [],
						reviewerPerformances: []
					});
				}
				const week = weeksMap.get(d.weekNumber)!;
				week.individualEffort = d.effort;
				week.individualPerformance = d.progress;
			});

			// Add reviewer data
			reviewerData.forEach((d) => {
				if (!weeksMap.has(d.weekNumber)) {
					weeksMap.set(d.weekNumber, {
						weekNumber: d.weekNumber,
						individualEffort: null,
						individualPerformance: null,
						reviewerEfforts: [],
						reviewerPerformances: []
					});
				}
				const week = weeksMap.get(d.weekNumber)!;
				week.reviewerEfforts.push(d.effort);
				week.reviewerPerformances.push(d.progress);
			});

			return Array.from(weeksMap.values()).sort((a, b) => a.weekNumber - b.weekNumber);
		})()
	);

	// Calculate correlation coefficients
	const individualCorrelation = $derived(
		(() => {
			const effortValues: number[] = [];
			const performanceValues: number[] = [];

			individualData
				.sort((a, b) => a.weekNumber - b.weekNumber)
				.forEach((d) => {
					effortValues.push(d.effort);
					performanceValues.push(d.progress);
				});

			return calculateCorrelation(effortValues, performanceValues);
		})()
	);

	const reviewerCorrelation = $derived(
		(() => {
			if (!showReviewers || reviewerData.length === 0) return null;

			const effortValues: number[] = [];
			const performanceValues: number[] = [];

			// Calculate average for each week
			const weekAverages = new SvelteMap<number, { effort: number[]; performance: number[] }>();
			reviewerData.forEach((d) => {
				if (!weekAverages.has(d.weekNumber)) {
					weekAverages.set(d.weekNumber, { effort: [], performance: [] });
				}
				const week = weekAverages.get(d.weekNumber)!;
				week.effort.push(d.effort);
				week.performance.push(d.progress);
			});

			Array.from(weekAverages.entries())
				.sort((a, b) => a[0] - b[0])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.forEach(([_weekNumber, data]) => {
					const avgEffort = data.effort.reduce((sum, val) => sum + val, 0) / data.effort.length;
					const avgPerformance =
						data.performance.reduce((sum, val) => sum + val, 0) / data.performance.length;
					effortValues.push(avgEffort);
					performanceValues.push(avgPerformance);
				});

			return calculateCorrelation(effortValues, performanceValues);
		})()
	);

	// Calculate correlation lines (must be before chartConfig)
	const individualCorrelationLine = $derived(
		(() => {
			const effortValues: number[] = [];
			const performanceValues: number[] = [];

			individualData
				.sort((a, b) => a.weekNumber - b.weekNumber)
				.forEach((d) => {
					effortValues.push(d.effort);
					performanceValues.push(d.progress);
				});

			return calculateRegressionLine(effortValues, performanceValues);
		})()
	);

	const reviewerCorrelationLine = $derived(
		(() => {
			if (!showReviewers || reviewerData.length === 0) return null;

			const effortValues: number[] = [];
			const performanceValues: number[] = [];

			// Calculate average for each week
			const weekAverages = new SvelteMap<number, { effort: number[]; performance: number[] }>();
			reviewerData.forEach((d) => {
				if (!weekAverages.has(d.weekNumber)) {
					weekAverages.set(d.weekNumber, { effort: [], performance: [] });
				}
				const week = weekAverages.get(d.weekNumber)!;
				week.effort.push(d.effort);
				week.performance.push(d.progress);
			});

			Array.from(weekAverages.entries())
				.sort((a, b) => a[0] - b[0])
				// eslint-disable-next-line @typescript-eslint/no-unused-vars
				.forEach(([_weekNumber, data]) => {
					const avgEffort = data.effort.reduce((sum, val) => sum + val, 0) / data.effort.length;
					const avgPerformance =
						data.performance.reduce((sum, val) => sum + val, 0) / data.performance.length;
					effortValues.push(avgEffort);
					performanceValues.push(avgPerformance);
				});

			return calculateRegressionLine(effortValues, performanceValues);
		})()
	);

	const chartConfig = $derived(
		(() => {
			const allWeeks = weeklyData.map((w) => w.weekNumber);
			const labels = allWeeks.map((w) => `Week ${w}`);
			// eslint-disable-next-line @typescript-eslint/no-explicit-any
			const datasets: any[] = [];

			// Individual effort line (more transparent/dotted)
			datasets.push({
				label: 'My Effort',
				data: allWeeks.map((week) => {
					const weekData = weeklyData.find((w) => w.weekNumber === week);
					return weekData?.individualEffort ?? null;
				}),
				borderColor: 'rgba(217, 119, 6, 0.5)',
				backgroundColor: 'rgba(217, 119, 6, 0.05)',
				borderWidth: 2,
				borderDash: [5, 5],
				tension: 0.3,
				pointRadius: 4,
				pointHoverRadius: 6,
				spanGaps: true,
				yAxisID: 'y'
			});

			// Individual performance line (more transparent/dotted)
			datasets.push({
				label: 'My Performance',
				data: allWeeks.map((week) => {
					const weekData = weeklyData.find((w) => w.weekNumber === week);
					return weekData?.individualPerformance ?? null;
				}),
				borderColor: 'rgba(79, 70, 229, 0.5)',
				backgroundColor: 'rgba(79, 70, 229, 0.05)',
				borderWidth: 2,
				borderDash: [5, 5],
				tension: 0.3,
				pointRadius: 4,
				pointHoverRadius: 6,
				spanGaps: true,
				yAxisID: 'y'
			});

			// Individual correlation line (solid and prominent)
			if (
				individualCorrelation !== null &&
				individualCorrelationLine &&
				individualCorrelationLine.length === 2
			) {
				// Calculate slope and intercept from correlation line
				const dx = individualCorrelationLine[1].x - individualCorrelationLine[0].x;
				const dy = individualCorrelationLine[1].y - individualCorrelationLine[0].y;

				if (Math.abs(dx) > 0.0001) {
					const slope = dy / dx;
					const intercept = individualCorrelationLine[0].y - slope * individualCorrelationLine[0].x;

					// Show predicted performance based on effort for each week
					datasets.push({
						label: 'My Correlation',
						data: allWeeks.map((week) => {
							const weekData = weeklyData.find((w) => w.weekNumber === week);
							if (
								weekData &&
								weekData.individualEffort !== null &&
								weekData.individualEffort !== undefined
							) {
								// Predicted performance = slope * effort + intercept
								return slope * weekData.individualEffort + intercept;
							}
							return null;
						}),
						borderColor: 'rgb(217, 119, 6)',
						backgroundColor: 'transparent',
						borderWidth: 3,
						borderDash: [],
						tension: 0.3,
						pointRadius: 0,
						spanGaps: true,
						yAxisID: 'y',
						order: -1
					});
				}
			}

			// Reviewer average lines
			if (showReviewers && reviewerData.length > 0) {
				// Calculate averages per week
				const reviewerAveragesByWeek = weeklyData.map((week) => {
					const avgEffort =
						week.reviewerEfforts.length > 0
							? week.reviewerEfforts.reduce((sum, val) => sum + val, 0) /
								week.reviewerEfforts.length
							: null;
					const avgPerformance =
						week.reviewerPerformances.length > 0
							? week.reviewerPerformances.reduce((sum, val) => sum + val, 0) /
								week.reviewerPerformances.length
							: null;
					return { weekNumber: week.weekNumber, avgEffort, avgPerformance };
				});

				datasets.push({
					label: 'Reviewers Effort (Avg)',
					data: allWeeks.map((week) => {
						const weekData = reviewerAveragesByWeek.find((w) => w.weekNumber === week);
						return weekData?.avgEffort ?? null;
					}),
					borderColor: 'rgba(245, 158, 11, 0.5)',
					backgroundColor: 'rgba(245, 158, 11, 0.05)',
					borderWidth: 2,
					tension: 0.3,
					pointRadius: 3,
					pointHoverRadius: 5,
					borderDash: [5, 5],
					spanGaps: true,
					yAxisID: 'y'
				});

				datasets.push({
					label: 'Reviewers Performance (Avg)',
					data: allWeeks.map((week) => {
						const weekData = reviewerAveragesByWeek.find((w) => w.weekNumber === week);
						return weekData?.avgPerformance ?? null;
					}),
					borderColor: 'rgba(99, 102, 241, 0.5)',
					backgroundColor: 'rgba(99, 102, 241, 0.05)',
					borderWidth: 2,
					tension: 0.3,
					pointRadius: 3,
					pointHoverRadius: 5,
					borderDash: [5, 5],
					spanGaps: true,
					yAxisID: 'y'
				});

				// Reviewer correlation line (solid and prominent)
				if (
					reviewerCorrelation !== null &&
					reviewerCorrelationLine &&
					reviewerCorrelationLine.length === 2
				) {
					const dx = reviewerCorrelationLine[1].x - reviewerCorrelationLine[0].x;
					const dy = reviewerCorrelationLine[1].y - reviewerCorrelationLine[0].y;

					if (Math.abs(dx) > 0.0001) {
						const slope = dy / dx;
						const intercept =
							reviewerCorrelationLine[0].y - slope * reviewerCorrelationLine[0].x;

						datasets.push({
							label: 'Reviewers Correlation',
							data: allWeeks.map((week) => {
								const weekData = reviewerAveragesByWeek.find((w) => w.weekNumber === week);
								if (weekData && weekData.avgEffort !== null && weekData.avgEffort !== undefined) {
									// Predicted performance = slope * effort + intercept
									return slope * weekData.avgEffort + intercept;
								}
								return null;
							}),
							borderColor: 'rgb(99, 102, 241)',
							backgroundColor: 'transparent',
							borderWidth: 3,
							borderDash: [],
							tension: 0.3,
							pointRadius: 0,
							spanGaps: true,
							yAxisID: 'y',
							order: -1
						});
					}
				}

				// Individual reviewer lines (optional)
				if (showIndividualReviewers) {
					const reviewerGroups = new SvelteMap<
						string,
						Array<{ weekNumber: number; effort: number; performance: number }>
					>();
					reviewerData.forEach((d) => {
						if (!reviewerGroups.has(d.reviewerName)) {
							reviewerGroups.set(d.reviewerName, []);
						}
						reviewerGroups.get(d.reviewerName)!.push({
							weekNumber: d.weekNumber,
							effort: d.effort,
							performance: d.progress
						});
					});

					const colors = [
						{ effort: 'rgb(34, 197, 94)', performance: 'rgba(34, 197, 94, 0.6)' },
						{ effort: 'rgb(251, 146, 60)', performance: 'rgba(251, 146, 60, 0.6)' },
						{ effort: 'rgb(168, 85, 247)', performance: 'rgba(168, 85, 247, 0.6)' },
						{ effort: 'rgb(236, 72, 153)', performance: 'rgba(236, 72, 153, 0.6)' }
					];

					let colorIndex = 0;
					reviewerGroups.forEach((points, reviewerName) => {
						const color = colors[colorIndex % colors.length];

						// Effort line for this reviewer
						datasets.push({
							label: `${reviewerName} (Effort)`,
							data: allWeeks.map((week) => {
								const point = points.find((p) => p.weekNumber === week);
								return point?.effort ?? null;
							}),
							borderColor: color.effort,
							backgroundColor: color.performance,
							borderWidth: 1.5,
							tension: 0.3,
							pointRadius: 3,
							pointHoverRadius: 5,
							spanGaps: true,
							yAxisID: 'y'
						});

						// Performance line for this reviewer
						datasets.push({
							label: `${reviewerName} (Performance)`,
							data: allWeeks.map((week) => {
								const point = points.find((p) => p.weekNumber === week);
								return point?.performance ?? null;
							}),
							borderColor: color.performance,
							backgroundColor: color.performance,
							borderWidth: 1.5,
							tension: 0.3,
							pointRadius: 3,
							pointHoverRadius: 5,
							spanGaps: true,
							yAxisID: 'y'
						});

						colorIndex++;
					});
				}
			}

			return {
				type: 'line' as const,
				data: { labels, datasets },
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
									const ctx = context as {
										dataset: { label: string };
										parsed: { y: number | null };
									};
									let label = ctx.dataset.label || '';
									if (label) {
										label += ': ';
									}
									if (ctx.parsed.y !== null) {
										label += ctx.parsed.y.toFixed(1);
									} else {
										label += 'No data';
									}
									return label;
								}
							}
						}
					},
					scales: {
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
						},
						y: {
							type: 'linear' as const,
							position: 'left' as const,
							title: {
								display: true,
								text: 'Score',
								color: '#a1a1aa',
								font: {
									size: 12,
									weight: 600
								}
							},
							min: 0,
							max: 10,
							ticks: {
								color: '#a1a1aa',
								stepSize: 2,
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
		// Initialize chart on mount
		if (chartCanvas && chartConfig) {
			const ctx = chartCanvas.getContext('2d');
			if (ctx) {
				chartInstance = new Chart(ctx, chartConfig);
			}
		}
	});

	// Update chart when data or toggle changes - only after mount
	$effect(() => {
		if (!isMounted || !chartCanvas) return;

		// Access reactive dependencies to track them
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _indData = individualData;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _stkData = reviewerData;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _showStk = showReviewers;
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		const _showIndStk = showIndividualReviewers;

		// Get current config
		const config = chartConfig;
		const instance = chartInstance;

		// Only update if chart exists and config is available
		if (instance && config) {
			// Rebuild datasets from config
			instance.data.datasets = config.data.datasets;
			instance.data.labels = config.data.labels;
			instance.update('none');
		}
	});

	onDestroy(() => {
		if (chartInstance) {
			chartInstance.destroy();
		}
	});

	// Get correlation interpretation
	function getCorrelationInterpretation(corr: number | null): string {
		if (corr === null) return 'Insufficient data';
		const absCorr = Math.abs(corr);
		if (absCorr < 0.3) return 'Weak';
		if (absCorr < 0.7) return 'Moderate';
		return 'Strong';
	}

	function getCorrelationDirection(corr: number | null): string {
		if (corr === null) return '';
		if (corr > 0) return 'positive';
		return 'negative';
	}
</script>

<div class="space-y-4">
	<div class="flex items-center justify-between">
		<div>
			<h2 class="text-xl font-bold text-text-primary">Correlation View</h2>
			<p class="mt-1 text-sm text-text-secondary">
				See if increases in effort actually drive observable progress over time. When lines move
				together, there's correlation.
			</p>
		</div>
		{#if reviewerData.length > 0}
			<div class="flex items-center gap-4">
				<label class="flex items-center gap-2">
					<input
						type="checkbox"
						bind:checked={showReviewers}
						class="h-4 w-4 rounded border-border-strong text-accent focus:ring-accent"
					/>
					<span class="text-sm font-semibold text-text-secondary">Show Reviewers</span>
				</label>
				{#if showReviewers}
					<label class="flex items-center gap-2">
						<input
							type="checkbox"
							bind:checked={showIndividualReviewers}
							class="h-4 w-4 rounded border-border-strong text-success focus:ring-success"
						/>
						<span class="text-xs font-semibold text-text-secondary">Show Individual Lines</span>
					</label>
				{/if}
			</div>
		{/if}
	</div>

	<!-- Correlation indicators -->
	{#if individualCorrelation !== null}
		<div class="rounded-lg border border-border-default bg-surface-raised p-4">
			<div class="flex gap-6">
				<div class="flex-1">
					<div class="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
						My Correlation
					</div>
					<div class="mt-1 flex items-baseline gap-2">
						<span class="text-2xl font-bold text-text-primary">
							{individualCorrelation.toFixed(2)}
						</span>
						<span class="text-sm font-medium text-text-secondary">
							({getCorrelationInterpretation(individualCorrelation)}
							{getCorrelationDirection(individualCorrelation)})
						</span>
					</div>
				</div>
				{#if reviewerCorrelation !== null}
					<div class="flex-1 border-l border-border-strong pl-6">
						<div class="text-xs font-semibold tracking-wide text-text-tertiary uppercase">
							Reviewers Correlation
						</div>
						<div class="mt-1 flex items-baseline gap-2">
							<span class="text-2xl font-bold text-text-primary">
								{reviewerCorrelation.toFixed(2)}
							</span>
							<span class="text-sm font-medium text-text-secondary">
								({getCorrelationInterpretation(reviewerCorrelation)}
								{getCorrelationDirection(reviewerCorrelation)})
							</span>
						</div>
					</div>
				{/if}
			</div>
			<div class="mt-3 border-t border-border-default pt-3">
				<p class="text-xs text-text-secondary">
					<strong>What this means:</strong> Correlation measures how effort and performance move together.
					Values range from -1 to +1. Close to +1 means they move in sync (when effort rises, performance
					rises). Close to -1 means they move opposite. Near 0 means little relationship. The solid lines
					on the chart show the correlation trend.
				</p>
			</div>
		</div>
	{/if}

	<!-- Custom Legend/Key -->
	<div class="grid grid-cols-2 gap-4 rounded-lg border border-border-default bg-surface-raised p-4">
		<div>
			<div class="mb-2 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
				Correlation Lines
			</div>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<div class="h-1 w-8 rounded-full bg-cyan-500"></div>
					<span class="text-sm font-medium text-text-secondary">My Correlation</span>
					{#if individualCorrelation !== null}
						<span class="text-xs text-text-tertiary">(r={individualCorrelation.toFixed(2)})</span>
					{/if}
				</div>
				{#if showReviewers && reviewerCorrelation !== null}
					<div class="flex items-center gap-2">
						<div class="h-1 w-8 rounded-full bg-emerald-600"></div>
						<span class="text-sm font-medium text-text-secondary">Reviewers Correlation</span>
						<span class="text-xs text-text-tertiary">(r={reviewerCorrelation.toFixed(2)})</span>
					</div>
				{/if}
			</div>
		</div>
		<div>
			<div class="mb-2 text-xs font-semibold tracking-wide text-text-tertiary uppercase">
				Individual Lines
			</div>
			<div class="space-y-2">
				<div class="flex items-center gap-2">
					<div class="h-0.5 w-8 border-t-2 border-dashed border-cyan-500/50"></div>
					<span class="text-sm text-text-secondary">My Effort</span>
				</div>
				<div class="flex items-center gap-2">
					<div class="h-0.5 w-8 border-t-2 border-dashed border-amber-500/50"></div>
					<span class="text-sm text-text-secondary">My Performance</span>
				</div>
				{#if showReviewers}
					<div class="flex items-center gap-2">
						<div class="h-0.5 w-8 border-t-2 border-dashed border-emerald-600/50"></div>
						<span class="text-sm text-text-secondary">Reviewers Effort (Avg)</span>
					</div>
					<div class="flex items-center gap-2">
						<div class="h-0.5 w-8 border-t-2 border-dashed border-red-600/50"></div>
						<span class="text-sm text-text-secondary">Reviewers Performance (Avg)</span>
					</div>
				{/if}
			</div>
		</div>
	</div>

	<div class="h-[400px] w-full rounded-xl border border-border-default bg-surface-raised p-6">
		{#if individualData.length >= 3 || reviewerData.length >= 3}
			<canvas bind:this={chartCanvas}></canvas>
		{:else if individualData.length > 0 || reviewerData.length > 0}
			<div class="flex h-full flex-col items-center justify-center gap-2 text-text-tertiary">
				<p class="text-sm font-medium">Correlation patterns need at least 3 weeks of data.</p>
				<p class="text-xs">
					You're on week {Math.max(
						...individualData.map((d) => d.weekNumber),
						...reviewerData.map((d) => d.weekNumber),
						1
					)}. Keep going!
				</p>
			</div>
		{:else}
			<div class="flex h-full items-center justify-center text-text-tertiary">
				<p>
					Not enough data to display correlation view. Complete more check-ins to see the
					relationship between effort and performance over time.
				</p>
			</div>
		{/if}
	</div>
</div>
