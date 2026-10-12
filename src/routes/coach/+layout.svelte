<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { LayoutData } from './$types';
	import { page } from '$app/stores';
	import { BarChart3, Home, Mail, Settings, Users } from 'lucide-svelte';
	import { coachAlertCount } from '$lib/stores/coachAlerts.svelte';

	const { children, data }: { children: Snippet; data: LayoutData } = $props();

	$effect(() => {
		coachAlertCount.value = data.totalAlerts;
	});

	const navItems = $derived([
		{
			href: data.onboardingComplete ? '/coach' : '/coach/onboarding',
			label: 'Dashboard',
			icon: Home
		},
		{ href: '/coach/roster', label: 'Clients', icon: Users },
		{ href: '/coach/invitations', label: 'Invitations', icon: Mail },
		{ href: '/coach/analytics', label: 'Analytics', icon: BarChart3 },
		{ href: '/coach/settings', label: 'Settings', icon: Settings }
	]);

	const isActive = (href: string) => {
		const pathname = $page.url.pathname;
		if (href === '/coach') return pathname === '/coach';
		return pathname === href || pathname.startsWith(href + '/');
	};
</script>

<div class="flex min-h-screen bg-surface-base">
	<!-- Desktop Sidebar -->
	<aside class="hidden w-48 shrink-0 border-r border-border-default bg-surface-raised lg:block">
		<div class="sticky top-0 flex flex-col gap-1 p-4">
			<div class="mb-4 px-3">
				<p class="text-xs font-bold tracking-widest text-text-tertiary uppercase">Forbetra</p>
			</div>
			<nav class="flex flex-col gap-0.5" aria-label="Navigation">
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				{#each navItems as item (item.href)}
					<a
						href={item.href}
						class="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors
							{isActive(item.href)
							? 'bg-accent-muted text-accent'
							: 'text-text-secondary hover:bg-surface-subtle hover:text-text-primary'}"
						aria-current={isActive(item.href) ? 'page' : undefined}
					>
						<item.icon class="h-4 w-4 shrink-0" />
						{item.label}
						{#if item.href === '/coach' && coachAlertCount.value > 0}
							<span
								class="text-2xs ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-error px-1 font-bold text-white"
							>
								{coachAlertCount.value}
							</span>
						{/if}
					</a>
				{/each}
				<!-- eslint-enable svelte/no-navigation-without-resolve -->
			</nav>
		</div>
	</aside>

	<!-- Main Content -->
	<div class="flex flex-1 flex-col overflow-x-hidden">
		<div class="flex-1 pb-20 lg:pb-0">
			{@render children()}
		</div>

		<nav
			class="fixed right-0 bottom-0 left-0 z-40 flex items-center justify-around border-t border-border-default bg-surface-raised px-1 pt-1.5 lg:hidden"
			style="padding-bottom: max(0.375rem, env(safe-area-inset-bottom));"
			aria-label="Navigation"
		>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			{#each navItems as item (item.href)}
				<a
					href={item.href}
					class="flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[10px] leading-tight font-medium transition-colors
						{isActive(item.href) ? 'text-accent' : 'text-text-muted'}"
					aria-current={isActive(item.href) ? 'page' : undefined}
				>
					<span class="relative">
						<item.icon class="h-5 w-5" />
						{#if item.href === '/coach' && coachAlertCount.value > 0}
							<span
								class="text-2xs absolute -top-1 -right-1.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-error px-0.5 leading-none font-bold text-white"
							>
								{coachAlertCount.value}
							</span>
						{/if}
					</span>
					<span class="text-center">{item.label}</span>
				</a>
			{/each}
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</nav>
	</div>
</div>
