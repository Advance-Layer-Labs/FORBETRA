<script lang="ts">
	import type { PageData } from './$types';
	import { startTour, type Tour } from '$lib/stores/demoTour.svelte';
	import { goto } from '$app/navigation';
	import { Play } from 'lucide-svelte';

	const { data }: { data: PageData } = $props();

	const bestIndividualId = data.defaults.individualId;
	const bestCoachId = data.defaults.coachId;

	const tours: Array<{
		tour: Tour;
		subtitle: string;
		audience: string;
		color: string;
		bg: string;
	}> = [
		{
			tour: {
				id: 'coach',
				title: 'Demo: For Coaches',
				steps: [
					{
						path: '/coach',
						userId: bestCoachId,
						say: "This is your command center. At a glance you see which clients need attention, who's overdue, and where the coaching opportunities are.",
						pointOut: ['Alert badges on clients', 'Quick action buttons', 'Completion rates']
					},
					{
						path: '/coach/roster',
						userId: bestCoachId,
						say: 'Your full client roster. Click any client to open their session prep — AI-generated insights, trends, and conversation starters.',
						pointOut: [
							'Client status indicators',
							'Click a client for session prep',
							'Generate Prep button streams live AI'
						]
					},
					{
						path: '/coach/analytics',
						userId: bestCoachId,
						say: "Across your entire portfolio — who's consistent, who's improving, who needs intervention. Sortable, exportable.",
						pointOut: [
							'Consistency scores',
							'Trajectory arrows',
							'CSV export',
							'Portfolio trend chart'
						]
					},
					{
						path: '/coach/invitations',
						userId: bestCoachId,
						say: "When you onboard a new client, you pre-fill their goal, focus areas, and suggested reviewers. They sign up and everything's ready.",
						pointOut: ['Expand "Pre-fill their setup"', 'Goal + focus areas + reviewers'],
						tip: 'Fill in a sample goal to show how it works'
					}
				]
			},
			subtitle: 'Dashboard, session prep, analytics, client onboarding',
			audience: 'Executive coaches, leadership development',
			color: 'text-accent',
			bg: 'bg-accent-muted border-accent/40 hover:border-accent'
		},
		{
			tour: {
				id: 'individual',
				title: 'Demo: For Leaders',
				steps: [
					{
						path: '/individual',
						userId: bestIndividualId,
						say: 'This is what you see every day. One question: what should you focus on this week? No clutter — just the next action.',
						pointOut: [
							'Single-focus header',
							'Primary action card',
							'AI insight teaser',
							'Streak badge'
						]
					},
					{
						path: '/individual/checkin',
						userId: bestIndividualId,
						say: 'Takes 60 seconds. Rate your effort and performance on a 0-10 scale. Done.',
						pointOut: ['Effort scale', 'Performance scale', 'Optional notes'],
						tip: 'Rate effort 7, performance 5 to show a gap'
					},
					{
						path: '/individual/insights',
						userId: bestIndividualId,
						say: 'Click Generate Report. Watch the AI analyze weeks of real data in real time — not generic advice, actual patterns from your check-ins and reviewer feedback.',
						pointOut: [
							'Click "Generate Report"',
							'Sections stream in live',
							'Grounded in real data'
						],
						tip: 'Let the streaming happen — it sells itself'
					},
					{
						path: '/individual/ask',
						userId: bestIndividualId,
						say: 'A conversation with your own data. Ask "Where have I improved?" and get answers grounded in your actual check-ins and feedback.',
						pointOut: ['Type a question', 'Streaming response', 'Suggested questions'],
						tip: 'Try: "Where have I improved the most?"'
					},
					{
						path: '/individual?tab=scorecard',
						userId: bestIndividualId,
						say: 'The Scorecard shows how your self-ratings compare to your reviewers. That gap is where the real growth happens.',
						pointOut: [
							'Self vs reviewer comparison',
							'Perception gaps',
							'Switch tabs to see Progress trends'
						]
					}
				]
			},
			subtitle: 'Hub, check-in, AI insights, ask your data, scorecard',
			audience: 'Executives, managers, emerging leaders',
			color: 'text-success',
			bg: 'bg-success-muted border-success/40 hover:border-success'
		},
		{
			tour: {
				id: 'athlete',
				title: 'Demo: For Athletes',
				steps: [
					{
						path: '/individual',
						userId: bestIndividualId,
						say: 'The key insight for athletes: are you working hard AND getting results? The effort-performance gap tells the whole story.',
						pointOut: ['Effort vs performance', 'Streak — consistency matters', 'AI insight teaser']
					},
					{
						path: '/individual/checkin',
						userId: bestIndividualId,
						say: 'After every session or competition — rate effort and performance. Over time, patterns emerge that neither athlete nor coach can see in the moment.',
						pointOut: [
							'Effort: how hard did I work?',
							'Performance: how well did I execute?',
							'Notes for context'
						],
						tip: 'Frame it as a training journal that turns into data'
					},
					{
						path: '/individual?tab=progress',
						userId: bestIndividualId,
						say: 'Weeks of data reveal patterns. Overtraining = high effort, declining performance. Peaking = the opposite. Coaches use this to adjust training load.',
						pointOut: ['Trend chart — look for divergence', 'Score averages', 'Heat map']
					},
					{
						path: '/coach/roster',
						userId: bestCoachId,
						say: "Now the coach side. Before every session, AI-generated prep: trends, risks, conversation starters — all from the athlete's actual data.",
						pointOut: ['Click into a client', 'Generate Prep button', 'Reviewer feedback trends'],
						tip: 'Click a client and hit Generate Prep to show streaming AI'
					},
					{
						path: '/individual/insights',
						userId: bestIndividualId,
						say: 'The AI writes a performance report. It spots patterns humans miss — like when effort is high but results are flat, signaling a need to recover.',
						pointOut: [
							'Click "Generate Report"',
							'Effort-performance gap analysis',
							'Behavioral experiment at the end'
						],
						tip: 'Let it stream'
					}
				]
			},
			subtitle: 'Training check-ins, trends, coach prep, AI reports',
			audience: 'Athletes, sport psychologists, performance coaches',
			color: 'text-warning',
			bg: 'bg-warning-muted border-warning/40 hover:border-warning'
		},
		{
			tour: {
				id: 'hr',
				title: 'Demo: For HR / Corporate',
				steps: [
					{
						path: '/admin',
						say: 'The admin view — all users, active coaching journeys, and system health at a glance.',
						pointOut: ['Total users and roles', 'Active journeys', 'System status']
					},
					{
						path: '/admin/organizations',
						say: 'Organizations manage coaches and participants under one umbrella. Domain-based auto-assignment — @company.com emails are automatically linked.',
						pointOut: ['Create Organization', 'Add Member by email', 'Role assignment']
					},
					{
						path: '/coach/analytics',
						userId: bestCoachId,
						say: 'Program-level view: are participants engaging? Improving? Which coaches get the best outcomes? All sortable, exportable.',
						pointOut: ['Consistency scores', 'Trajectory indicators', 'CSV export']
					},
					{
						path: '/individual',
						userId: bestIndividualId,
						say: 'What participants see. Simple, focused, designed for busy leaders with 60 seconds between meetings.',
						pointOut: ['Single-focus design', 'Intuitive — no training needed', 'Mobile-friendly']
					},
					{
						path: '/stakeholder/feedback/preview?preview=true',
						say: 'The 360 feedback experience. A reviewer gets a link, rates effort and performance, shares an observation. 60 seconds, no login.',
						pointOut: [
							'No account needed',
							'Two simple scores',
							'Behavioral observation field',
							'Score reveal after submit'
						],
						tip: 'Show on a phone to emphasize simplicity'
					},
					{
						path: '/individual/insights',
						userId: bestIndividualId,
						say: 'AI synthesizes check-in data and reviewer feedback into actionable insights. Coaches get session prep. Individuals get reports. All automated.',
						pointOut: ['Click "Generate Report"', 'Streaming AI', 'Grounded in actual data']
					}
				]
			},
			subtitle: 'Platform overview, org management, analytics, feedback, AI',
			audience: 'HR leaders, L&D teams, corporate sponsors',
			color: 'text-violet-500',
			bg: 'bg-violet-50 border-violet-500/40 hover:border-violet-500'
		}
	];

	async function launch(tour: Tour) {
		// Impersonate the first step's user if needed
		const firstStep = tour.steps[0];
		if (firstStep.userId) {
			await fetch('/api/admin/impersonate', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId: firstStep.userId })
			});
		}
		startTour(tour);
		// eslint-disable-next-line svelte/no-navigation-without-resolve -- dynamic tour path
		await goto(firstStep.path, { invalidateAll: true });
	}
