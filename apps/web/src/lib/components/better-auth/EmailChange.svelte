<script>
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { toast } from '$lib/components/ui/toast';
	import { Button } from '$lib/components/ui/button';
	import { Loader } from 'lucide-svelte';
	import { authClient } from '$lib/actions/authClient';

    let { data } = $props();

    onMount(() => {
        if(page.url.searchParams.get('emailChanged') && page.url.searchParams.get('emailChanged') === 'true'){
            toast.success('Email confirmed successfully');
        }
    });

    let isLoading = $state(false);
    let emailChanged = $state(false);
    let session = authClient.useSession();
    let user = $derived(data?.user || $session?.data?.user);

	async function handleEmailChange(event) {
		isLoading = true;
		event.preventDefault();
		const formData = new FormData(event.target);
		const email = formData.get('email');
		const  { data, error} = await authClient.changeEmail({ newEmail: email, callbackURL: '/settings/account?emailAccepted=true' });
		if (error) {
			console.log(error);
			toast.error(error.message);
		} else {
			toast.success("Email change started!");
            emailChanged = true;
		}
		isLoading = false;
	}


	async function handleResendEmail() {
		const { data, error } = await authClient.sendVerificationEmail({ 
			email: user?.email,
			callbackURL: '/settings/account?emailChanged=true'
		});
		if (error) {
			console.log(error);
			toast.error(error.statusText);
		} else {
			toast.success("Email sent successfully");
		}
	}
</script>


    <div class="card card-ring flex flex-col p-4 gap-6">
    <!-- Show loading icon if user is not yet loaded -->
    {#if !user}
        <Loader size={22} class="flex-shrink-0 animate-spin place-self-center my-4" />
    {:else}
		<form class="flex flex-col gap-4" onsubmit={handleEmailChange}>
            {#if emailChanged}
                <p>To complete the email change, please verify your new email by clicking the link in the email we sent you.</p>
            {/if}
                <div class="input-container">
                    <label for="name">Your email</label>
                    <div class="input-field">
					<input type="text" name="email" value={user?.email} />
				</div>
			</div>
			<div class="flex flex-row gap-2 place-self-end">
				{#if !user?.emailVerified}
					<Button type="button" {isLoading} onclick={handleResendEmail} variant="outline">Resend email</Button>
				{/if}
					<Button type="submit" {isLoading} variant="action">Change Email</Button>
			</div>
		</form>
    {/if}
	<div class="flex flex-col gap-2 text-sm bg-primary-2 p-4 rounded-lg">
		<p class="font-semibold">Process of changing email:</p>
		<ol class=" list-decimal pl-5 space-y-1">
			<li>Enter your new email address in the form above and click "Change Email"</li>
			<li>You will receive a verification link in your <strong>current email</strong> address.</li>
			<li>Click the verification link to accept the email change.</li>
			<li>Second email with confirmation link will be sent to your <strong>new email</strong>.</li>
			<li>Click that link to verify new email and complete the process.</li>
		</ol>
	</div>
</div>

