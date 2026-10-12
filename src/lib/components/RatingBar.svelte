<script lang="ts">
	let {
		dimension,
		value = $bindable(null),
		lastValue = null,
		onChange,
		disabled = false
	}: {
		dimension: 'effort' | 'performance';
		value: number | null;
		lastValue?: number | null;
		onChange?: (value: number) => void;
		disabled?: boolean;
	} = $props();

	const effortAnchors = [
		'No effort',
		'Negligible',
		'Minimal',
		'Light',
		'Moderate',
		'Steady',
		'Considerable',
		'Strong',
		'Intense',
		'Near maximum',
		'Everything I had'
	];

	const performanceAnchors = [
		'No output',
		'Negligible',
		'Below expectations',
		'Emerging',
		'Developing',
		'Meeting expectations',
		'Solid',
		'Strong',
		'Excellent',
		'Exceptional',
		"Best I'm capable of"
	];

	const anchors = $derived(dimension === 'effort' ? effortAnchors : performanceAnchors);
	const label = $derived(value !== null ? anchors[value] : '');

	let isDragging = $state(false);
	let trackEl = $state<HTMLDivElement | undefined>(undefined);
	let hasTouched = $state(value !== null);
	let displayLabel = $state(
		value !== null ? (dimension === 'effort' ? effortAnchors : performanceAnchors)[value] : ''
	);
	let isPulsing = $state(false);
	let isCrossfading = $state(false);

	// Glow config per dimension
	const glowRgb = $derived(dimension === 'effort' ? '148, 163, 184' : '212, 160, 106');

	const glowShadow = $derived.by(() => {
		if (value === null) return 'none';
		if (value <= 2) return 'none';
		if (value <= 4) return `0 0 12px rgba(${glowRgb}, 0.08)`;
		if (value <= 6) return `0 0 18px rgba(${glowRgb}, 0.12)`;
		if (value <= 8) return `0 0 24px rgba(${glowRgb}, 0.18)`;
		return `0 0 32px rgba(${glowRgb}, 0.25)`;
	});

	const fillPercent = $derived(value !== null ? (value / 10) * 100 : 0);
	const lastPercent = $derived(lastValue !== null ? (lastValue / 10) * 100 : null);

	const fillGradient = $derived(
		dimension === 'effort'
			? 'linear-gradient(to top, #475569, #94a3b8, #cbd5e1)'
			: 'linear-gradient(to top, #92700a, #d4a06a, #e0b580)'
	);

	const thumbWidth = $derived.by(() => {
		if (value === null) return 28;
		// Grows from 28px at 0 to 40px at 10
		return 28 + (value / 10) * 12;
	});

	const thumbHeight = $derived(value === 10 ? 5 : 4);

	const dimensionColor = $derived(
		dimension === 'effort' ? 'var(--color-data-effort)' : 'var(--color-data-performance)'
	);

	const dimensionVividColor = $derived(
		dimension === 'effort'
			? 'var(--color-data-effort-vivid)'
			: 'var(--color-data-performance-vivid)'
	);

	function valueFromY(clientY: number) {
		if (!trackEl) return null;
		const rect = trackEl.getBoundingClientRect();
		// Bottom = 0, Top = 10
		const relativeY = rect.bottom - clientY;
		const ratio = Math.max(0, Math.min(1, relativeY / rect.height));
		return Math.round(ratio * 10);
	}

	function handlePointerDown(e: MouseEvent | TouchEvent) {
		if (disabled) return;
		isDragging = true;
		hasTouched = true;
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		const newVal = valueFromY(clientY);
		if (newVal !== null && newVal !== value) {
			setValue(newVal);
		}
	}

	function handlePointerMove(e: MouseEvent | TouchEvent) {
		if (!isDragging || disabled) return;
		e.preventDefault();
		const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
		const newVal = valueFromY(clientY);
		if (newVal !== null && newVal !== value) {
			setValue(newVal);
		}
	}

	function handlePointerUp() {
		isDragging = false;
	}

	function setValue(newVal: number) {
		value = newVal;
		triggerPulse();
		triggerCrossfade(anchors[newVal]);
		onChange?.(newVal);
	}

	function triggerPulse() {
		isPulsing = false;
		// Force reflow to restart animation
		requestAnimationFrame(() => {
			isPulsing = true;
		});
	}

	function triggerCrossfade(newLabel: string) {
		isCrossfading = true;
		setTimeout(() => {
			displayLabel = newLabel;
			isCrossfading = false;
		}, 100);
	}

	function handleKeydown(e: KeyboardEvent) {
		if (disabled) return;
		if (e.key === 'ArrowUp') {
			e.preventDefault();
			hasTouched = true;
			const newVal = Math.min(10, (value ?? 0) + 1);
			if (newVal !== value) setValue(newVal);
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			hasTouched = true;
			const newVal = Math.max(0, (value ?? 0) - 1);
			if (newVal !== value) setValue(newVal);
		} else if (e.key === 'Home') {
			e.preventDefault();
			hasTouched = true;
			if (value !== 0) setValue(0);
		} else if (e.key === 'End') {
			e.preventDefault();
			hasTouched = true;
			if (value !== 10) setValue(10);
		}
	}

	// Sync displayLabel with external value changes
	$effect(() => {
		if (value !== null) {
			displayLabel = anchors[value];
			hasTouched = true;
		}
	});

	// Add global listeners for drag
	$effect(() => {
		if (!isDragging) return;

		const onMouseMove = (e: MouseEvent) => handlePointerMove(e);
		const onTouchMove = (e: TouchEvent) => handlePointerMove(e);
		const onUp = () => handlePointerUp();

		window.addEventListener('mousemove', onMouseMove);
		window.addEventListener('touchmove', onTouchMove, { passive: false });
		window.addEventListener('mouseup', onUp);
		window.addEventListener('touchend', onUp);

		return () => {
			window.removeEventListener('mousemove', onMouseMove);
			window.removeEventListener('touchmove', onTouchMove);
			window.removeEventListener('mouseup', onUp);
			window.removeEventListener('touchend', onUp);
		};
	});

	// Scale markers data
	const scaleMarkers = Array.from({ length: 11 }, (_, i) => ({
		value: i,
		isMajor: i === 0 || i === 5 || i === 10
	}));
