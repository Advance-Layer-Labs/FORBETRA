/**
 * Seed Configuration - Test Persona Definitions
 *
 * Defines 8 individual personas with distinct behavioral patterns,
 * 3 coaches, and reviewer configurations for comprehensive test data.
 */

export type PersonaPattern =
	| 'improving'
	| 'plateaued'
	| 'declining'
	| 'high_performer'
	| 'inconsistent'
	| 'effort_gap'
	| 'late_bloomer'
	| 'early_stage';

export type ReviewerBias = 'positive' | 'neutral' | 'negative' | 'sporadic';

export type PersonaConfig = {
	name: string;
	email: string;
	pattern: PersonaPattern;
	goalTitle: string;
	goalDescription: string;
	focusAreas: Array<{ label: string; description: string }>;
	cycleWeeks: number;
	cycleStatus: 'ACTIVE' | 'COMPLETED';
	reviewers: Array<{
		name: string;
		email: string;
		relationship: string;
		bias: ReviewerBias;
	}>;
};

export type CoachConfig = {
	name: string;
	email: string;
	clientIndices: number[]; // indices into PERSONAS array
};

const SEED_DOMAIN = '+seed@test.forbetra.com';

export const COACHES: CoachConfig[] = [
	{
		name: 'Dr. Elena Vasquez',
		email: `elena.coach${SEED_DOMAIN}`,
		clientIndices: [0, 1, 2]
	},
	{
		name: 'Marcus Thompson',
		email: `marcus.coach${SEED_DOMAIN}`,
		clientIndices: [3, 4, 5]
	},
	{
		name: 'Sarah Okafor',
		email: `sarah.coach${SEED_DOMAIN}`,
		clientIndices: [6, 7]
	}
];

