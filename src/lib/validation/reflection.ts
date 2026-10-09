import { z } from 'zod';

export const checkInEntrySchema = z.object({
	effortScore: z.coerce
		.number({ error: 'Effort score must be a number' })
		.int()
		.min(0, 'Minimum effort score is 0')
		.max(10, 'Maximum effort score is 10'),
	performanceScore: z.coerce
		.number({ error: 'Performance score must be a number' })
		.int()
		.min(0, 'Minimum performance score is 0')
		.max(10, 'Maximum performance score is 10'),
	notes: z.string().trim().max(1000, 'Keep notes under 1000 characters').optional()
});

export type CheckInEntryData = z.infer<typeof checkInEntrySchema>;
