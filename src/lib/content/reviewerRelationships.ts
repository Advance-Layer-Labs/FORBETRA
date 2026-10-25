import type { ReviewerContext } from './onboardingTemplates';

export const REVIEWER_RELATIONSHIPS = [
	'Direct Manager',
	'Skip-Level Manager',
	'Peer',
	'Direct Report',
	'Cross-Functional Partner',
	'HR Partner',
	'Coach',
	'Teammate',
	'Trainer',
	'Parent / guardian',
	'Teacher',
	'Mentor',
	'Other'
] as const;

const SPORTS_FIRST = [
	'Coach',
	'Teammate',
	'Trainer',
	'Parent / guardian',
	'Teacher',
	'Mentor'
] as const;

const MILITARY_FIRST = ['Peer', 'Mentor', 'Coach', 'Teacher'] as const;

const NEUTRAL_FIRST = [
	'Coach',
	'Teammate',
	'Mentor',
	'Peer',
	'Trainer',
	'Teacher',
	'Parent / guardian'
] as const;

function orderWithPriority(priority: readonly string[]): string[] {
	const known = new Set<string>(REVIEWER_RELATIONSHIPS);
	const first = priority.filter((role) => known.has(role));
	const firstSet = new Set(first);
	const rest = REVIEWER_RELATIONSHIPS.filter((role) => role !== 'Other' && !firstSet.has(role));
	return [...first, ...rest, 'Other'];
}

export function relationshipsForContext(context: ReviewerContext): string[] {
	if (context === 'sports') return orderWithPriority(SPORTS_FIRST);
	if (context === 'military') return orderWithPriority(MILITARY_FIRST);
	if (context === 'neutral') return orderWithPriority(NEUTRAL_FIRST);
	return [...REVIEWER_RELATIONSHIPS];
}

export function relationshipTooltipForContext(context: ReviewerContext): string {
	if (context === 'sports') {
		return 'A coach or trainer works with you. A teammate is someone you play with. Parent/guardian, teacher, and mentor are people who see you in action.';
	}
	if (context === 'military') {
		return 'A peer shares the work with you. A mentor or coach is someone you trust to tell you what they see.';
	}
	if (context === 'neutral') {
		return 'Pick whoever regularly sees you in action — a coach, teammate, peer, manager, or mentor.';
	}
	return 'Skip-level is your manager’s manager. Cross-functional is someone on another team.';
}
