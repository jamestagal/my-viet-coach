<script>
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { toast } from '@components/Toast.svelte';
	import Button from '@components/Button.svelte';
    import Loader from '@icons/loader.svelte';

	import { authClient } from '@actions/authClient';

    let { data } = $props();

    let isLoading = $state(false);

    let session = authClient.useSession();
    let user = $derived(data?.user || $session?.data?.user);

	async function handleUserUpdate(event) {
		isLoading = true;
		event.preventDefault();
		const formData = new FormData(event.target);
		const name = formData.get('name');
		const image = formData.get('image');
		console.log(name, image);
		const  { data, error} = await authClient.updateUser({ name, image });
		if (error) {
			console.log(error);
			toast.error(error.statusText);
		} else {
			toast.success("User updated successfully");
		}
		isLoading = false;
	}

</script>


    <div class="card card-ring flex flex-col p-4 ">
    <!-- Show loading icon if user is not yet loaded -->
    {#if !user}
        <Loader size={22} class="flex-shrink-0 animate-spin place-self-center my-4" />
    {:else}
		<form class="flex flex-col gap-4" onsubmit={handleUserUpdate}>
			<div class="input-container">
				<label for="name">Name</label>
				<div class="input-field">
					<input type="text" name="name" value={user?.name} />
				</div>
			</div>
			<div class="input-container">
				<label for="image">Image</label>
				<div class="input-field">
					<input type="text" name="image" value={user?.image} />
				</div>
			</div>
			<div class="flex justify-end">
				<Button type="submit" {isLoading} variant="action">Save</Button>
			</div>
		</form>
    {/if}
</div>

