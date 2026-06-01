<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import {
		Chart,
		registerables,
		type ChartConfiguration,
		type ChartDataset,
		type TooltipItem
	} from 'chart.js';
	import { CHART_COLORS } from '$lib/utils/scoreColors';
	import { SvelteSet, SvelteMap } from 'svelte/reactivity';

	Chart.register(...registerables);

	const THEME = {
		textMuted: '#a1a1aa',
		textPrimary: '#f4f5f8',
		surfaceOverlay: '#1c1c20',
		borderSubtle: 'rgba(255,255,255,0.08)',
		gridLine: 'rgba(255, 255, 255, 0.06)'
	} as const;

	const STAKEHOLDER_COLORS = [
		{ border: 'rgb(34, 197, 94)', bg: 'rgba(34, 197, 94, 0.05)' },
		{ border: 'rgb(251, 146, 60)', bg: 'rgba(251, 146, 60, 0.05)' },
		{ border: 'rgb(168, 85, 247)', bg: 'rgba(168, 85, 247, 0.05)' },
		{ border: 'rgb(236, 72, 153)', bg: 'rgba(236, 72, 153, 0.05)' },
		{ border: 'rgb(59, 130, 246)', bg: 'rgba(59, 130, 246, 0.05)' }
	];

	type Props = {
		individualData?: Array<{
			weekNumber: number;
			effortScore: number | null;
			performanceScore: number | null;
		}>;
		stakeholderData?: Array<{
			weekNumber: number;
			stakeholderId: string;
			stakeholderName: string;
			effortScore: number | null;
			performanceScore: number | null;
		}>;
		stakeholders?: Array<{ id: string; name: string }>;
		selfLabel?: string;
		// Prior-cycle individual averages — when present, rendered as a dimmed
		// dashed line so the user can compare to their last cycle.
		priorIndividualData?: Array<{
			weekNumber: number;
			effortScore: number | null;
			performanceScore: number | null;
		}>;
		priorCycleLabel?: string | null;
	};

	const props: Props = $props();
	const individualData = props.individualData ?? [];
	const stakeholderData = props.stakeholderData ?? [];
	const stakeholders = props.stakeholders ?? [];
	const selfLabel = props.selfLabel ?? 'My';
	const priorIndividualData = props.priorIndividualData ?? [];
	const priorCycleLabel = props.priorCycleLabel ?? 'Prior cycle';

	let selectedStakeholderIds = new SvelteSet<string>();
	let effortCanvas = $state<HTMLCanvasElement | null>(null);
	let perfCanvas = $state<HTMLCanvasElement | null>(null);
	let effortChart = $state<Chart | null>(null);
	let perfChart = $state<Chart | null>(null);

	const filteredStakeholderData = $derived(
		stakeholderData.filter((d) =>
			selectedStakeholderIds.size === 0 ? true : selectedStakeholderIds.has(d.stakeholderId)
		)
	);

	const stakeholdersWithData = $derived(
		stakeholders.filter((s) => stakeholderData.some((d) => d.stakeholderId === s.id))
	);

	// Averages per week
	const avgByWeek = $derived(
		(() => {
			const wm = new SvelteMap<number, { effort: number[]; perf: number[] }>();
			filteredStakeholderData.forEach((d) => {
				if (!wm.has(d.weekNumber)) wm.set(d.weekNumber, { effort: [], perf: [] });
				const w = wm.get(d.weekNumber)!;
				if (d.effortScore != null) w.effort.push(d.effortScore);
				if (d.performanceScore != null) w.perf.push(d.performanceScore);
			});
			const out: Array<{ weekNumber: number; avgEffort: number | null; avgPerf: number | null }> =
				[];
			wm.forEach((v, k) => {
				out.push({
					weekNumber: k,
					avgEffort: v.effort.length
						? +(v.effort.reduce((a, b) => a + b, 0) / v.effort.length).toFixed(1)
						: null,
					avgPerf: v.perf.length
						? +(v.perf.reduce((a, b) => a + b, 0) / v.perf.length).toFixed(1)
						: null
				});
			});
			return out.sort((a, b) => a.weekNumber - b.weekNumber);
		})()
	);

	// All weeks
	const allWeeks = $derived(
		(() => {
			const ws = new SvelteSet<number>();
			individualData.forEach((d) => ws.add(d.weekNumber));
			stakeholderData.forEach((d) => ws.add(d.weekNumber));
			const sorted = Array.from(ws).sort((a, b) => a - b);
			if (sorted.length > 0 && sorted.length < 4) {
				const max = sorted[sorted.length - 1];
				for (let w = max + 1; sorted.length < 4; w++) sorted.push(w);
			}
			return sorted;
		})()
	);

	const hasLimitedData = $derived(
		(() => {
			const ws = new SvelteSet<number>();
			individualData.forEach((d) => ws.add(d.weekNumber));
			stakeholderData.forEach((d) => ws.add(d.weekNumber));
			return ws.size > 0 && ws.size < 4;
		})()
	);

	// Summary stats
	function latest<T>(arr: T[], pred: (d: T) => boolean, getW: (d: T) => number): T | null {
		return arr.filter(pred).sort((a, b) => getW(b) - getW(a))[0] ?? null;
	}

	const stats = $derived(
		(() => {
			const first = (arr: typeof individualData, key: 'effortScore' | 'performanceScore') => {
				const w0 = arr.find((d) => d.weekNumber === 0 && d[key] != null);
				return w0?.[key] ?? arr.find((d) => d[key] != null)?.[key] ?? null;
			};
			const lastSelf = (key: 'effortScore' | 'performanceScore') =>
				latest(
					individualData,
					(d) => d[key] != null,
					(d) => d.weekNumber
				)?.[key] ?? null;
			const firstAvg = (key: 'avgEffort' | 'avgPerf') => avgByWeek[0]?.[key] ?? null;
			const lastAvg = (key: 'avgEffort' | 'avgPerf') =>
				latest(
					avgByWeek,
					(d) => d[key] != null,
					(d) => d.weekNumber
				)?.[key] ?? null;

			const d = (cur: number | null, base: number | null) =>
				cur != null && base != null ? +(cur - base).toFixed(1) : null;

			return {
				selfEffort: {
					value: lastSelf('effortScore'),
					delta: d(lastSelf('effortScore'), first(individualData, 'effortScore'))
				},
				selfPerf: {
					value: lastSelf('performanceScore'),
					delta: d(lastSelf('performanceScore'), first(individualData, 'performanceScore'))
				},
				revEffort: {
					value: lastAvg('avgEffort'),
					delta: d(lastAvg('avgEffort'), firstAvg('avgEffort'))
				},
				revPerf: { value: lastAvg('avgPerf'), delta: d(lastAvg('avgPerf'), firstAvg('avgPerf')) }
			};
		})()
	);

	// Helpers
	const labels = $derived(allWeeks.map((w) => (w === 0 ? 'Initial' : `Wk ${w}`)));

	function weekSeries(
		arr: Array<{ weekNumber: number; effortScore: number | null; performanceScore: number | null }>,
		key: 'effortScore' | 'performanceScore'
	) {
		return allWeeks.map((w) => arr.find((d) => d.weekNumber === w)?.[key] ?? null);
	}

	function avgSeries(key: 'avgEffort' | 'avgPerf') {
		return allWeeks.map((w) => avgByWeek.find((d) => d.weekNumber === w)?.[key] ?? null);
	}

	function makeLine(
		label: string,
		data: (number | null)[],
		color: string,
		bg: string,
		width: number,
		dash?: number[],
		radius?: number
	): ChartDataset<'line'> {
		return {
			label,
			data,
			borderColor: color,
			backgroundColor: bg,
			borderWidth: width,
			tension: 0.3,
			pointRadius: radius ?? 3,
			pointHoverRadius: radius ? radius + 2 : 6,
			spanGaps: true,
			...(dash ? { borderDash: dash } : {})
		};
	}

	function chartOpts(yLabel: string) {
		return {
			responsive: true,
			maintainAspectRatio: false,
			interaction: { mode: 'index' as const, intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: {
					backgroundColor: THEME.surfaceOverlay,
					titleColor: THEME.textPrimary,
					bodyColor: THEME.textMuted,
					borderColor: THEME.borderSubtle,
					borderWidth: 1,
					padding: 10,
					titleFont: { size: 12, weight: 600 as const },
					bodyFont: { size: 11 },
					callbacks: {
						label: (ctx: TooltipItem<'line'>) =>
							ctx.parsed.y != null
								? `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}`
								: `${ctx.dataset.label}: —`
					}
				}
			},
			scales: {
				y: {
					min: 0,
					max: 10,
					ticks: { color: THEME.textMuted, stepSize: 2, font: { size: 10 } },
					grid: { color: THEME.gridLine },
					title: {
						display: true,
						text: yLabel,
						color: THEME.textMuted,
						font: { size: 11, weight: 600 as const }
					}
				},
				x: {
					ticks: { color: THEME.textMuted, font: { size: 10 } },
					grid: { color: THEME.gridLine }
				}
			}
		};
	}

	// Effort chart config
	const effortConfig = $derived(
		(() => {
			const datasets: ChartDataset<'line'>[] = [
				makeLine(
					`${selfLabel}`,
					weekSeries(individualData, 'effortScore'),
					CHART_COLORS.effort.individual.border,
					CHART_COLORS.effort.individual.bg,
					2.5
				)
			];
			if (priorIndividualData.length > 0) {
				datasets.push(
					makeLine(
						`${priorCycleLabel} (effort)`,
						weekSeries(priorIndividualData, 'effortScore'),
						'rgba(148, 163, 184, 0.65)',
						'rgba(148, 163, 184, 0.08)',
						1.5,
						[3, 4],
						0
					)
				);
			}
			if (avgByWeek.length > 0) {
				datasets.push(
					makeLine(
						'Reviewer Avg',
						avgSeries('avgEffort'),
						CHART_COLORS.effort.stakeholder.border,
						CHART_COLORS.effort.stakeholder.bg,
						2,
						[5, 5]
					)
				);
			}
			if (selectedStakeholderIds.size > 0) {
				stakeholdersWithData
					.filter((s) => selectedStakeholderIds.has(s.id))
					.forEach((s, i) => {
						const c = STAKEHOLDER_COLORS[i % STAKEHOLDER_COLORS.length];
						const sd = stakeholderData.filter((d) => d.stakeholderId === s.id);
						datasets.push(
							makeLine(s.name, weekSeries(sd, 'effortScore'), c.border, c.bg, 1.5, undefined, 2)
						);
					});
			}
			return { type: 'line' as const, data: { labels, datasets }, options: chartOpts('Effort') };
		})()
	);

	// Performance chart config
	const perfConfig = $derived(
		(() => {
			const datasets: ChartDataset<'line'>[] = [
				makeLine(
					`${selfLabel}`,
					weekSeries(individualData, 'performanceScore'),
					CHART_COLORS.performance.individual.border,
					CHART_COLORS.performance.individual.bg,
					2.5
				)
			];
			if (priorIndividualData.length > 0) {
				datasets.push(
					makeLine(
						`${priorCycleLabel} (perf)`,
						weekSeries(priorIndividualData, 'performanceScore'),
						'rgba(148, 163, 184, 0.65)',
						'rgba(148, 163, 184, 0.08)',
						1.5,
						[3, 4],
						0
					)
				);
			}
			if (avgByWeek.length > 0) {
				datasets.push(
					makeLine(
						'Reviewer Avg',
						avgSeries('avgPerf'),
						CHART_COLORS.performance.stakeholder.border,
						CHART_COLORS.performance.stakeholder.bg,
						2,
						[5, 5]
					)
				);
			}
			if (selectedStakeholderIds.size > 0) {
				stakeholdersWithData
					.filter((s) => selectedStakeholderIds.has(s.id))
					.forEach((s, i) => {
						const c = STAKEHOLDER_COLORS[i % STAKEHOLDER_COLORS.length];
						const sd = stakeholderData.filter((d) => d.stakeholderId === s.id);
						datasets.push(
							makeLine(
								s.name,
								weekSeries(sd, 'performanceScore'),
								c.border,
								c.bg,
								1.5,
								undefined,
								2
							)
						);
					});
			}
			return {
				type: 'line' as const,
				data: { labels, datasets },
				options: chartOpts('Performance')
			};
		})()
	);

	// Reactive updates
	$effect(() => {
		const c = effortConfig;
		if (effortChart && c) {
			effortChart.data = c.data;
			effortChart.update('none');
		}
	});
	$effect(() => {
		const c = perfConfig;
		if (perfChart && c) {
			perfChart.data = c.data;
			perfChart.update('none');
		}
	});

	onMount(() => {
		if (effortCanvas && effortConfig) {
			const ctx = effortCanvas.getContext('2d');
			if (ctx) effortChart = new Chart(ctx, effortConfig as ChartConfiguration<'line'>);
		}
		if (perfCanvas && perfConfig) {
			const ctx = perfCanvas.getContext('2d');
			if (ctx) perfChart = new Chart(ctx, perfConfig as ChartConfiguration<'line'>);
		}
	});

	onDestroy(() => {
		effortChart?.destroy();
		perfChart?.destroy();
	});

	function toggleStakeholder(id: string) {
		if (selectedStakeholderIds.has(id)) selectedStakeholderIds.delete(id);
		else selectedStakeholderIds.add(id);
		selectedStakeholderIds = new SvelteSet(selectedStakeholderIds);
	}

	const summaryCards = $derived([
		{ label: 'Self Effort', ...stats.selfEffort, color: CHART_COLORS.effort.individual.border },
		{ label: 'Self Perf', ...stats.selfPerf, color: CHART_COLORS.performance.individual.border },
		{ label: 'Rev. Effort', ...stats.revEffort, color: CHART_COLORS.effort.stakeholder.border },
		{ label: 'Rev. Perf', ...stats.revPerf, color: CHART_COLORS.performance.stakeholder.border }
	]);
