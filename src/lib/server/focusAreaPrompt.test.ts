import { describe, expect, it } from 'vitest';
import {
	FOCUS_AREA_PROMPT_GAP_MS,
	LAST_SEEN_THROTTLE_MS,
	shouldArmFocusAreaPrompt,
	shouldTouchLastSeen
} from './focusAreaPrompt';

const now = new Date('2026-10-09T12:00:00.000Z');

describe('shouldArmFocusAreaPrompt', () => {
	it('arms when the gap is at least 14 days, a goal is active, and it has no focus areas', () => {
		const lastSeenAt = new Date(now.getTime() - FOCUS_AREA_PROMPT_GAP_MS);
		expect(
			shouldArmFocusAreaPrompt({
				lastSeenAt,
				now,
				hasActiveGoal: true,
				hasFocusAreas: false
			})
		).toBe(true);
	});

	it('does not arm on a fresh account with no last-seen timestamp', () => {
		expect(
			shouldArmFocusAreaPrompt({
				lastSeenAt: null,
				now,
				hasActiveGoal: true,
				hasFocusAreas: false
			})
		).toBe(false);
	});

	it('does not arm when the gap is shorter than 14 days', () => {
		const lastSeenAt = new Date(now.getTime() - FOCUS_AREA_PROMPT_GAP_MS + 60_000);
		expect(
			shouldArmFocusAreaPrompt({
				lastSeenAt,
				now,
				hasActiveGoal: true,
				hasFocusAreas: false
			})
		).toBe(false);
	});

	it('does not arm when the goal already has focus areas', () => {
		const lastSeenAt = new Date(now.getTime() - FOCUS_AREA_PROMPT_GAP_MS - 60_000);
		expect(
			shouldArmFocusAreaPrompt({
				lastSeenAt,
				now,
				hasActiveGoal: true,
				hasFocusAreas: true
			})
		).toBe(false);
	});

	it('does not arm when there is no active goal', () => {
		const lastSeenAt = new Date(now.getTime() - FOCUS_AREA_PROMPT_GAP_MS);
		expect(
			shouldArmFocusAreaPrompt({
				lastSeenAt,
				now,
				hasActiveGoal: false,
				hasFocusAreas: false
			})
		).toBe(false);
	});
});

describe('shouldTouchLastSeen', () => {
	it('writes on the first sighting', () => {
		expect(shouldTouchLastSeen(null, now)).toBe(true);
	});

	it('skips a write inside the throttle window', () => {
		const lastSeenAt = new Date(now.getTime() - LAST_SEEN_THROTTLE_MS + 1_000);
		expect(shouldTouchLastSeen(lastSeenAt, now)).toBe(false);
	});

	it('writes again once the throttle window has passed', () => {
		const lastSeenAt = new Date(now.getTime() - LAST_SEEN_THROTTLE_MS);
		expect(shouldTouchLastSeen(lastSeenAt, now)).toBe(true);
	});
});