export const PERSONAS: PersonaConfig[] = [
	// 1. Improving - Alex Rivera
	{
		name: 'Alex Rivera',
		email: `alex.improving${SEED_DOMAIN}`,
		pattern: 'improving',
		goalTitle: 'Strengthen Executive Presence',
		goalDescription:
			'Develop the ability to command attention and project confidence in high-stakes meetings and presentations.',
		focusAreas: [
			{
				label: 'Lead weekly team standups with authority',
				description: 'Open and close standups with clear framing and decisive next steps'
			},
			{
				label: 'Deliver concise executive summaries',
				description: 'Summarize complex projects in 2-minute verbal overviews for leadership'
			},
			{
				label: 'Manage disagreements constructively',
				description: 'Address pushback without becoming defensive or passive'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'Priya Sharma',
				email: `priya.pos${SEED_DOMAIN}`,
				relationship: 'Direct Report',
				bias: 'positive'
			},
			{ name: 'James Wu', email: `james.neu${SEED_DOMAIN}`, relationship: 'Peer', bias: 'neutral' },
			{
				name: 'Lisa Park',
				email: `lisa.neg${SEED_DOMAIN}`,
				relationship: 'Manager',
				bias: 'negative'
			},
			{
				name: 'Carlos Mendez',
				email: `carlos.spo${SEED_DOMAIN}`,
				relationship: 'Skip-level',
				bias: 'sporadic'
			}
		]
	},
	// 2. Plateaued - Jordan Kim
	{
		name: 'Jordan Kim',
		email: `jordan.plateau${SEED_DOMAIN}`,
		pattern: 'plateaued',
		goalTitle: 'Improve Cross-Functional Collaboration',
		goalDescription:
			'Build stronger working relationships with product, design, and data teams to reduce friction and ship faster.',
		focusAreas: [
			{
				label: 'Run joint planning sessions',
				description: 'Facilitate monthly cross-team alignment meetings'
			},
			{
				label: 'Reduce handoff friction',
				description: 'Create shared documentation that eliminates re-work'
			},
			{
				label: 'Build trust through follow-through',
				description: 'Close all action items within committed timelines'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'Maya Johnson',
				email: `maya.pos${SEED_DOMAIN}`,
				relationship: 'Product Partner',
				bias: 'positive'
			},
			{
				name: 'Tom Chen',
				email: `tom.neu${SEED_DOMAIN}`,
				relationship: 'Design Lead',
				bias: 'neutral'
			},
			{
				name: 'Rachel Adams',
				email: `rachel.neg${SEED_DOMAIN}`,
				relationship: 'Data Lead',
				bias: 'negative'
			}
		]
	},
	// 3. Declining - Casey Morgan
	{
		name: 'Casey Morgan',
		email: `casey.declining${SEED_DOMAIN}`,
		pattern: 'declining',
		goalTitle: 'Build Technical Mentorship Practice',
		goalDescription:
			'Develop skills as a technical mentor to grow junior engineers on the team.',
		focusAreas: [
			{
				label: 'Conduct weekly 1:1 mentoring sessions',
				description: 'Dedicate 30 min/week to each mentee with structured agenda'
			},
			{
				label: 'Create learning paths',
				description: 'Design skill-building roadmaps tailored to each mentee'
			},
			{
				label: 'Provide actionable code reviews',
				description: 'Give feedback that teaches, not just corrects'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'David Lee',
				email: `david.pos${SEED_DOMAIN}`,
				relationship: 'Mentee',
				bias: 'positive'
			},
			{
				name: 'Sophie Brown',
				email: `sophie.neu${SEED_DOMAIN}`,
				relationship: 'Peer Mentor',
				bias: 'neutral'
			},
			{
				name: 'Kevin Zhang',
				email: `kevin.neg${SEED_DOMAIN}`,
				relationship: 'Engineering Manager',
				bias: 'negative'
			},
			{
				name: 'Aria Patel',
				email: `aria.spo${SEED_DOMAIN}`,
				relationship: 'Mentee',
				bias: 'sporadic'
			}
		]
	},
	// 4. High Performer - Taylor Brooks
	{
		name: 'Taylor Brooks',
		email: `taylor.highperf${SEED_DOMAIN}`,
		pattern: 'high_performer',
		goalTitle: 'Scale Leadership Impact Beyond Direct Team',
		goalDescription:
			'Extend influence and operational excellence to adjacent teams and organizational initiatives.',
		focusAreas: [
			{
				label: 'Champion org-wide process improvements',
				description: 'Identify and implement at least 2 cross-team efficiency gains'
			},
			{
				label: 'Mentor emerging leaders',
				description: 'Guide 2-3 high-potential ICs through leadership skill development'
			},
			{
				label: 'Drive strategic initiatives',
				description: 'Lead at least one company-level initiative from concept to execution'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'Nina Ross',
				email: `nina.pos${SEED_DOMAIN}`,
				relationship: 'VP of Engineering',
				bias: 'positive'
			},
			{
				name: 'Brett Collins',
				email: `brett.neu${SEED_DOMAIN}`,
				relationship: 'Peer Director',
				bias: 'neutral'
			},
			{
				name: 'Olivia Santos',
				email: `olivia.pos2${SEED_DOMAIN}`,
				relationship: 'Direct Report',
				bias: 'positive'
			}
		]
	},
	// 5. Inconsistent - Morgan Lee
	{
		name: 'Morgan Lee',
		email: `morgan.inconsistent${SEED_DOMAIN}`,
		pattern: 'inconsistent',
		goalTitle: 'Develop Consistent Communication Habits',
		goalDescription:
			'Build reliable, predictable communication patterns that teammates can depend on.',
		focusAreas: [
			{
				label: 'Send weekly status updates on time',
				description: 'Every Friday by 4pm, share progress with all reviewers'
			},
			{
				label: 'Respond to messages within 4 hours',
				description: 'Maintain response SLA during business hours'
			},
			{
				label: 'Proactively flag blockers',
				description: 'Share issues before they become crises'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'Hannah White',
				email: `hannah.neu${SEED_DOMAIN}`,
				relationship: 'Manager',
				bias: 'neutral'
			},
			{
				name: 'Derek Kim',
				email: `derek.neg${SEED_DOMAIN}`,
				relationship: 'Project Lead',
				bias: 'negative'
			},
			{
				name: "Fiona O'Brien",
				email: `fiona.pos${SEED_DOMAIN}`,
				relationship: 'Teammate',
				bias: 'positive'
			},
			{
				name: 'Greg Tanaka',
				email: `greg.spo${SEED_DOMAIN}`,
				relationship: 'Reviewer',
				bias: 'sporadic'
			}
		]
	},
	// 6. Effort Gap - Sam Patel
	{
		name: 'Sam Patel',
		email: `sam.effortgap${SEED_DOMAIN}`,
		pattern: 'effort_gap',
		goalTitle: 'Convert Effort Into Visible Results',
		goalDescription:
			'Bridge the gap between hard work and measurable outcomes. Focus on strategic prioritization over raw output.',
		focusAreas: [
			{
				label: 'Align weekly work to top-3 priorities',
				description: 'Start each week by confirming the highest-impact tasks'
			},
			{
				label: 'Make work visible',
				description: 'Document and share completed work in team channels'
			},
			{
				label: 'Seek feedback on delivery quality',
				description: 'Ask "Did this solve the problem?" after every deliverable'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'Alex Torres',
				email: `alext.pos${SEED_DOMAIN}`,
				relationship: 'Product Manager',
				bias: 'positive'
			},
			{
				name: 'Maria Costa',
				email: `maria.neu${SEED_DOMAIN}`,
				relationship: 'Tech Lead',
				bias: 'neutral'
			},
			{
				name: 'Ryan Hughes',
				email: `ryan.neg${SEED_DOMAIN}`,
				relationship: 'Director',
				bias: 'negative'
			}
		]
	},
	// 7. Late Bloomer - Riley Chen
	{
		name: 'Riley Chen',
		email: `riley.latebloomer${SEED_DOMAIN}`,
		pattern: 'late_bloomer',
		goalTitle: 'Develop Data-Driven Decision Making',
		goalDescription:
			'Move from intuition-based to evidence-based decision making in product development.',
		focusAreas: [
			{
				label: 'Base every proposal on data',
				description: 'Include quantitative evidence in all product recommendations'
			},
			{
				label: 'Build personal analytics dashboard',
				description: 'Create a tracking system for key metrics you own'
			},
			{
				label: 'Run A/B tests for major decisions',
				description: 'Design and execute at least 2 controlled experiments'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'COMPLETED',
		reviewers: [
			{
				name: 'Chris Walker',
				email: `chris.neu${SEED_DOMAIN}`,
				relationship: 'Data Analyst',
				bias: 'neutral'
			},
			{
				name: 'Jessica Lin',
				email: `jessica.pos${SEED_DOMAIN}`,
				relationship: 'Product Director',
				bias: 'positive'
			},
			{
				name: 'Brandon Miller',
				email: `brandon.neg${SEED_DOMAIN}`,
				relationship: 'Engineering Lead',
				bias: 'negative'
			}
		]
	},
	// 8. Early Stage - Jamie Torres
	{
		name: 'Jamie Torres',
		email: `jamie.earlystage${SEED_DOMAIN}`,
		pattern: 'early_stage',
		goalTitle: 'Build Reviewer Management Skills',
		goalDescription:
			'Learn to identify, engage, and manage expectations of key reviewers across the organization.',
		focusAreas: [
			{
				label: 'Map reviewer landscape',
				description: 'Create a reviewer map with influence and interest levels'
			},
			{
				label: 'Schedule regular touchpoints',
				description: 'Establish recurring 1:1s with top-3 reviewers'
			},
			{
				label: 'Practice expectation setting',
				description: 'Proactively communicate timelines and constraints'
			}
		],
		cycleWeeks: 12,
		cycleStatus: 'ACTIVE',
		reviewers: [
			{
				name: 'Pat Henderson',
				email: `pat.pos${SEED_DOMAIN}`,
				relationship: 'Mentor',
				bias: 'positive'
			},
			{
				name: 'Linda Nguyen',
				email: `linda.neu${SEED_DOMAIN}`,
				relationship: 'Manager',
				bias: 'neutral'
			},
			{
				name: 'Steve Kowalski',
				email: `steve.neg${SEED_DOMAIN}`,
				relationship: 'Senior Peer',
				bias: 'negative'
			}
		]
	}
];

/** Email pattern used for cleanup */
export const SEED_EMAIL_PATTERN = '+seed@test.forbetra.com';
