export interface FocusAreaTemplate {
	label: string;
	description: string;
}

export interface ReviewerGuidance {
	whyItMatters: string;
	recommendedApproach: string;
	recommendedRoles: string[];
	exampleReviewers: string[];
}

export interface GoalTemplate {
	id: string;
	title: string;
	description: string;
	contextSummary: string;
	focusAreas: FocusAreaTemplate[];
	reviewerGuidance: ReviewerGuidance;
}

export interface OnboardingContext {
	id: string;
	title: string;
	description: string;
	goals: GoalTemplate[];
}

export const onboardingContexts: OnboardingContext[] = [
	{
		id: 'business-executive',
		title: 'Business / Executive Context',
		description:
			'Great for senior leaders and operators who want to build visible leadership capabilities while staying aligned with organizational goals.',
		goals: [
			{
				id: 'business-executive-presence',
				title: 'Improve executive presence',
				description:
					'Build credibility and calm confidence in high-visibility meetings, presentations, and decision moments.',
				contextSummary:
					'Tighten how you show up—visibly and vocally—so peers and reports experience clarity, steadiness, and conviction.',
				focusAreas: [
					{
						label: 'Show composed body language',
						description:
							'Maintain consistent eye contact and confident posture during key meetings and presentations.'
					},
					{
						label: 'Deliver refined messaging',
						description:
							'Reduce filler words and hesitations by rehearsing and refining key messages before speaking engagements.'
					},
					{
						label: 'Collect perception feedback',
						description:
							'Receive positive feedback from peers or reports on clarity, confidence, and composure in high-stakes discussions.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Reviewers who regularly see you communicate can quickly flag what lands well and what distracts from your message.',
					recommendedApproach:
						'Invite 3–5 reviewers who join executive updates or critical meetings so they can observe your delivery and share concrete stories.',
					recommendedRoles: [
						'Direct manager or skip-level leader',
						'Trusted peer in leadership meetings',
						'Direct report who monitors team morale',
						'HR partner, coach, or communications lead'
					],
					exampleReviewers: [
						'COO or Chief of Staff',
						'Peer VP or director',
						'Lead direct report for a major program',
						'HR business partner or executive coach'
					]
				}
			},
			{
				id: 'business-strategic-thinking',
				title: 'Enhance strategic thinking',
				description:
					'Connect day-to-day execution to longer-range bets, making strategic trade-offs explicit for your teams.',
				contextSummary:
					'Keep your planning cadence anchored in long-term priorities so decisions feel grounded instead of reactive.',
				focusAreas: [
					{
						label: 'Run structured strategic reviews',
						description:
							'Conduct at least one structured strategic review session per quarter to assess long-term priorities and emerging trends.'
					},
					{
						label: 'Document implications before acting',
						description:
							'Document three or more strategic implications before making major decisions or launching initiatives.'
					},
					{
						label: 'Link plans to strategy',
						description:
							'Present a clear link between daily priorities and organizational strategy in team planning meetings.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Reviewers surface blind spots in your thinking and ensure strategic messages travel across functions.',
					recommendedApproach:
						'Select 3–5 reviewers who influence planning journeys so they can assess whether your strategy shows up in real workflows.',
					recommendedRoles: [
						'Executive sponsor',
						'Cross-functional partner (e.g., Finance, Product, Operations)',
						'Strategy or biz-ops leader',
						'Direct report who drives planning cadence'
					],
					exampleReviewers: [
						'CFO or senior finance partner',
						'Head of Product or Operations counterpart',
						'Strategy director or chief of staff',
						'Program manager running quarterly planning'
					]
				}
			},
			{
				id: 'business-delegation',
				title: 'Improve delegation and empowerment',
				description:
					'Strengthen clarity, accountability, and growth for your team by delegating meaningful work with the right support.',
				contextSummary:
					'Shift from “doing” to “developing” others while keeping outcomes crisp and trackable.',
				focusAreas: [
					{
						label: 'Delegate high-impact work',
						description:
							'Delegate at least two high-impact tasks per month with defined outcomes and success criteria.'
					},
					{
						label: 'Track clarity and autonomy',
						description:
							'Track whether team members complete delegated tasks with minimal clarification requests, showing clarity and ownership.'
					},
					{
						label: 'Debrief and develop',
						description:
							'Conduct monthly debriefs with direct reports to review outcomes, give recognition, and identify development opportunities.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Reviewers who rely on your team can validate whether delegation strengthens delivery and talent growth.',
					recommendedApproach:
						'Choose 3–5 reviewers who experience the downstream impact of delegation so they can reflect on empowerment gains.',
					recommendedRoles: [
						'Direct manager',
						'Key direct report receiving delegated work',
						'Peer or partner team lead',
						'People/HR partner focused on talent development'
					],
					exampleReviewers: [
						'VP or senior leader supervising your function',
						'Senior IC or team lead you delegate to',
						'Cross-functional project owner',
						'HR business partner or leadership coach'
					]
				}
			}
		]
	},
	{
		id: 'military-operational',
		title: 'Military / Operational Context',
		description:
			'Designed for leaders honing operational readiness, unit cohesion, and decision speed in complex environments.',
		goals: [
			{
				id: 'military-situational-awareness',
				title: 'Enhance situational awareness',
				description:
					'Sharpen your ability to scan, interpret, and broadcast mission-critical changes under pressure.',
				contextSummary:
					'Improve sensing and communication so your element reacts to the right signals at the right time.',
				focusAreas: [
					{
						label: 'Identify mission-relevant changes',
						description:
							'Accurately identify at least three key environmental or mission-relevant changes during each field exercise or simulation.'
					},
					{
						label: 'Communicate updates quickly',
						description:
							'Communicate situational updates within 60 seconds of identifying critical information during operations.'
					},
					{
						label: 'Reduce missed responses',
						description:
							'Reduce the number of missed or delayed responses to changing mission factors over consecutive training evaluations.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Operational reviewers confirm whether your awareness translates into actionable briefings and team responsiveness.',
					recommendedApproach:
						'Loop in 3–5 reviewers who monitor or depend on your situational calls so they can log concrete feedback after exercises.',
					recommendedRoles: [
						'Commanding officer or XO',
						'Platoon sergeant or senior enlisted advisor',
						'Ops/intelligence partner observing the mission',
						'Peer leader from a sister unit'
					],
					exampleReviewers: [
						'Company commander',
						'Platoon sergeant',
						'Intelligence NCO or S2 liaison',
						'Adjacent unit squad leader'
					]
				}
			},
			{
				id: 'military-unit-cohesion',
				title: 'Build unit cohesion and trust',
				description:
					'Forge dependable relationships and transparent communication across your unit.',
				contextSummary:
					'Center your leadership on shared values, recognition, and structured reflection so the team stays aligned.',
				focusAreas: [
					{
						label: 'Run weekly check-ins',
						description:
							'Conduct weekly team check-ins or after-action huddles to surface lessons learned and maintain open communication.'
					},
					{
						label: 'Increase trust scores',
						description:
							'Increase peer-rated trust and reliability scores in team climate or feedback surveys.'
					},
					{
						label: 'Recognize contributions consistently',
						description:
							'Recognize at least one team member weekly for contributions that reinforce shared values or mission success.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Trust is best evaluated by the people you lead and those who rely on your unit under stress.',
					recommendedApproach:
						'Invite 3–5 reviewers who observe morale and collaboration daily so they can document tangible shifts in cohesion.',
					recommendedRoles: [
						'Command team (commander/XO)',
						'Peer squad or platoon leaders',
						'Unit training or readiness NCO',
						'Mission partner from another section'
					],
					exampleReviewers: [
						'Company first sergeant',
						'Peer platoon leader',
						'Unit readiness NCO',
						'Attached support element leader'
					]
				}
			},
			{
				id: 'military-initiative',
				title: 'Strengthen initiative and independent judgment',
				description:
					'Make timely calls within commander’s intent while learning from each decision journey.',
				contextSummary:
					'Build confidence choosing a course of action when guidance is limited, then codify the lessons.',
				focusAreas: [
					{
						label: 'Act within commander’s intent',
						description:
							'Make timely decisions within commander’s intent in at least three unplanned or ambiguous field scenarios.'
					},
					{
						label: 'Log and review independent decisions',
						description:
							'Log and review each independent decision post-mission to evaluate reasoning and outcomes.'
					},
					{
						label: 'Earn feedback on judgment',
						description:
							'Receive positive evaluation feedback from superiors on initiative, confidence, and judgment accuracy.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Leaders above and alongside you can validate whether your calls align with intent and timing requirements.',
					recommendedApproach:
						'Select 3–5 reviewers who oversee or depend on your decisions so they can review mission logs and offer precise coaching.',
					recommendedRoles: [
						'Commander or battalion staff supervisor',
						'Senior enlisted advisor',
						'Peer leader sharing mission space',
						'Observer/controller or evaluator'
					],
					exampleReviewers: [
						'Battalion S3 or operations officer',
						'Company first sergeant or senior NCO',
						'Peer platoon commander',
						'Observer-controller from training command'
					]
				}
			}
		]
	},
	{
		id: 'sports',
		title: 'Sports',
		description: 'These examples are written for soccer.',
		goals: [
			{
				id: 'sports-composure',
				title: 'Play with more composure on the ball',
				description:
					'Keep a clean first touch and choose the next action when pressure arrives, instead of rushing the pass.',
				contextSummary:
					'Stay calm when a defender arrives so the first touch sets up a pass, not a panic.',
				focusAreas: [
					{
						label: 'Take a clean first touch',
						description: 'Receive on the half-turn so the ball is ready for the next action.'
					},
					{
						label: 'Choose before you rush',
						description:
							'Pick the pass or the dribble once you feel pressure, instead of playing the first ball you see.'
					},
					{
						label: 'Keep the ball when pressed',
						description:
							'Use a touch or a body shape that protects the ball until the next option is clear.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'People who watch you in matches and training can see whether you stay composed or rush the ball away.',
					recommendedApproach: 'Invite a few people who see you on the ball in games and sessions.',
					recommendedRoles: ['Coach', 'Teammate who plays beside you', 'Captain or staff member'],
					exampleReviewers: ['Head coach', 'Teammate in your line', 'Captain', 'Assistant coach']
				}
			},
			{
				id: 'sports-scan',
				title: 'See the game a moment sooner',
				description:
					'Scan before the ball arrives and play the pass that is already on, rather than the one that appears after you receive.',
				contextSummary:
					'Know the picture before the ball comes so the first decision is already made.',
				focusAreas: [
					{
						label: 'Scan before you receive',
						description: 'Check shoulders and the space ahead before the pass reaches you.'
					},
					{
						label: 'Play the pass that is on',
						description:
							'Choose the option you saw before receiving, instead of waiting to look again.'
					},
					{
						label: 'Notice the next runner',
						description: 'See the teammate making the run, not only the nearest open player.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'A coach or teammate can tell whether you are looking early or discovering the picture after the ball arrives.',
					recommendedApproach:
						'Invite a few people who watch your scanning in matches and training.',
					recommendedRoles: ['Coach', 'Teammate who plays beside you', 'Captain or staff member'],
					exampleReviewers: ['Head coach', 'Teammate in your line', 'Captain', 'Assistant coach']
				}
			},
			{
				id: 'sports-organize',
				title: 'Organize the team around you',
				description:
					'Use your voice to set the shape, the press, and the next run so teammates know what you see.',
				contextSummary:
					'Make the picture shared. Teammates should hear the shape, the press, and the next run from you.',
				focusAreas: [
					{
						label: 'Set the shape',
						description:
							'Call the line and the distances so the group holds a shape without guessing.'
					},
					{
						label: 'Start the press',
						description: 'Name when to step and who is pressing so the group moves together.'
					},
					{
						label: 'Point the next run',
						description: 'Tell a teammate the run you see before the ball is played.'
					}
				],
				reviewerGuidance: {
					whyItMatters:
						'Teammates and staff hear whether your voice makes the next action clear or leaves them guessing.',
					recommendedApproach: 'Invite a few people who hear you in matches and training.',
					recommendedRoles: ['Coach', 'Teammate who plays beside you', 'Captain or staff member'],
					exampleReviewers: ['Head coach', 'Teammate in your line', 'Captain', 'Assistant coach']
				}
			}
		]
	}
];
