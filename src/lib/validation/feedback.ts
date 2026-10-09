import { z } from 'zod';

export const reviewerFeedbackSchema = z
	.object({
		token: z.string({ error: 'Feedback token is required' }).length(64, 'Invalid token'),
		effortScore: z.coerce
			.number({ error: 'Provide a number between 0 and 10' })
			.int()
			.min(0, 'Minimum score is 0')
			.max(10, 'Maximum score is 10')
			.optional(),
		performanceScore: z.coerce
			.number({ error: 'Provide a number between 0 and 10' })
			.int()
			.min(0, 'Minimum score is 0')
			.max(10, 'Maximum score is 10')
			.optional(),
		comment: z.string().trim().max(500, 'Keep comments under 500 characters').optional(),
		behavioralObservation: z
			.string()
			.trim()
			.max(500, 'Keep observations under 500 characters')
			.optional(),
		suggestion: z.string().trim().max(500, 'Keep suggestions under 500 characters').optional()
	})
	.refine(
		(data) =>
			data.effortScore !== undefined ||
			data.performanceScore !== undefined ||
			!!data.comment?.trim(),
		{
			message: 'Provide at least one score or a comment.',
			path: ['_form']
		}
	);

export type ReviewerFeedbackData = z.infer<typeof reviewerFeedbackSchema>;
