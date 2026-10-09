/**
 * Coach Notes Generator
 *
 * Generates realistic coach notes for each persona pattern.
 * Notes are created at key weeks: week 1 (kickoff), mid-point, and final/recent.
 */

import type { PersonaPattern } from './seed-config';

type NoteTemplate = {
	weekNumber: number;
	content: string;
};

function getNotesForPattern(pattern: PersonaPattern, totalWeeks: number): NoteTemplate[] {
	const midWeek = Math.ceil(totalWeeks / 2);

	switch (pattern) {
		case 'improving':
			return [
				{
					weekNumber: 1,
					content:
						'Kickoff session went well. Alex is motivated and has a clear picture of what executive presence looks like for them. We set concrete behavioral targets for the first 4 weeks. Key focus: leading standups without over-explaining.'
				},
				{
					weekNumber: midWeek,
					content:
						'Great momentum. Effort scores are climbing steadily and reviewer feedback is starting to reflect the change. Alex reports feeling more natural in meetings. Next focus: handling disagreements without retreating to passive mode.'
				},
				{
					weekNumber: totalWeeks,
					content:
						'Strong finish to the journey. The upward trend in both effort and performance is clear. Priya noted a "completely different energy" in standups. Alex is ready for a stretch goal in the next journey around strategic influence.'
				}
			];

		case 'plateaued':
			return [
				{
					weekNumber: 1,
					content:
						'Jordan came in highly motivated with prior cross-functional experience. We identified 3 key collaboration gaps. The initial scores reflect existing competence, so the challenge will be pushing beyond the comfort zone.'
				},
				{
					weekNumber: midWeek,
					content:
						'Plateau emerging. Effort and performance have stabilized around 6-7 but aren\'t trending up. Jordan seems satisfied with "good enough." Need to have a direct conversation about what the next level looks like and whether they want to push for it.'
				},
				{
					weekNumber: totalWeeks,
					content:
						'Discussed the plateau pattern openly. Jordan acknowledged comfort has become a barrier. We agreed that the next journey needs a stretch mechanism. Planning to add a "discomfort quota" where Jordan takes on one unfamiliar collaboration each week.'
				}
			];

		case 'declining':
			return [
				{
					weekNumber: 1,
					content:
						'Casey is enthusiastic about mentoring and has strong technical skills. Initial scores are high. Potential risk: Casey may be overcommitting given their current project load. Set clear boundaries on time allocation.'
				},
				{
					weekNumber: midWeek,
					content:
						'Concerned about the trajectory. Scores dropped significantly after week 6. Casey mentioned increased project pressure and difficulty finding time for mentoring sessions. We need to discuss sustainability before this becomes burnout.'
				},
				{
					weekNumber: 10,
					content:
						'Had a frank conversation about the declining pattern. Casey admitted to skipping mentoring sessions and feeling guilty about it. We reframed: sustainability is part of the skill. Adjusted expectations for remaining weeks and planned a recovery approach for next journey.'
				}
			];

		case 'high_performer':
			return [
				{
					weekNumber: 1,
					content:
						'Taylor is already operating at a high level. The opportunity here is about expanding scope of impact, not fixing deficits. We framed the journey around "leadership multiplication" rather than personal improvement.'
				},
				{
					weekNumber: midWeek,
					content:
						'Consistently excellent execution. The challenge with Taylor is keeping them engaged when they\'re already performing well. Introduced the concept of "10x leadership" where the goal is making others 10x better, not just maintaining personal excellence.'
				},
				{
					weekNumber: totalWeeks,
					content:
						'Taylor has been the model client for this journey. Both reviewers and self-ratings remain high. The next growth edge is navigating organizational politics at the VP level. Planning to introduce more challenging scenarios in the next journey.'
				}
			];

		case 'inconsistent':
			return [
				{
					weekNumber: 1,
					content:
						'Morgan recognizes the inconsistency problem and wants to change. We identified that the pattern is connected to energy management and context-switching. Set up a simple tracking system for the first 4 weeks.'
				},
				{
					weekNumber: midWeek,
					content:
						'The data tells the story: effort scores swinging from 2 to 9 week to week. Morgan gets inspired, over-delivers, then crashes. We need to focus on "boring consistency" rather than heroic bursts. Introduced the concept of sustainable baseline.'
				},
				{
					weekNumber: 10,
					content:
						'Some improvement in the variance but still significant swings. Derek (reviewer) flagged that the unpredictability is eroding team trust. This is now the #1 priority. We agreed on a "minimum viable week" framework: define the floor, then anything above is bonus.'
				}
			];

		case 'effort_gap':
			return [
				{
					weekNumber: 1,
					content:
						"Sam is clearly a hard worker, but there's a pattern of effort not converting to visible results. This is a prioritization and visibility issue, not a work ethic issue. Critical to frame this correctly to avoid Sam feeling undervalued."
				},
				{
					weekNumber: midWeek,
					content:
						'The gap between effort (8-9) and performance (3-5) is persistent and frustrating for Sam. We identified two root causes: working on wrong priorities and not making completed work visible. Introduced a "work audit" where Sam tags each task as high/medium/low impact.'
				},
				{
					weekNumber: totalWeeks,
					content:
						'The effort-performance gap remains the core challenge. Progress is slow but there are signs of improvement in prioritization. Sam started sending weekly "completed work" summaries and Ryan (Director) noted increased visibility. Next journey: deeper work on strategic thinking.'
				}
			];

		case 'late_bloomer':
			return [
				{
					weekNumber: 1,
					content:
						'Riley is new to data-driven approaches and seems overwhelmed by the concept. Scores are moderate. This will likely be a slow build. Need to manage expectations and focus on small wins early.'
				},
				{
					weekNumber: midWeek,
					content:
						'Still flat after 6 weeks. Riley is doing the motions but hasn\'t had the "aha moment" yet. Tempting to worry but some people need time to internalize new skills. Staying the course with encouragement and smaller, more concrete data exercises.'
				},
				{
					weekNumber: 10,
					content:
						'Breakthrough! Riley ran their first A/B test independently and the results drove a product decision. Scores jumped dramatically in weeks 9-10. Jessica (Product Director) called it "a transformation." This validates the patient approach. Riley is now self-motivated and building momentum.'
				}
			];

		case 'early_stage':
			return [
				{
					weekNumber: 1,
					content:
						'Jamie is just starting their development journey. We focused the kickoff on understanding the reviewer landscape and why it matters. Jamie has good instincts but lacks structured approach. The 12-week journey is appropriate.'
				},
				{
					weekNumber: 3,
					content:
						'Three weeks in and Jamie is engaged. Early scores show a slight upward trend. The reviewer mapping exercise was a hit. Next: moving from understanding reviewers to actively managing their expectations. This is where the real work begins.'
				}
			];
	}
}

export type CoachNoteData = {
	weekNumber: number;
	content: string;
};

/**
 * Generate coach notes for a persona.
 */
export function generateCoachNotes(pattern: PersonaPattern, totalWeeks: number): CoachNoteData[] {
	return getNotesForPattern(pattern, totalWeeks);
}
