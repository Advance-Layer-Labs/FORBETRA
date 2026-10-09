import type { Prisma } from '@prisma/client';
import { weekNumberForDate } from '$lib/server/domain';
import type { buildClientSummary } from '$lib/server/buildClientSummary';

export type SummaryInput = NonNullable<Parameters<typeof buildClientSummary>[1]>;

export function clientSelect(coachId: string, opts: { noteTake?: number } = {}) {
	return {
		id: true,
		email: true,
		name: true,
		timezone: true,
		goals: {
			where: { active: true },
			orderBy: { createdAt: 'desc' },
			take: 1,
			select: {
				id: true,
				title: true,
				description: true,
				focusAreas: {
					where: { active: true },
					orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
					select: { id: true, label: true, description: true }
				},
				journeys: {
					orderBy: { startDate: 'desc' },
					take: 8,
					select: {
						id: true,
						label: true,
						startDate: true,
						endDate: true,
						status: true,
						lengthWeeks: true,
						checkIns: {
							orderBy: { submittedAt: 'desc' },
							select: {
								id: true,
								submittedAt: true,
								effortScore: true,
								performanceScore: true,
								notes: true
							}
						},
						coachNotes: {
							where: { coachId },
							orderBy: { createdAt: 'desc' },
							take: opts.noteTake,
							select: { id: true, content: true, weekNumber: true, createdAt: true }
						},
						feedback: {
							orderBy: { submittedAt: 'desc' },
							select: {
								reviewerId: true,
								weekNumber: true,
								submittedAt: true,
								effortScore: true,
								performanceScore: true,
								comment: true,
								behavioralObservation: true,
								suggestion: true
							}
						}
					}
				}
			}
		},
		reviewers: {
			orderBy: { createdAt: 'asc' },
			select: { id: true, name: true, email: true, goalId: true, attribution: true }
		}
	} satisfies Prisma.UserSelect;
}

export type ClientRecord = Prisma.UserGetPayload<{ select: ReturnType<typeof clientSelect> }>;
type JourneyRecord = ClientRecord['goals'][number]['journeys'][number];

export function currentGoal(user: ClientRecord) {
	return user.goals[0] ?? null;
}

/** Prefer the journey the client is on now. A newer completed journey must not hide it. */
export function preferActiveJourney<T extends { status: string; startDate: Date }>(
	journeys: T[]
): T[] {
	const byStart = (a: T, b: T) => b.startDate.getTime() - a.startDate.getTime();
	const active = journeys.filter((journey) => journey.status === 'ACTIVE').sort(byStart);
	const rest = journeys.filter((journey) => journey.status !== 'ACTIVE').sort(byStart);
	return [...active, ...rest];
}

export function currentJourney(user: ClientRecord): JourneyRecord | null {
	const journeys = currentGoal(user)?.journeys ?? [];
	return preferActiveJourney(journeys)[0] ?? null;
}

/** Reviewers are unique per individual+email, so a coach reviewing their client appears once. */
export function goalReviewers(user: ClientRecord) {
	const goal = currentGoal(user);
	if (!goal) return [];
	return user.reviewers.filter((r) => !r.goalId || r.goalId === goal.id);
}

export function checkInsWithWeek(journey: JourneyRecord, timeZone?: string | null) {
	return journey.checkIns.map((c) => ({
		...c,
		weekNumber: weekNumberForDate(journey.startDate, c.submittedAt, timeZone)
	}));
}

export function feedbackByReviewer(
	journey: JourneyRecord | null,
	reviewerId: string,
	take?: number
) {
	const rows = journey ? journey.feedback.filter((f) => f.reviewerId === reviewerId) : [];
	return take ? rows.slice(0, take) : rows;
}

export function toSummaryInput(
	user: ClientRecord,
	opts: { feedbackTake?: number } = {}
): SummaryInput {
	const reviewers = goalReviewers(user);
	return {
		id: user.id,
		email: user.email,
		name: user.name,
		timezone: user.timezone,
		goals: user.goals.map((goal) => ({
			id: goal.id,
			title: goal.title,
			description: goal.description,
			focusAreas: goal.focusAreas,
			journeys: preferActiveJourney(goal.journeys).map((journey) => ({
				id: journey.id,
				label: journey.label,
				startDate: journey.startDate,
				endDate: journey.endDate,
				status: journey.status,
				lengthWeeks: journey.lengthWeeks,
				checkIns: checkInsWithWeek(journey, user.timezone),
				coachNotes: journey.coachNotes
			})),
			reviewers: reviewers.map((reviewer) => ({
				id: reviewer.id,
				name: reviewer.name,
				email: reviewer.email,
				feedbacks: feedbackByReviewer(
					preferActiveJourney(goal.journeys)[0] ?? null,
					reviewer.id,
					opts.feedbackTake
				).map((f) => ({
					submittedAt: f.submittedAt,
					effortScore: f.effortScore,
					performanceScore: f.performanceScore,
					reflection: {
						weekNumber: f.weekNumber,
						effortScore: f.effortScore,
						performanceScore: f.performanceScore
					}
				}))
			}))
		}))
	};
}
