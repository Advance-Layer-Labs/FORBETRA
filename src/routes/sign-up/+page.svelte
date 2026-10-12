<script lang="ts">
	import { SignUp } from 'svelte-clerk';
	import { page } from '$app/stores';

	const redirectUrl = $derived($page.url.searchParams.get('redirect') || '/');
</script>

<svelte:head>
	<title>Sign Up | Forbetra</title>
</svelte:head>

<div class="flex justify-center p-8">
	<SignUp
		fallbackRedirectUrl={redirectUrl}
		signInUrl="/sign-in?redirect={encodeURIComponent(redirectUrl)}"
	/>
</div>
