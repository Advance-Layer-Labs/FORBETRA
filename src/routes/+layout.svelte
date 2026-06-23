<script lang="ts">
	import '../app.css';
	import '@fontsource/plus-jakarta-sans/latin.css';
	import '@fontsource/geist-sans/latin.css';
	import '@fontsource/geist-mono/latin.css';
	import favicon from '$lib/assets/favicon.svg';
	import type { Snippet } from 'svelte';
	import { ClerkProvider, SignedIn, UserButton } from 'svelte-clerk';
	import { navigating, page } from '$app/stores';
	import { afterNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import type { LayoutData } from './$types';
	import ToastContainer from '$lib/components/ToastContainer.svelte';
	import DemoTourOverlay from '$lib/components/DemoTourOverlay.svelte';

	const { children, data }: { children: Snippet; data: LayoutData } = $props();

	const isImpersonating = $derived(data.realUser != null);
	const isRoleSelection = $derived(
		($page.data as Record<string, unknown>).showRoleSelection === true
	);

	const isActive = (href: string) => {
		const pathname = $page.url.pathname;
		return pathname === href || pathname.startsWith(href + '/');
	};

	const navClass = (active: boolean) =>
		`rounded text-sm transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface-base ${active ? 'font-semibold text-text-primary' : 'text-text-secondary hover:text-text-primary'}`;

	const stopImpersonating = async () => {
		await fetch('/api/admin/impersonate', { method: 'DELETE' });
		await goto(resolve('/admin/users'), { invalidateAll: true });
	};

	afterNavigate(() => {
		// Focus the main landmark for screen readers without highlighting a block-level h1.
		const main = document.getElementById('main-content');
		if (main) {
			main.setAttribute('tabindex', '-1');
			main.focus({ preventScroll: true });
		}
	});
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<ClerkProvider>
	{#if $navigating}
		<div class="fixed top-0 left-0 z-[60] h-0.5 w-full">
			<div class="nav-progress h-full bg-accent"></div>
		</div>
	{/if}
	<SignedIn>
		{#if isImpersonating}
			<div
				class="sticky top-0 z-50 flex items-center justify-center gap-3 bg-warning px-4 py-2 text-sm font-medium text-surface-base shadow-md"
			>
				<span>Viewing as {data.dbUser?.name ?? data.dbUser?.email} ({data.dbUser?.role})</span>
				<button
					onclick={stopImpersonating}
					class="rounded bg-surface-base px-3 py-0.5 text-xs font-bold text-warning hover:bg-surface-raised"
				>
					Stop
				</button>
			</div>
		{/if}
		<a
			href="#main-content"
			class="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:rounded-md focus:bg-surface-raised focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-text-primary focus:shadow-lg"
			>Skip to main content</a
		>
		<header
			class="flex items-center justify-between border-b border-border-default bg-surface-base px-4 py-3"
			aria-label="Site header"
		>
			<h1 class="text-sm font-bold tracking-[0.18em] text-text-tertiary uppercase">Forbetra</h1>
			<nav class="flex items-center gap-2" aria-label="Main navigation">
				{#if data.dbUser}
					{#if data.dbUser.role === 'ADMIN'}
						<a
							href={resolve('/admin/users')}
							class="{navClass(isActive('/admin'))} px-2 py-1 text-xs"
							aria-current={isActive('/admin') ? 'page' : undefined}
						>
							Admin
						</a>
					{/if}
					{#if !isRoleSelection}
						<a
							href={resolve('/settings')}
							class="{navClass(isActive('/settings'))} px-2 py-1 text-xs"
							aria-current={isActive('/settings') ? 'page' : undefined}
						>
							Settings
						</a>
					{/if}
				{/if}
				<UserButton />
			</nav>
		</header>
	</SignedIn>

	<main
		id="main-content"
		tabindex="-1"
		class={`min-h-screen bg-surface-base ${data.dbUser && !$page.url.pathname.startsWith('/individual') && !$page.url.pathname.startsWith('/coach') ? 'p-4' : ''}`}
	>
		{#key $page.url.pathname}
			<div class="animate-fade-in">
				{@render children()}
			</div>
		{/key}
	</main>
	{#if data.dbUser && !$page.url.pathname.startsWith('/stakeholder')}
		<footer
			class="border-t border-border-default bg-surface-base px-4 py-3 text-center text-xs text-text-muted"
		>
			<a href={resolve('/privacy')} class="hover:text-text-secondary hover:underline">Privacy</a>
			<span class="mx-2">·</span>
			<a href={resolve('/terms')} class="hover:text-text-secondary hover:underline">Terms</a>
			<span class="mx-2">·</span>
			<span>TLS encrypted · Enterprise-grade security.</span>
		</footer>
	{:else if $page.url.pathname.startsWith('/stakeholder')}
		<footer
			class="border-t border-border-default bg-surface-base px-4 py-3 text-center text-xs text-text-muted"
		>
			<a href={resolve('/privacy')} class="hover:text-text-secondary hover:underline">Privacy</a>
			<span class="mx-2">·</span>
			<a href={resolve('/terms')} class="hover:text-text-secondary hover:underline">Terms</a>
			<span class="mx-2">·</span>
			<span>Enterprise-grade security.</span>
		</footer>
	{/if}
	<ToastContainer />
	<DemoTourOverlay />
</ClerkProvider>

<style>
	.animate-fade-in {
		animation: fadeIn 0.15s ease-out;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	.nav-progress {
		animation: navProgress 2s ease-in-out infinite;
	}

	@keyframes navProgress {
		0% {
			width: 0%;
		}
		50% {
			width: 70%;
		}
		100% {
			width: 95%;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.animate-fade-in) {
			animation: none !important;
		}
		.nav-progress {
			animation: none !important;
			width: 100% !important;
		}
	}
</style>
