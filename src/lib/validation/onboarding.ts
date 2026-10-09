import { z } from 'zod';

const goalTitle = z
	.string()
	.trim()
	.min(3, 'Goal title must be at least 3 characters')
	.max(200, 'Keep the goal title concise');

const goalDescription = z
	.string()
	.trim()
	.max(1000, 'Keep the description under 1000 characters')
	.optional();

/** First-run gate: name the goal. Journey length, reviewers, and focus areas are not collected here. */
export const onboardingSchema = z.object({
	goalTitle,
	goalDescription
});

export const newJourneySchema = z.object({
	goalTitle,
	goalDescription,
	journeyLabel: z.string().trim().max(80, 'Journey label is too long').optional(),
	journeyStartDate: z
		.string()
		.refine((value) => value.length > 0, 'Start date is required')
		.refine((value) => !Number.isNaN(Date.parse(value)), 'Provide a valid start date')
		.optional()
		.default(new Date().toISOString().slice(0, 10)),
	lengthWeeks: z.union([z.literal(6), z.literal(12), z.literal(16)]).default(12)
});

const focusAreaSchema = z.object({
	label: z
		.string()
		.trim()
		.min(3, 'Focus area label must be at least 3 characters')
		.max(200, 'Keep the focus area label concise'),
	description: z
		.string()
		.trim()
		.max(500, 'Keep the focus area details under 500 characters')
		.optional()
});

export const focusAreasSchema = z.object({
	focusAreas: z
		.array(focusAreaSchema)
		.min(1, 'Add at least one focus area')
		.max(5, 'Keep it to five focus areas or fewer')
});

export type OnboardingFormData = z.infer<typeof onboardingSchema>;