</script>

<div class="rating-bar" class:rating-bar--disabled={disabled}>
	<div class="rating-bar__body">
		<!-- Scale markers -->
		<div class="rating-bar__scale">
			{#each scaleMarkers as marker (marker.value)}
				{@const isActive = value === marker.value}
				<div class="rating-bar__tick" style="bottom: {(marker.value / 10) * 100}%">
					<span
						class="rating-bar__tick-label"
						class:rating-bar__tick-label--major={marker.isMajor}
						class:rating-bar__tick-label--active={isActive}
					>
						{marker.value}
					</span>
					<span
						class="rating-bar__tick-line"
						class:rating-bar__tick-line--major={marker.isMajor}
						class:rating-bar__tick-line--active={isActive}
					></span>
				</div>
			{/each}
		</div>

		<!-- Track -->
		<div
			bind:this={trackEl}
			class="rating-bar__track"
			class:rating-bar__track--active={isDragging}
			style="box-shadow: {glowShadow};"
			role="slider"
			aria-valuemin={0}
			aria-valuemax={10}
			aria-valuenow={value ?? undefined}
			aria-valuetext={value !== null ? `${value}, ${label}` : 'No value selected'}
			aria-label="{dimension === 'effort' ? 'Effort' : 'Performance'} rating"
			tabindex={disabled ? -1 : 0}
			onmousedown={handlePointerDown}
			ontouchstart={handlePointerDown}
			onkeydown={handleKeydown}
		>
			<!-- Fill -->
			{#if value !== null}
				<div
					class="rating-bar__fill"
					style="height: {fillPercent}%; background: {fillGradient};"
				></div>

				<!-- Thumb -->
				<div
					class="rating-bar__thumb"
					style="bottom: {fillPercent}%; width: {thumbWidth}px; height: {thumbHeight}px;"
				></div>
			{/if}

			<!-- Last-score marker -->
			{#if lastPercent !== null}
				<div class="rating-bar__last-marker" style="bottom: {lastPercent}%"></div>
			{/if}
		</div>
	</div>

	<!-- Readout below bar: Score → Dimension → Label -->
	<div class="rating-bar__label-group">
		<span
			class="rating-bar__score"
			class:rating-bar__score--pulse={isPulsing}
			style="color: {value !== null ? dimensionVividColor : 'var(--color-text-muted)'};"
		>
			{value !== null ? value : '--'}
		</span>

		<span class="rating-bar__dimension-label" style="color: {dimensionColor}">
			{dimension === 'effort' ? 'EFFORT' : 'PERFORMANCE'}
		</span>

		{#if hasTouched}
			<span class="rating-bar__value-label" class:rating-bar__value-label--fading={isCrossfading}>
				{displayLabel}
			</span>
		{:else}
			<span class="rating-bar__unset">Tap or press arrow keys to set</span>
		{/if}
	</div>
</div>

<style>
	.rating-bar {
		display: flex;
		flex-direction: column;
		align-items: center;
		user-select: none;
		-webkit-user-select: none;
	}

	.rating-bar--disabled {
		opacity: 0.4;
		pointer-events: none;
	}

	.rating-bar__body {
		display: flex;
		align-items: stretch;
		gap: 6px;
	}

	/* ── Scale ── */
	.rating-bar__scale {
		position: relative;
		width: 40px;
		height: 280px;
	}

	.rating-bar__tick {
		position: absolute;
		right: 0;
		display: flex;
		align-items: center;
		gap: 4px;
		transform: translateY(50%);
	}

	.rating-bar__tick-label {
		font-family: var(--font-mono);
		font-size: 9px;
		font-weight: 400;
		color: var(--color-text-muted);
		text-align: right;
		min-width: 16px;
	}

	.rating-bar__tick-label--major {
		font-size: 11px;
		font-weight: 500;
		color: var(--color-text-tertiary);
	}

	.rating-bar__tick-label--active {
		font-size: 13px;
		font-weight: 700;
		color: var(--color-text-primary);
	}

	.rating-bar__tick-line {
		display: block;
		width: 8px;
		height: 1px;
		background: rgba(250, 244, 237, 0.12);
	}

	.rating-bar__tick-line--major {
		width: 12px;
		height: 1px;
		background: rgba(250, 244, 237, 0.25);
	}

	.rating-bar__tick-line--active {
		width: 16px;
		height: 2px;
		background: rgba(250, 244, 237, 0.5);
	}

	/* ── Track ── */
	.rating-bar__track {
		position: relative;
		width: 72px;
		height: 280px;
		border-radius: 36px;
		background: var(--color-surface-raised);
		border: 2px solid rgba(250, 244, 237, 0.06);
		touch-action: none;
		cursor: pointer;
		overflow: hidden;
		transition:
			border-color 150ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 300ms cubic-bezier(0.16, 1, 0.3, 1);
		outline: none;
	}

	.rating-bar__track:focus-visible {
		border-color: rgba(250, 244, 237, 0.14);
		box-shadow: 0 0 0 2px var(--color-accent);
	}

	.rating-bar__track--active {
		border-color: rgba(250, 244, 237, 0.12);
	}

	/* ── Fill ── */
	.rating-bar__fill {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		border-radius: 0 0 34px 34px;
		transition: height 80ms ease;
	}

	/* ── Thumb ── */
	.rating-bar__thumb {
		position: absolute;
		left: 50%;
		transform: translate(-50%, 50%);
		border-radius: 2px;
		background: rgba(250, 244, 237, 0.8);
		box-shadow: 0 0 8px rgba(250, 244, 237, 0.3);
		pointer-events: none;
		transition:
			bottom 80ms ease,
			width 150ms ease;
	}

	/* ── Last-score marker ── */
	.rating-bar__last-marker {
		position: absolute;
		left: 12px;
		right: 12px;
		height: 2px;
		background: rgba(250, 244, 237, 0.25);
		pointer-events: none;
		transform: translateY(50%);
	}

	/* ── Label group ── */
	.rating-bar__unset {
		margin-top: 6px;
		max-width: 9rem;
		text-align: center;
		font-size: 11px;
		line-height: 1.35;
		color: var(--color-text-muted);
	}

	.rating-bar__label-group {
		display: flex;
		flex-direction: column;
		align-items: center;
		margin-top: 8px;
		text-align: center;
		min-height: 72px;
	}

	.rating-bar__score {
		font-family: var(--font-mono);
		font-size: 40px;
		font-weight: 700;
		line-height: 1;
		margin-top: 0;
		transition: color 150ms ease;
	}

	.rating-bar__dimension-label {
		font-family: var(--font-sans);
		font-size: 11px;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		margin-top: 2px;
	}

	.rating-bar__score--pulse {
		animation: ratingPulse 120ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.rating-bar__value-label {
		font-family: var(--font-sans);
		font-size: 13px;
		font-weight: 400;
		color: var(--color-text-secondary);
		margin-top: 6px;
		transition: opacity 200ms ease;
		opacity: 1;
		max-width: 120px;
		text-align: center;
	}

	.rating-bar__value-label--fading {
		opacity: 0;
	}

	@keyframes ratingPulse {
		0% {
			transform: scale(1);
		}
		50% {
			transform: scale(1.08);
		}
		100% {
			transform: scale(1);
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.rating-bar__score--pulse {
			animation: none;
		}

		.rating-bar__fill {
			transition: none;
		}

		.rating-bar__thumb {
			transition: none;
		}

		.rating-bar__value-label {
			transition: none;
		}
	}
</style>
