<svelte:head>
	<title>SMS Consent & Opt-In | Forbetra</title>
	<meta
		name="description"
		content="How Forbetra collects SMS consent, what messages you'll receive, and how to opt out."
	/>
</svelte:head>

<section class="mx-auto max-w-3xl px-6 py-16 text-text-primary">
	<h1 class="mb-2 text-3xl font-bold">SMS Consent & Opt-In</h1>
	<p class="mb-10 text-sm text-text-tertiary">Last updated: March 13, 2026</p>

	<div class="space-y-10 text-sm leading-relaxed text-text-secondary">
		<!-- What is Forbetra -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">What is Forbetra?</h2>
			<p>
				Forbetra is a professional development platform that pairs structured weekly self-reflection
				with continuous 360-degree reviewer feedback and AI-generated coaching insights. Individuals
				track their effort and performance, while reviewers provide independent scores — revealing
				blind spots over time.
			</p>
		</div>

		<!-- How users opt in -->
		<div>
			<h2 class="mb-3 text-lg font-semibold text-text-primary">How SMS Opt-In Works</h2>
			<p class="mb-4">
				SMS notifications are entirely optional. Users opt in through their account settings by
				selecting <strong>"SMS"</strong> or <strong>"Both"</strong> as their delivery method and providing
				a mobile phone number. Here is what the opt-in experience looks like:
			</p>

			<!-- Visual mock-up of the settings UI -->
			<div
				class="rounded-xl border border-border-default bg-surface-raised p-5"
				aria-label="SMS opt-in settings preview"
			>
				<p class="mb-2 text-sm font-medium text-text-secondary">Delivery Method</p>
				<div class="flex gap-2">
					<span
						class="flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm font-medium text-text-secondary"
					>
						Email
					</span>
					<span
						class="flex items-center gap-2 rounded-lg border border-border-default bg-surface-subtle px-4 py-2.5 text-sm font-medium text-text-secondary"
					>
						SMS
					</span>
					<span
						class="flex items-center gap-2 rounded-lg border border-accent bg-accent/10 px-4 py-2.5 text-sm font-medium text-accent"
					>
						Both
					</span>
				</div>
				<p class="mt-3 text-xs leading-relaxed text-text-muted">
					By enabling SMS, you agree to receive automated text messages from Forbetra. ~1–4
					msgs/week. Msg & data rates may apply. Reply STOP to opt out.
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href="/sms-terms" class="text-accent underline">SMS Terms</a>
					·
					<a href="/privacy" class="text-accent underline">Privacy</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</p>
			</div>

			<p class="mt-4">
				Users must actively choose SMS delivery and enter their phone number before any text
				messages are sent. Consent is <strong>not</strong> a condition of using Forbetra.
			</p>
		</div>

		<!-- What messages -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">What Messages Will I Receive?</h2>
			<p class="mb-2">
				By opting in to SMS notifications from Forbetra, you may receive text messages related to:
			</p>
			<ul class="ml-4 list-disc space-y-1">
				<li>
					<strong>Check-in reminders</strong> — nudges to complete your weekly self-assessment
				</li>
				<li>
					<strong>Feedback requests</strong> — notifications when a reviewer provides new feedback
				</li>
				<li><strong>Coaching reminders</strong> — session prep and follow-up prompts</li>
				<li><strong>Reviewer invitations</strong> — requests to provide 360-degree feedback</li>
			</ul>
		</div>

		<!-- Message frequency -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">Message Frequency</h2>
			<p>
				Message frequency varies based on your coaching activity. Typical usage is
				<strong>1–4 messages per week</strong> for individuals and
				<strong>1–2 messages per month</strong> for reviewers.
			</p>
		</div>

		<!-- Costs -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">Message and Data Rates</h2>
			<p>
				<strong>Message and data rates may apply.</strong> Consult your wireless carrier for details about
				your messaging plan.
			</p>
		</div>

		<!-- Opt out -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">How to Opt Out</h2>
			<p>
				You can opt out of SMS messages at any time by replying <strong>STOP</strong> to any message from
				Forbetra. You will receive a single confirmation message and no further SMS messages will be sent
				unless you re-subscribe.
			</p>
			<p class="mt-2">
				You can also disable SMS notifications in your account settings by switching your delivery
				method to Email only.
			</p>
		</div>

		<!-- Help -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">How to Get Help</h2>
			<p>
				For help with SMS messaging, reply <strong>HELP</strong> to any message from Forbetra, or
				contact us at
				<a href="mailto:sagal@thewinningmind.com" class="font-semibold text-accent underline"
					>sagal@thewinningmind.com</a
				>.
			</p>
		</div>

		<!-- Consent statement -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">Consent</h2>
			<p>
				Consent to receive SMS messages is <strong>not</strong> a condition of using Forbetra or purchasing
				any goods or services. You may use the platform without providing a phone number by selecting
				Email as your delivery method.
			</p>
			<p class="mt-2">
				Your phone number will not be shared with third parties for marketing purposes.
			</p>
		</div>

		<!-- Related policies -->
		<div>
			<h2 class="mb-2 text-lg font-semibold text-text-primary">Related Policies</h2>
			<ul class="ml-4 list-disc space-y-1">
				<li>
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a href="/sms-terms" class="font-semibold text-accent underline">SMS Messaging Terms</a>
				</li>
				<li>
					<a href="/terms" class="font-semibold text-accent underline">Terms of Service</a>
				</li>
				<li>
					<a href="/privacy" class="font-semibold text-accent underline">Privacy Policy</a>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</li>
			</ul>
		</div>
	</div>

	<!-- Footer with contact -->
	<div class="mt-12 border-t border-border-default pt-6 text-xs text-text-tertiary">
		<p>
			Forbetra is operated by Winning Mind, LLC · 2358 University Ave., #265, San Diego, CA 92104 ·
			<a href="mailto:sagal@thewinningmind.com" class="text-accent underline"
				>sagal@thewinningmind.com</a
			>
		</p>
	</div>
</section>
