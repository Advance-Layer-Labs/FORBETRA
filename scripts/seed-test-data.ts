/**
 * Seed Test Data - Complete 12 Week Journey
 *
 * Creates a test individual with a complete 12-week journey including:
 * - Full goal and focusAreas
 * - 3 reviewers (positive, neutral, negative feedback patterns)
 * - All 12 weeks of checkIns (EFFORT, PROGRESS)
 * - Reviewer feedback for each week with varying patterns
 * - Links to test coach (coach@test.forbetra.com)
 *
 * Usage:
 *   npx tsx scripts/seed-test-data.ts
 */

import { PrismaClient, UserRole, JourneyStatus } from '@prisma/client';

const prisma = new PrismaClient();

const TEST_COACH_EMAIL = 'coach+clerk_test@test.forbetra.com';
const TEST_INDIVIDUAL_EMAIL = 'demo+clerk_test@test.forbetra.com';

// Generate realistic data patterns (0-10 scale)
function generateIndividualEffort(week: number): number {
	// Start lower, build up over time with some variation
	const base = 5 + week * 0.3; // Start around 5, build to ~8.5
	const variation = Math.sin(week * 0.5) * 1.5 + (Math.random() * 1 - 0.5);
	return Math.max(0, Math.min(10, Math.round((base + variation) * 10) / 10));
}

function generateIndividualProgress(week: number): number {
	// Steady upward trend with variation
	const base = 4 + week * 0.4; // Start around 4, build to ~8.8
	const variation = Math.cos(week * 0.4) * 1.2 + (Math.random() * 0.8 - 0.4);
	return Math.max(0, Math.min(10, Math.round((base + variation) * 10) / 10));
}

// Positive reviewer - generally rates higher, sees more progress
function generatePositiveReviewerFeedback(
	individualEffort: number,
	individualProgress: number
): { effort: number; progress: number } {
	const effortOffset = 1 + Math.random() * 1; // +1 to +2
	const progressOffset = 1.5 + Math.random() * 1.2; // +1.5 to +2.7
	return {
		effort: Math.max(0, Math.min(10, Math.round((individualEffort + effortOffset) * 10) / 10)),
		progress: Math.max(0, Math.min(10, Math.round((individualProgress + progressOffset) * 10) / 10))
	};
}

// Neutral reviewer - rates close to individual, slight variation
function generateNeutralReviewerFeedback(
	individualEffort: number,
	individualProgress: number
): { effort: number; progress: number } {
	const effortOffset = -0.6 + Math.random() * 1.2; // -0.6 to +0.6
	const progressOffset = -0.4 + Math.random() * 0.8; // -0.4 to +0.4
	return {
		effort: Math.max(0, Math.min(10, Math.round((individualEffort + effortOffset) * 10) / 10)),
		progress: Math.max(0, Math.min(10, Math.round((individualProgress + progressOffset) * 10) / 10))
	};
}

// Negative reviewer - generally rates lower, sees less progress
function generateNegativeReviewerFeedback(
	individualEffort: number,
	individualProgress: number
): { effort: number; progress: number } {
	const effortOffset = -0.8 - Math.random() * 1; // -0.8 to -1.8
	const progressOffset = -1 - Math.random() * 1.4; // -1 to -2.4
	return {
		effort: Math.max(0, Math.min(10, Math.round((individualEffort + effortOffset) * 10) / 10)),
		progress: Math.max(0, Math.min(10, Math.round((individualProgress + progressOffset) * 10) / 10))
	};
}

