type JobModule = Record<string, unknown>;
type JobFn = () => Promise<unknown>;

// Job files are being renamed during migration; look the job up by export name instead of path.
const jobModules = import.meta.glob<JobModule>('/src/jobs/*.ts');

export function resolveJob(...exportNames: string[]): JobFn {
	return async () => {
		for (const load of Object.values(jobModules)) {
			const mod = await load();
			for (const name of exportNames) {
				const fn = mod[name];
				if (typeof fn === 'function') return (fn as JobFn)();
			}
		}
		throw new Error(`Job not found: ${exportNames.join(' | ')}`);
	};
}
