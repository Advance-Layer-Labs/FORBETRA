/**
 * Backfill Insights Script
 *
 * Generates WEEKLY_SYNTHESIS insights for all completed weeks
 * that don't already have one. Useful after seeding comprehensive
 * test data to populate the AI insights cards.
 *
 * Usage: npx tsx scripts/backfill-insights.ts
 *
 * Requires ANTHROPIC_API_KEY to be set in .env
 */

import { PrismaClient } from '@prisma/client';
import { weekNumberForDate } from '../src/lib/server/domain/week';

const prisma = new PrismaClient();

async function backfillInsights() {
	console.log('Backfill Insights');
	console.log('=================\n');

	if (!process.env.ANTHROPIC_API_KEY) {
		console.error('ANTHROPIC_API_KEY is not set. Add it to your .env file.');
		process.exit(1);
	}

	// Dynamic import to get SvelteKit module resolution
	const { generateWeeklySynthesis } = await import('../src/lib/server/ai/generateInsight');

	// Find all journeys with checkIns
	const journeys = await prisma.journey.findMany({
		where: {
			checkIns: { some: {} }
		},
		include: {
			checkIns: { select: { submittedAt: true } },
			insights: {
				where: { type: 'WEEKLY_SYNTHESIS' },
				select: { weekNumber: true }
			}
		}
	});

	let generated = 0;
	let skipped = 0;
	let failed = 0;

	for (const journey of journeys) {
		const existingWeeks = new Set(
			journey.insights.filter((i) => i.weekNumber !== null).map((i) => i.weekNumber!)
		);

		const weekNumbers = [
			...new Set(
				journey.checkIns.map((checkIn) => weekNumberForDate(journey.startDate, checkIn.submittedAt))
			)
		].sort((a, b) => a - b);

		for (const week of weekNumbers) {
			if (existingWeeks.has(week)) {
				skipped++;
				continue;
			}

			console.log(`  Generating insight for journey ${journey.id}, week ${week}...`);

			try {
				const insightId = await generateWeeklySynthesis(journey.userId, journey.id, week);
				if (insightId) {
					generated++;
					console.log(`    Done (${insightId})`);
				} else {
					failed++;
					console.log(`    Failed`);
				}
			} catch (error: unknown) {
				failed++;
				console.error(`    Error: ${(error as Error).message}`);
			}

			// Small delay between API calls to avoid rate limiting
			await new Promise((resolve) => setTimeout(resolve, 500));
		}
	}

	console.log('\n=================');
	console.log(`Generated: ${generated}`);
	console.log(`Skipped (already exist): ${skipped}`);
	console.log(`Failed: ${failed}`);

	await prisma.$disconnect();
}

backfillInsights().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
