<script lang="ts">
	import { authClient } from '$lib/actions/authClient';
	import { goto } from '$app/navigation';
	import { LogOut } from 'lucide-svelte';
	import { Button } from '$lib/components/ui/button';

	let isLoading = $state(false);

	const handleLogout = async () => {
		isLoading = true;
		await authClient.signOut();
		goto('/');
	};
</script>

<Button variant="outline" onclick={handleLogout} disabled={isLoading} class="ml-auto">
	<div class="flex items-center text-red-500">
		<LogOut class="mr-2 h-4 w-4" />
		<span>{isLoading ? 'Logging out...' : 'Log out'}</span>
	</div>
</Button>
