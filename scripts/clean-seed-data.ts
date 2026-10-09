/**
 * Clean Seed Data
 *
 * Deletes all seed-created data by email pattern (+seed@test.forbetra.com).
 * Uses cascading transaction to avoid foreign key constraint violations.
 *
 * Usage: npx tsx scripts/clean-seed-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { SEED_EMAIL_PATTERN } from './seed-config';

const prisma = new PrismaClient();

async function cleanSeedData() {
	console.log('Clean Seed Data');
	console.log('===============\n');

	const seedUsers = await prisma.user.findMany({
		where: { email: { contains: SEED_EMAIL_PATTERN } },
		include: {
			goals: {
				include: {
					journeys: {
						include: {
							checkIns: { select: { id: true } },
							coachNotes: { select: { id: true } }
						}
					},
					reviewers: { select: { id: true } },
					focusAreas: { select: { id: true } }
				}
			}
		}
	});

	if (seedUsers.length === 0) {
		console.log('No seed data found. Nothing to clean.\n');
		await prisma.$disconnect();
		return;
	}

	console.log(`Found ${seedUsers.length} seed users to remove:\n`);
	for (const user of seedUsers) {
		console.log(`  ${user.name ?? 'Unnamed'} (${user.email}) — ${user.role}`);
	}

	console.log('\nDeleting all related data...');

	await prisma.$transaction(
		async (tx) => {
			const deletedFeedback = 0;
			const deletedReflections = 0;
			let deletedCoachNotes = 0;
			let deletedCycles = 0;
			let deletedFocusAreas = 0;
			let deletedReviewers = 0;
			let deletedGoals = 0;
			let deletedCoachClients = 0;
			let deletedCoachInvites = 0;
			let deletedTokens = 0;

			for (const user of seedUsers) {
				for (const goal of user.goals) {
					for (const journey of goal.journeys) {
						// Delete feedback on checkIns
						await tx.feedback.deleteMany({ where: { journeyId: journey.id } });
						await tx.checkIn.deleteMany({ where: { journeyId: journey.id } });

						// Delete coach notes on journey
						const noteResult = await tx.coachNote.deleteMany({
							where: { journeyId: journey.id }
						});
						deletedCoachNotes += noteResult.count;
					}

					// Delete journeys
					const cycleResult = await tx.journey.deleteMany({
						where: { goalId: goal.id }
					});
					deletedCycles += cycleResult.count;

					// Delete focusAreas
					const sgResult = await tx.focusArea.deleteMany({
						where: { goalId: goal.id }
					});
					deletedFocusAreas += sgResult.count;

					// Delete reviewers
					const shResult = await tx.reviewer.deleteMany({
						where: { goalId: goal.id }
					});
					deletedReviewers += shResult.count;
				}

				// Delete goals
				const objResult = await tx.goal.deleteMany({
					where: { userId: user.id }
				});
				deletedGoals += objResult.count;

				// Delete coach-related records
				const ccResult = await tx.coachClient.deleteMany({
					where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
				});
				deletedCoachClients += ccResult.count;

				const ciResult = await tx.coachInvite.deleteMany({
					where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
				});
				deletedCoachInvites += ciResult.count;

				// Delete remaining coach notes (not tied to journeys)
				const cnResult = await tx.coachNote.deleteMany({
					where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
				});
				deletedCoachNotes += cnResult.count;

				// Delete tokens
				const tokenResult = await tx.token.deleteMany({
					where: { userId: user.id }
				});
				deletedTokens += tokenResult.count;

				// Delete insights
				await tx.insight.deleteMany({
					where: { userId: user.id }
				});

				// Delete organization memberships
				await tx.organizationMember.deleteMany({
					where: { userId: user.id }
				});

				// Delete user
				await tx.user.delete({ where: { id: user.id } });
			}

			console.log('\nDeleted:');
			console.log(`  Users: ${seedUsers.length}`);
			console.log(`  Goals: ${deletedGoals}`);
			console.log(`  Journeys: ${deletedCycles}`);
			console.log(`  FocusAreas: ${deletedFocusAreas}`);
			console.log(`  Reflections: ${deletedReflections}`);
			console.log(`  Feedback entries: ${deletedFeedback}`);
			console.log(`  Reviewers: ${deletedReviewers}`);
			console.log(`  Coach notes: ${deletedCoachNotes}`);
			console.log(`  Coach-client links: ${deletedCoachClients}`);
			console.log(`  Coach invites: ${deletedCoachInvites}`);
			console.log(`  Tokens: ${deletedTokens}`);
		},
		{ timeout: 60000 }
	);

	console.log('\nSeed data cleaned successfully.\n');
	await prisma.$disconnect();
}

cleanSeedData().catch((error) => {
	console.error('Fatal error:', error);
	process.exit(1);
});
