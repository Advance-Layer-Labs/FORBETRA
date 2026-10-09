import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// Consult https://svelte.dev/docs/kit/integrations
	// for more information about preprocessors
	preprocess: vitePreprocess(),
	kit: {
		// Replaced in hooks.server.ts so the Twilio SMS webhook can post without an Origin header.
		csrf: { checkOrigin: false },
		adapter: adapter({ runtime: 'nodejs22.x' }),
		alias: {
			$jobs: 'src/jobs'
		}
	}
};

export default config;
