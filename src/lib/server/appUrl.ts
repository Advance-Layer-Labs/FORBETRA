// Canonical public URL for the app — used in email/SMS links sent from cron
// jobs. Prefer PUBLIC_APP_URL env var; default to production domain. Never
// use VERCEL_URL here: it is the deployment-specific preview URL and would
// produce non-canonical links in production emails.
export const getAppUrl = (): string => {
	const env = process.env.PUBLIC_APP_URL;
	if (!env) return 'https://app.forbetra.com';
	return env.startsWith('http') ? env : `https://${env}`;
};