async function seedTestData() {
	console.log('🌱 Seeding test data for visualization preview...\n');

	try {
		// Step 1: Find or create test coach
		console.log('👤 Setting up test coach...');
		let coach = await prisma.user.findUnique({
			where: { email: TEST_COACH_EMAIL }
		});

		if (!coach) {
			console.log('   Creating new test coach...');
			coach = await prisma.user.create({
				data: {
					email: TEST_COACH_EMAIL,
					name: 'Test Coach',
					role: UserRole.COACH
				}
			});
			console.log(`   ✅ Created coach: ${coach.email}`);
		} else {
			console.log(`   ✅ Found existing coach: ${coach.email}`);
		}

		// Step 2: Clean up existing demo individual if it exists
		console.log('\n🧹 Cleaning up existing demo individual...');
		const existingIndividual = await prisma.user.findUnique({
			where: { email: TEST_INDIVIDUAL_EMAIL },
			include: {
				goals: {
					include: {
						journeys: true,
						reviewers: true,
						focusAreas: true
					}
				}
			}
		});

		if (existingIndividual) {
			console.log('   Deleting existing demo individual and all related data...');
			await prisma.$transaction(async (tx) => {
				for (const goal of existingIndividual.goals) {
					for (const journey of goal.journeys) {
						await tx.feedback.deleteMany({ where: { journeyId: journey.id } });
						await tx.checkIn.deleteMany({ where: { journeyId: journey.id } });
					}
					await tx.journey.deleteMany({ where: { goalId: goal.id } });
					await tx.focusArea.deleteMany({ where: { goalId: goal.id } });
					await tx.reviewer.deleteMany({ where: { goalId: goal.id } });
				}
				await tx.goal.deleteMany({ where: { userId: existingIndividual.id } });
				await tx.coachClient.deleteMany({ where: { individualId: existingIndividual.id } });
				await tx.coachNote.deleteMany({ where: { individualId: existingIndividual.id } });
				await tx.user.delete({ where: { id: existingIndividual.id } });
			});
			console.log('   ✅ Cleaned up existing data');
		}

		// Step 3: Create test individual
		console.log('\n👤 Creating test individual...');
		const individual = await prisma.user.create({
			data: {
				email: TEST_INDIVIDUAL_EMAIL,
				name: 'Demo User',
				role: UserRole.INDIVIDUAL
			}
		});
		console.log(`   ✅ Created individual: ${individual.email}`);

		// Step 4: Link to coach
		console.log('\n🔗 Linking individual to coach...');
		await prisma.coachClient.create({
			data: {
				coachId: coach.id,
				individualId: individual.id
			}
		});
		console.log('   ✅ Linked to coach');

		// Step 5: Create goal and focusAreas
		console.log('\n🎯 Creating goal and focusAreas...');
		const goal = await prisma.goal.create({
			data: {
				userId: individual.id,
				title: 'Improve Communication Clarity',
				description:
					'Enhance communication skills to be more clear and effective in professional interactions',
				active: true,
				focusAreas: {
					create: [
						{
							label: 'Listen actively in meetings',
							description: 'Practice active listening and ask clarifying questions',
							order: 1
						},
						{
							label: 'Provide clear updates',
							description: 'Give concise, structured updates to team members',
							order: 2
						},
						{
							label: 'Reduce ambiguity in requests',
							description: 'Be specific and clear when making requests or delegating',
							order: 3
						}
					]
				}
			},
			include: {
				focusAreas: true
			}
		});
		console.log(`   ✅ Created goal: ${goal.title}`);
		console.log(`   ✅ Created ${goal.focusAreas.length} focusAreas`);

		// Step 6: Create 3 reviewers
		console.log('\n👥 Creating reviewers...');
		const reviewers = await Promise.all([
			prisma.reviewer.create({
				data: {
					individualId: individual.id,
					goalId: goal.id,
					name: 'Sarah Chen',
					email: 'sarah.positive@test.forbetra.com',
					relationship: 'Team Lead'
				}
			}),
			prisma.reviewer.create({
				data: {
					individualId: individual.id,
					goalId: goal.id,
					name: 'Mike Johnson',
					email: 'mike.neutral@test.forbetra.com',
					relationship: 'Colleague'
				}
			}),
			prisma.reviewer.create({
				data: {
					individualId: individual.id,
					goalId: goal.id,
					name: 'Alex Rivera',
					email: 'alex.negative@test.forbetra.com',
					relationship: 'Manager'
				}
			})
		]);
		console.log(`   Created ${reviewers.length} reviewers`);
		await prisma.reviewer.create({
			data: {
				individualId: individual.id,
				goalId: goal.id,
				userId: coach.id,
				name: coach.name ?? 'Coach',
				email: coach.email,
				relationship: 'Coach',
				cadence: 'WEEKLY',
				attribution: 'COACH'
			}
		});
		console.log(`      - ${reviewers[0].name} (Positive feedback pattern)`);
		console.log(`      - ${reviewers[1].name} (Neutral feedback pattern)`);
		console.log(`      - ${reviewers[2].name} (Negative feedback pattern)`);

		// Step 7: Create 12-week journey
		console.log('\n📅 Creating 12-week journey...');
		const cycleStartDate = new Date();
		cycleStartDate.setDate(cycleStartDate.getDate() - 12 * 7); // 12 weeks ago
		cycleStartDate.setHours(0, 0, 0, 0);

		const cycleEndDate = new Date(cycleStartDate);
		cycleEndDate.setDate(cycleEndDate.getDate() + 12 * 7);

		const journey = await prisma.journey.create({
			data: {
				userId: individual.id,
				goalId: goal.id,
				label: 'Journey 1',
				startDate: cycleStartDate,
				endDate: cycleEndDate,
				status: JourneyStatus.COMPLETED
			}
		});
		console.log(
			`   Created journey: ${journey.label} (${cycleStartDate.toISOString().split('T')[0]} to ${cycleEndDate.toISOString().split('T')[0]})`
		);
		await prisma.insight.create({
			data: {
				userId: individual.id,
				journeyId: journey.id,
				weekNumber: 2,
				type: 'WEEKLY_SYNTHESIS',
				status: 'COMPLETED',
				content: 'Two check-ins in a week average into the self score. The coach review counts once.'
			}
		});

		// Step 8: Create checkIns and feedback for all 12 weeks
		console.log('\n📝 Generating checkIns and feedback...');

		const focusAreaCount = goal.focusAreas.length;
		console.log(`   ✅ Created ${focusAreaCount} focus areas`);
		let totalReflections = 0;
		let totalFeedbacks = 0;

		for (let week = 1; week <= 12; week++) {
			// Calculate dates for this week
			const weekStartDate = new Date(cycleStartDate);
			weekStartDate.setDate(weekStartDate.getDate() + (week - 1) * 7);

			const wednesdayDate = new Date(weekStartDate);
			wednesdayDate.setDate(wednesdayDate.getDate() + 2);
			const fridayDate = new Date(weekStartDate);
			fridayDate.setDate(fridayDate.getDate() + 4);

			// Generate individual scores for this week
			const individualEffort = generateIndividualEffort(week);
			const individualProgress = generateIndividualProgress(week);

			await prisma.checkIn.create({
				data: {
					journeyId: journey.id,
					userId: individual.id,
					submittedAt: wednesdayDate,
					effortScore: Math.round(individualEffort),
					performanceScore: Math.round(individualProgress * 0.9),
					notes: `Week ${week} mid-week check-in`
				}
			});
			totalReflections++;

			await prisma.checkIn.create({
				data: {
					journeyId: journey.id,
					userId: individual.id,
					submittedAt: fridayDate,
					effortScore: Math.round(individualEffort),
					performanceScore: Math.round(individualProgress),
					notes: `Week ${week} end-of-week check-in`
				}
			});
			totalReflections++;

			const positiveFeedback = generatePositiveReviewerFeedback(
				individualEffort,
				individualProgress
			);
			const neutralFeedback = generateNeutralReviewerFeedback(
				individualEffort,
				individualProgress
			);
			const negativeFeedback = generateNegativeReviewerFeedback(
				individualEffort,
				individualProgress
			);

			const feedbackDate = new Date(fridayDate);
			feedbackDate.setHours(18, 0, 0, 0);

			const feedbackRows = [
				{ reviewer: reviewers[0], scores: positiveFeedback, comment: 'Great work this week.' },
				{ reviewer: reviewers[1], scores: neutralFeedback, comment: 'Steady progress this week.' },
				{ reviewer: reviewers[2], scores: negativeFeedback, comment: 'Some areas still need work.' }
			];
			for (const row of feedbackRows) {
				await prisma.feedback.create({
					data: {
						journeyId: journey.id,
						reviewerId: row.reviewer.id,
						weekNumber: week,
						effortScore: Math.round(row.scores.effort),
						performanceScore: Math.round(row.scores.progress),
						submittedAt: feedbackDate,
						comment: row.comment
					}
				});
				totalFeedbacks++;
			}
		}

		console.log(`   ✅ Created ${totalReflections} checkIns`);
		console.log(`   ✅ Created ${totalFeedbacks} feedback entries`);

		console.log('\n✅ Test data seeding complete!');
		console.log('\n📊 Summary:');
		console.log(`   - Individual: ${individual.email}`);
		console.log(`   - Coach: ${coach.email}`);
		console.log(`   - Goal: ${goal.title}`);
		console.log(
			`   - Journey: 12 weeks (${cycleStartDate.toISOString().split('T')[0]} to ${cycleEndDate.toISOString().split('T')[0]})`
		);
		console.log(`   - Reflections: ${totalReflections} (EFFORT + PROGRESS for 12 weeks)`);
		console.log(`   - Reviewer Feedback: ${totalFeedbacks} (3 reviewers × 12 weeks)`);
		console.log('\n🎨 You can now preview the visualization by:');
		console.log(
			`   1. Sign up/sign in as ${TEST_INDIVIDUAL_EMAIL} (will auto-link to seeded data)`
		);
		console.log(`   2. Or sign up/sign in as ${TEST_COACH_EMAIL} and view the client roster`);
		console.log('');
		console.log("💡 Note: Users don't need to exist in Clerk first. When you sign up/sign in");
		console.log(
			'   with these emails, Clerk will automatically link to the seeded Prisma records.'
		);
		console.log('');
	} catch (error: unknown) {
		console.error('\n❌ Error seeding test data:', error);
		if ((error as Record<string, unknown>).code === 'P2002') {
			console.error('   ⚠️  Unique constraint error. Data may already exist.');
		}
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

seedTestData().catch((error) => {
	console.error('❌ Fatal error:', error);
	process.exit(1);
});