</script>

<div class="space-y-4">
	<!-- Effort Chart -->
	<div class="rounded-xl border border-border-default bg-surface-raised p-4 sm:p-5">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-sm font-bold text-text-primary">Effort</h3>
			<div class="flex items-center gap-3 text-[11px] text-text-muted">
				<span class="flex items-center gap-1.5">
					<span
						class="inline-block h-0.5 w-3 rounded"
						style="background:{CHART_COLORS.effort.individual.border}"
					></span>
					{selfLabel}
				</span>
				{#if avgByWeek.length > 0}
					<span class="flex items-center gap-1.5">
						<span
							class="inline-block h-0 w-3 border-t-[1.5px] border-dashed"
							style="border-color:{CHART_COLORS.effort.stakeholder.border}"
						></span>
						Reviewers
					</span>
				{/if}
			</div>
		</div>
		<div class="h-[220px] w-full sm:h-[260px]">
			{#if effortConfig.data.labels && effortConfig.data.labels.length > 0}
				<canvas bind:this={effortCanvas}></canvas>
			{:else}
				<div class="flex h-full items-center justify-center text-sm text-text-tertiary">
					No effort data yet
				</div>
			{/if}
		</div>
	</div>

	<!-- Performance Chart -->
	<div class="rounded-xl border border-border-default bg-surface-raised p-4 sm:p-5">
		<div class="mb-3 flex items-center justify-between">
			<h3 class="text-sm font-bold text-text-primary">Performance</h3>
			<div class="flex items-center gap-3 text-[11px] text-text-muted">
				<span class="flex items-center gap-1.5">
					<span
						class="inline-block h-0.5 w-3 rounded"
						style="background:{CHART_COLORS.performance.individual.border}"
					></span>
					{selfLabel}
				</span>
				{#if avgByWeek.length > 0}
					<span class="flex items-center gap-1.5">
						<span
							class="inline-block h-0 w-3 border-t-[1.5px] border-dashed"
							style="border-color:{CHART_COLORS.performance.stakeholder.border}"
						></span>
						Reviewers
					</span>
				{/if}
			</div>
		</div>
		<div class="h-[220px] w-full sm:h-[260px]">
			{#if perfConfig.data.labels && perfConfig.data.labels.length > 0}
				<canvas bind:this={perfCanvas}></canvas>
			{:else}
				<div class="flex h-full items-center justify-center text-sm text-text-tertiary">
					No performance data yet
				</div>
			{/if}
		</div>
	</div>

	{#if hasLimitedData}
		<p class="text-center text-xs text-text-tertiary">Trends become clearer after week 4.</p>
	{/if}

	<!-- Reviewer Pills -->
	{#if stakeholdersWithData.length > 0}
		<div class="flex flex-wrap items-center gap-2">
			<span class="text-[11px] font-semibold tracking-wide text-text-tertiary uppercase"
				>Reviewers</span
			>
			{#each stakeholdersWithData as s, i (s.id)}
				{@const active = selectedStakeholderIds.has(s.id)}
				<button
					type="button"
					onclick={() => toggleStakeholder(s.id)}
					class="rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors
						{active
						? 'border-accent bg-accent-muted text-accent'
						: 'border-border-default bg-surface-raised text-text-secondary hover:border-accent/40'}"
				>
					{#if active}
						<span
							class="mr-1 inline-block h-1.5 w-1.5 rounded-full"
							style="background:{STAKEHOLDER_COLORS[i % STAKEHOLDER_COLORS.length].border}"
						></span>
					{/if}
					{s.name}
				</button>
			{/each}
		</div>
	{/if}

	<!-- Summary Cards -->
	<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
		{#each summaryCards as card (card.label)}
			<div
				class="rounded-lg border border-border-default bg-surface-raised px-3 py-2.5 text-center"
			>
				<p class="text-xl font-bold tabular-nums" style="color:{card.color}">
					{card.value != null ? card.value.toFixed(1) : '—'}
				</p>
				{#if card.delta != null}
					<p class="text-[10px] font-semibold {card.delta >= 0 ? 'text-success' : 'text-error'}">
						{card.delta > 0 ? '+' : ''}{card.delta.toFixed(1)}
					</p>
				{/if}
				<p class="text-[10px] text-text-muted">{card.label}</p>
			</div>
		{/each}
	</div>
</div>