</script>

<svelte:head>
	<title>Demo | Forbetra Admin</title>
</svelte:head>

<section class="mx-auto flex max-w-2xl flex-col items-center gap-8 p-6 pt-16">
	<header class="text-center">
		<h1 class="text-3xl font-bold text-text-primary">Demo Forbetra</h1>
		<p class="mt-2 text-text-secondary">Pick your audience. We'll walk you through it.</p>
	</header>

	<div class="grid w-full gap-4 sm:grid-cols-2">
		{#each tours as t (t.tour.id)}
			<button
				onclick={() => launch(t.tour)}
				class="group flex flex-col items-start gap-3 rounded-2xl border-2 p-6 text-left transition-all {t.bg}"
			>
				<div class="flex items-center gap-2">
					<Play class="h-5 w-5 {t.color}" />
					<h2 class="text-lg font-bold {t.color}">{t.tour.title.replace('Demo: ', '')}</h2>
				</div>
				<p class="text-sm text-text-secondary">{t.subtitle}</p>
				<p class="text-xs text-text-muted">{t.audience}</p>
				<span class="mt-auto rounded-full bg-white/60 px-3 py-1 text-xs font-semibold {t.color}">
					{t.tour.steps.length} steps &rarr;
				</span>
			</button>
		{/each}
	</div>
</section>
