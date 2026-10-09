/**
 * Delete Test Users
 *
 * Deletes coach@test.forbetra.com and user@test.forbetra.com
 * and all their associated data from the database.
 *
 * Usage:
 *   npx tsx scripts/delete-test-users.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_EMAILS = ['coach@test.forbetra.com', 'user@test.forbetra.com'];

async function deleteTestUsers() {
	console.log('🗑️  Deleting test users and all associated data...\n');

	for (const email of TEST_EMAILS) {
		try {
			console.log(`\n📧 Processing: ${email}`);

			const user = await prisma.user.findUnique({
				where: { email: email.toLowerCase() },
				include: {
					goals: true,
					coachNotesAuthored: true,
					coachNotesReceived: true
				}
			});

			if (!user) {
				console.log(`   ⚠️  User not found, skipping...`);
				continue;
			}

			console.log(`   📝 Found user: ${user.name || 'Unnamed'} (ID: ${user.id})`);

			// Delete related records first to avoid foreign key constraints
			await prisma.$transaction(async (tx) => {
				// Get all journeys for this user's goals
				const goalIds = user.goals.map((o) => o.id);
				const journeys = await tx.journey.findMany({
					where: { goalId: { in: goalIds } }
				});
				const journeyIds = journeys.map((journey) => journey.id);

				const checkInCount = await tx.checkIn.count({
					where: { journeyId: { in: journeyIds } }
				});

				console.log(`   Deleting feedback for ${journeyIds.length} journeys...`);
				await tx.feedback.deleteMany({
					where: { journeyId: { in: journeyIds } }
				});

				console.log(`   Deleting ${checkInCount} check-ins...`);
				await tx.checkIn.deleteMany({
					where: { journeyId: { in: journeyIds } }
				});

				console.log(`   🗑️  Deleting ${journeyIds.length} journey records...`);
				// Delete journeys
				await tx.journey.deleteMany({ where: { goalId: { in: goalIds } } });

				console.log(`   🗑️  Deleting focusAreas...`);
				// Delete focusAreas linked to goals
				await tx.focusArea.deleteMany({ where: { goalId: { in: goalIds } } });

				console.log(`   🗑️  Deleting ${goalIds.length} goal records...`);
				// Delete goals
				await tx.goal.deleteMany({ where: { userId: user.id } });

				console.log(`   🗑️  Deleting coach notes...`);
				// Delete coach notes
				await tx.coachNote.deleteMany({
					where: {
						OR: [{ coachId: user.id }, { individualId: user.id }]
					}
				});

				console.log(`   🗑️  Deleting coach-client relationships...`);
				// Delete other related records
				await tx.coachClient.deleteMany({
					where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
				});

				console.log(`   🗑️  Deleting coach invites...`);
				await tx.coachInvite.deleteMany({
					where: { OR: [{ coachId: user.id }, { individualId: user.id }] }
				});

				console.log(`   🗑️  Deleting reviewers...`);
				await tx.reviewer.deleteMany({
					where: { OR: [{ individualId: user.id }, { invitedById: user.id }] }
				});

				console.log(`   🗑️  Deleting tokens...`);
				await tx.token.deleteMany({ where: { userId: user.id } });

				console.log(`   🗑️  Deleting user record...`);
				// Finally delete the user
				await tx.user.delete({ where: { id: user.id } });
			});

			console.log(`   ✅ Successfully deleted ${email}`);
		} catch (error: unknown) {
			console.error(`   ❌ Error deleting ${email}:`, (error as Error).message);
			if ((error as Record<string, unknown>).code === 'P2003') {
				console.error(`   ⚠️  Foreign key constraint error. There may be additional related data.`);
			}
		}
	}

	console.log('\n✅ Test user deletion complete!');
}

deleteTestUsers()
	.catch((error) => {
		console.error('❌ Fatal error:', error);
		process.exit(1);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
