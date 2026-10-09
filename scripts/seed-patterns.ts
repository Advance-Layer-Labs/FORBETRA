/**
 * Score Pattern Generators
 *
 * Each function takes a week number and returns effort + performance scores (0-10).
 * Uses seeded randomness for reproducibility via a simple deterministic noise function.
 */

import type { PersonaPattern, ReviewerBias } from './seed-config';

// Deterministic pseudo-random noise based on seed values
function noise(week: number, salt: number): number {
	const x = Math.sin(week * 12.9898 + salt * 78.233) * 43758.5453;
	return x - Math.floor(x); // 0 to 1
}

function noiseRange(week: number, salt: number, min: number, max: number): number {
	return min + noise(week, salt) * (max - min);
}

function clamp(value: number): number {
	return Math.max(0, Math.min(10, Math.round(value * 10) / 10));
}

type Scores = { effort: number; performance: number };

// 1. Improving — steady upward trend (effort 4->8, performance 3->7)
function improvingPattern(week: number): Scores {
	const effort = 4 + week * 0.35 + noiseRange(week, 1, -0.8, 0.8);
	const performance = 3 + week * 0.33 + noiseRange(week, 2, -0.7, 0.7);
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 2. Plateaued — strong start then flat (effort ~7, performance ~6)
function plateauedPattern(week: number): Scores {
	const effort = week <= 3 ? 5 + week * 0.7 : 7 + noiseRange(week, 3, -0.5, 0.5);
	const performance = week <= 3 ? 4 + week * 0.7 : 6 + noiseRange(week, 4, -0.4, 0.4);
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 3. Declining — drops after week 6 (effort 8->4, performance 7->3)
function decliningPattern(week: number): Scores {
	let effort: number;
	let performance: number;
	if (week <= 6) {
		effort = 7.5 + noiseRange(week, 5, -0.5, 0.5);
		performance = 7 + noiseRange(week, 6, -0.4, 0.4);
	} else {
		const drop = (week - 6) * 0.6;
		effort = 7.5 - drop + noiseRange(week, 5, -0.5, 0.5);
		performance = 7 - drop * 0.7 + noiseRange(week, 6, -0.4, 0.4);
	}
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 4. High Performer — consistently high (effort 8-10, performance 8-10)
function highPerformerPattern(week: number): Scores {
	const effort = 8.5 + noiseRange(week, 7, -0.8, 1.5);
	const performance = 8.5 + noiseRange(week, 8, -0.8, 1.5);
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 5. Inconsistent — wildly variable
function inconsistentPattern(week: number): Scores {
	const effort = 2 + noiseRange(week, 9, 0, 7);
	const performance = 3 + noiseRange(week, 10, 0, 5);
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 6. Effort Gap — high effort, low results
function effortGapPattern(week: number): Scores {
	const effort = 7.5 + noiseRange(week, 11, -0.5, 1.5);
	const performance = 3.5 + noiseRange(week, 12, -0.5, 1.5);
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 7. Late Bloomer — flat 8 weeks then rapid improvement
function lateBloomerPattern(week: number): Scores {
	let effort: number;
	let performance: number;
	if (week <= 8) {
		effort = 5 + noiseRange(week, 13, -0.5, 0.5);
		performance = 4 + noiseRange(week, 14, -0.5, 0.5);
	} else {
		const boost = (week - 8) * 1.2;
		effort = 5 + boost + noiseRange(week, 13, -0.3, 0.3);
		performance = 4 + boost + noiseRange(week, 14, -0.3, 0.3);
	}
	return { effort: clamp(effort), performance: clamp(performance) };
}

// 8. Early Stage — only 3 weeks of data, starting moderate
function earlyStagePattern(week: number): Scores {
	const effort = 5 + week * 0.5 + noiseRange(week, 15, -0.5, 0.5);
	const performance = 4 + week * 0.4 + noiseRange(week, 16, -0.5, 0.5);
	return { effort: clamp(effort), performance: clamp(performance) };
}

const PATTERN_MAP: Record<PersonaPattern, (week: number) => Scores> = {
	improving: improvingPattern,
	plateaued: plateauedPattern,
	declining: decliningPattern,
	high_performer: highPerformerPattern,
	inconsistent: inconsistentPattern,
	effort_gap: effortGapPattern,
	late_bloomer: lateBloomerPattern,
	early_stage: earlyStagePattern
};

/**
 * Get individual scores for a given persona pattern and week.
 */
export function getScores(pattern: PersonaPattern, week: number): Scores {
	return PATTERN_MAP[pattern](week);
}

/**
 * Apply reviewer bias to individual scores.
 * Returns adjusted effort + performance from the reviewer's perspective.
 */
export function applyReviewerBias(
	individualScores: Scores,
	bias: ReviewerBias,
	week: number,
	reviewerIndex: number
): Scores | null {
	const salt = reviewerIndex * 100;

	switch (bias) {
		case 'positive': {
			const effortOffset = 1 + noiseRange(week, salt + 1, 0, 1.7);
			const perfOffset = 1.5 + noiseRange(week, salt + 2, 0, 1.2);
			return {
				effort: clamp(individualScores.effort + effortOffset),
				performance: clamp(individualScores.performance + perfOffset)
			};
		}
		case 'neutral': {
			const effortOffset = noiseRange(week, salt + 3, -0.6, 0.6);
			const perfOffset = noiseRange(week, salt + 4, -0.5, 0.5);
			return {
				effort: clamp(individualScores.effort + effortOffset),
				performance: clamp(individualScores.performance + perfOffset)
			};
		}
		case 'negative': {
			const effortOffset = -(0.8 + noiseRange(week, salt + 5, 0, 1));
			const perfOffset = -(1 + noiseRange(week, salt + 6, 0, 1.4));
			return {
				effort: clamp(individualScores.effort + effortOffset),
				performance: clamp(individualScores.performance + perfOffset)
			};
		}
		case 'sporadic': {
			// Only responds ~50% of the time
			if (noise(week, salt + 7) < 0.5) return null;
			const effortOffset = noiseRange(week, salt + 8, -1, 1);
			const perfOffset = noiseRange(week, salt + 9, -1, 1);
			return {
				effort: clamp(individualScores.effort + effortOffset),
				performance: clamp(individualScores.performance + perfOffset)
			};
		}
	}
}

/**
 * Get the number of active weeks for a persona (early_stage only gets 3).
 */
export function getActiveWeeks(pattern: PersonaPattern): number {
	if (pattern === 'early_stage') return 3;
	return 12;
}
