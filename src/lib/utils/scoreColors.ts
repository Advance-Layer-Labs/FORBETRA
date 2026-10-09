// Two-color intensity system: cyan for effort, amber for performance
// Pale at low scores, deep at high scores

export type ScoreType = 'effort' | 'performance';

// --- Text color by intensity ---
export const getScoreColor = (score: number, type: ScoreType): string => {
	if (type === 'effort') {
		if (score <= 2) return 'text-cyan-300';
		if (score <= 4) return 'text-cyan-400';
		if (score <= 6) return 'text-cyan-500';
		if (score <= 8) return 'text-cyan-600';
		return 'text-cyan-700';
	} else {
		if (score <= 2) return 'text-amber-300';
		if (score <= 4) return 'text-amber-400';
		if (score <= 6) return 'text-amber-500';
		if (score <= 8) return 'text-amber-600';
		return 'text-amber-700';
	}
};

// --- Background + border classes (dark-adapted transparent overlays) ---
export const getScoreBgColor = (score: number, type: ScoreType): string => {
	if (type === 'effort') {
		if (score <= 2) return 'bg-cyan-900/20 border-cyan-700/30';
		if (score <= 4) return 'bg-cyan-800/25 border-cyan-600/35';
		if (score <= 6) return 'bg-cyan-800/30 border-cyan-500/40';
		if (score <= 8) return 'bg-cyan-700/35 border-cyan-500/50';
		return 'bg-cyan-700/40 border-cyan-400/60';
	} else {
		if (score <= 2) return 'bg-amber-900/20 border-amber-700/30';
		if (score <= 4) return 'bg-amber-800/25 border-amber-600/35';
		if (score <= 6) return 'bg-amber-800/30 border-amber-500/40';
		if (score <= 8) return 'bg-amber-700/35 border-amber-500/50';
		return 'bg-amber-700/40 border-amber-400/60';
	}
};

// --- Selected button fill ---
export const getButtonSelectedColors = (score: number, type: ScoreType): string => {
	if (type === 'effort') {
		if (score <= 2) return 'border-cyan-300 bg-cyan-300 text-white';
		if (score <= 4) return 'border-cyan-400 bg-cyan-400 text-white';
		if (score <= 6) return 'border-cyan-500 bg-cyan-500 text-white';
		if (score <= 8) return 'border-cyan-600 bg-cyan-600 text-white';
		return 'border-cyan-700 bg-cyan-700 text-white';
	} else {
		if (score <= 2) return 'border-amber-300 bg-amber-300 text-white';
		if (score <= 4) return 'border-amber-400 bg-amber-400 text-white';
		if (score <= 6) return 'border-amber-500 bg-amber-500 text-white';
		if (score <= 8) return 'border-amber-600 bg-amber-600 text-white';
		return 'border-amber-700 bg-amber-700 text-white';
	}
};

// --- Hover state classes (dark-adapted) ---
export const getButtonHoverColors = (score: number, type: ScoreType): string => {
	if (type === 'effort') {
		if (score <= 2) return 'hover:border-cyan-700/40 hover:bg-cyan-950/50';
		if (score <= 4) return 'hover:border-cyan-600/40 hover:bg-cyan-950/50';
		if (score <= 6) return 'hover:border-cyan-500/50 hover:bg-cyan-900/40';
		if (score <= 8) return 'hover:border-cyan-500/60 hover:bg-cyan-900/40';
		return 'hover:border-cyan-400/60 hover:bg-cyan-900/40';
	} else {
		if (score <= 2) return 'hover:border-amber-700/40 hover:bg-amber-950/50';
		if (score <= 4) return 'hover:border-amber-600/40 hover:bg-amber-950/50';
		if (score <= 6) return 'hover:border-amber-500/50 hover:bg-amber-900/40';
		if (score <= 8) return 'hover:border-amber-500/60 hover:bg-amber-900/40';
		return 'hover:border-amber-400/60 hover:bg-amber-900/40';
	}
};

// --- Focus ring color ---
export const getFocusRing = (score: number, type: ScoreType): string => {
	if (type === 'effort') {
		if (score <= 2) return 'focus-visible:ring-cyan-300';
		if (score <= 4) return 'focus-visible:ring-cyan-400';
		if (score <= 6) return 'focus-visible:ring-cyan-500';
		if (score <= 8) return 'focus-visible:ring-cyan-600';
		return 'focus-visible:ring-cyan-700';
	} else {
		if (score <= 2) return 'focus-visible:ring-amber-300';
		if (score <= 4) return 'focus-visible:ring-amber-400';
		if (score <= 6) return 'focus-visible:ring-amber-500';
		if (score <= 8) return 'focus-visible:ring-amber-600';
		return 'focus-visible:ring-amber-700';
	}
};

// --- Score labels ---
export const getScoreLabel = (
	score: number,
	type: 'effort' | 'performance' | 'progress'
): string => {
	if (type === 'effort') {
		if (score <= 2) return 'Rarely intentional';
		if (score <= 4) return 'Sporadic effort';
		if (score <= 6) return 'Steady practice';
		if (score <= 8) return 'Highly disciplined';
		return 'Relentless commitment';
	} else {
		if (score <= 2) return 'Not yet visible';
		if (score <= 4) return 'Early signs';
		if (score <= 6) return 'Noticeable progress';
		if (score <= 8) return 'Consistent results';
		return 'Transformative impact';
	}
};

// --- Nullable variant for dashboard/insights ---
export const getScoreColorNullable = (
	score: number | null | undefined,
	type: ScoreType
): string => {
	if (score === null || score === undefined) return 'text-text-muted';
	return getScoreColor(score, type);
};

// --- Stability color (stays emerald-based, not effort/performance) ---
export const getStabilityColor = (score: number | null | undefined): string => {
	if (score === null || score === undefined) return 'text-text-muted';
	if (score < 50) return 'text-warning';
	if (score < 75) return 'text-accent';
	return 'text-success';
};

// --- Chart.js RGB constants ---
export const CHART_COLORS = {
	effort: {
		individual: {
			border: 'rgb(6, 182, 212)', // cyan-500
			bg: 'rgba(6, 182, 212, 0.1)'
		},
		reviewer: {
			border: 'rgb(34, 211, 238)', // cyan-400
			bg: 'rgba(34, 211, 238, 0.1)'
		}
	},
	performance: {
		individual: {
			border: 'rgb(245, 158, 11)', // amber-500
			bg: 'rgba(245, 158, 11, 0.1)'
		},
		reviewer: {
			border: 'rgb(251, 191, 36)', // amber-400
			bg: 'rgba(251, 191, 36, 0.1)'
		}
	}
} as const;
