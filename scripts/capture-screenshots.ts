/**
 * Capture demo screenshots using Playwright.
 * Usage: npx tsx scripts/capture-screenshots.ts
 *
 * Requires: npm run dev (server on localhost:5173)
 * Output: screenshots/ directory
 */

import { chromium } from 'playwright';

const BASE = 'http://localhost:5173';
const INDIVIDUAL_ID = 'cmn4zskut00szoxrewao1bsbn'; // Jamie Torres (active journey)
const COACH_ID = 'cmn4zrjwb0001oxre7wtoupgz'; // Marcus Thompson

const VIEWPORT = { width: 1280, height: 800 };
const MOBILE = { width: 390, height: 844 };

type Shot = {
	name: string;
	path: string;
	impersonateAs?: string;
	viewport?: { width: number; height: number };
	waitFor?: string;
	delay?: number;
};

const shots: Shot[] = [
	// Individual views
	{ name: '01-individual-hub', path: '/individual', impersonateAs: INDIVIDUAL_ID },
	{
		name: '02-individual-hub-mobile',
		path: '/individual',
		impersonateAs: INDIVIDUAL_ID,
		viewport: MOBILE
	},
	{ name: '03-checkin', path: '/individual/checkin', impersonateAs: INDIVIDUAL_ID },
	{ name: '04-insights', path: '/individual/insights', impersonateAs: INDIVIDUAL_ID },
	{ name: '05-ask', path: '/individual/ask', impersonateAs: INDIVIDUAL_ID },
	{ name: '06-dashboard', path: '/individual/dashboard', impersonateAs: INDIVIDUAL_ID },
	{ name: '07-history', path: '/individual/history', impersonateAs: INDIVIDUAL_ID },
	{ name: '08-feedback', path: '/individual/feedback', impersonateAs: INDIVIDUAL_ID },

	// Coach views
	{ name: '10-coach-dashboard', path: '/coach', impersonateAs: COACH_ID },
	{ name: '11-coach-roster', path: '/coach/roster', impersonateAs: COACH_ID },
	{ name: '12-coach-analytics', path: '/coach/analytics', impersonateAs: COACH_ID },
	{ name: '13-coach-invitations', path: '/coach/invitations', impersonateAs: COACH_ID },

	// Reviewer
	{ name: '20-reviewer-feedback', path: '/stakeholder/feedback/preview?preview=true' },

	// Admin
	{ name: '30-admin-dashboard', path: '/admin' },
	{ name: '31-admin-organizations', path: '/admin/organizations' },
	{ name: '32-admin-demo', path: '/admin/demo' }
];

async function main() {
	const browser = await chromium.launch();
	const context = await browser.newContext({ viewport: VIEWPORT });
	const page = await context.newPage();

	// Authenticate as admin first — get Clerk session
	// We'll use the impersonation cookie approach since we can't do Clerk SSO in headless
	// Set the admin impersonation to ourselves first to establish a session
	console.log('Setting up auth...');

	let lastImpersonatedId = '';

	for (const shot of shots) {
		// Set viewport
		const vp = shot.viewport ?? VIEWPORT;
		await page.setViewportSize(vp);

		// Impersonate if needed
		if (shot.impersonateAs && shot.impersonateAs !== lastImpersonatedId) {
			const resp = await page.request.post(`${BASE}/api/admin/impersonate`, {
				data: { userId: shot.impersonateAs },
				headers: { 'Content-Type': 'application/json' }
			});
			if (resp.ok()) {
				lastImpersonatedId = shot.impersonateAs;
				console.log(`  Impersonating: ${shot.impersonateAs}`);
			} else {
				console.warn(`  Failed to impersonate ${shot.impersonateAs}: ${resp.status()}`);
			}
		} else if (!shot.impersonateAs && lastImpersonatedId) {
			await page.request.delete(`${BASE}/api/admin/impersonate`);
			lastImpersonatedId = '';
		}

		// Navigate
		console.log(`Capturing: ${shot.name} (${shot.path})`);
		await page.goto(`${BASE}${shot.path}`, { waitUntil: 'networkidle' });

		if (shot.waitFor) {
			await page.waitForSelector(shot.waitFor, { timeout: 5000 }).catch(() => {});
		}

		// Extra delay for charts/animations
		await page.waitForTimeout(shot.delay ?? 1500);

		// Screenshot
		const suffix = vp.width < 500 ? '-mobile' : '';
		await page.screenshot({
			path: `screenshots/${shot.name}${suffix}.png`,
			fullPage: false
		});
	}

	await browser.close();
	console.log(`\nDone! ${shots.length} screenshots saved to screenshots/`);
}

main().catch(console.error);
