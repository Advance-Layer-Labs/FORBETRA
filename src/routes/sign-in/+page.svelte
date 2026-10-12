<script lang="ts">
	import { SignIn } from 'svelte-clerk';
	import { page } from '$app/stores';

	const redirectUrl = $derived($page.url.searchParams.get('redirect') || '/');
</script>

<svelte:head>
	<title>Sign In | Forbetra</title>
</svelte:head>

<div class="flex justify-center p-8">
	<SignIn
		fallbackRedirectUrl={redirectUrl}
		signUpUrl="/sign-up?redirect={encodeURIComponent(redirectUrl)}"
	/>
</div>
