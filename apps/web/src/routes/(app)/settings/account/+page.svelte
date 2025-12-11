<script>
	import UpdateUser from '$lib/components/better-auth/UpdateUser.svelte';
	import EmailChange from '$lib/components/better-auth/EmailChange.svelte';
	import { UserAvatar } from '$lib/components/dynamic';

	const { data } = $props();
</script>

<svelte:head>
    <title>Account</title>
</svelte:head>

<div class="flex flex-col gap-4">
	<h2 class="font-bold text-2xl">Account</h2>
	<UpdateUser user={data?.user} />

	<h2 class="font-bold text-2xl">Avatar</h2>
	<UserAvatar />
	
	<h2 class="font-bold text-2xl">Email</h2>
	<EmailChange />
</div>


