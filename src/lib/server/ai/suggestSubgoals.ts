import anthropic from './client';

const MODEL_ID = process.env.ANTHROPIC_MODEL_ID || 'claude-sonnet-4-5-20250929';

const SYSTEM = `You suggest concrete, measurable subgoals for a professional development objective.

Your output is consumed by a form auto-fill, NOT shown to a user as prose. Output ONLY a JSON array of 3 strings. Each string is 5-12 words. No preamble, no markdown, no trailing commentary — just the JSON array.

Each subgoal must be:
- A specific behavior or output the person could observe weekly
- Not the objective restated; each subgoal should be a distinct facet
- Phrased neutrally (no "I will" — write the behavior itself)
- Concrete enough that a stakeholder could rate it 0-10

Bad: "Improve communication" (too vague)
Good: "Run weekly 1:1s with a clear agenda and notes"

Bad: "Be a better leader" (too vague)
Good: "Make decisions visible by sharing reasoning, not just outcomes"`;

/**
 * Suggest 3 concrete, measurable subgoals for a development objective.
 * Used in the onboarding wizard to lower the cold-start cognitive load.
 * Returns [] silently on any error — the UI hides chips when empty.
 */
export async function suggestSubgoals(objectiveTitle: string): Promise<string[]> {
	const trimmed = objectiveTitle.trim();
	if (trimmed.length < 10 || trimmed.length > 500) return [];

	try {
		const response = await anthropic.messages.create({
			model: MODEL_ID,
			max_tokens: 256,
			temperature: 0.7,
			system: SYSTEM,
			messages: [{ role: 'user', content: `Objective: ${trimmed}` }]
		});

		const text = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';

		// Find the JSON array — model should output ONLY the array but be tolerant
		// of trailing whitespace or accidental fencing.
		const match = text.match(/\[[\s\S]*\]/);
		if (!match) return [];

		const parsed = JSON.parse(match[0]);
		if (!Array.isArray(parsed)) return [];

		return parsed
			.filter((s): s is string => typeof s === 'string')
			.map((s) => s.trim())
			.filter((s) => s.length > 0 && s.length <= 200)
			.slice(0, 3);
	} catch (err) {
		console.warn('[ai:warn] suggestSubgoals failed', err);
		return [];
	}
}
