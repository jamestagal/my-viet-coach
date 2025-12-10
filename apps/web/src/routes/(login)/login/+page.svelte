<script lang="ts">
	import { authClient } from '$lib/actions/authClient';
	import { goto } from '$app/navigation';
	import { Button, buttonVariants } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import Google from '$lib/components/icons/Google.svelte';
	import { PinCode } from '$lib/components/ui/pin-code';
	import { Mail, Loader2 } from 'lucide-svelte';
	import { twMerge } from 'tailwind-merge';
	import { dev } from '$app/environment';

	let isLoading = $state(false);
	let isOTPSent = $state(false);
	let email = $state('');
	let allowResendOTP = $state(false);
	let errorMessage = $state('');
	let pinCodeComponent: { reset: () => void } | null = $state(null);

	const signInWithGoogle = () => {
		authClient.signIn.social({ provider: 'google', callbackURL: '/dashboard' });
	};

	const sendOTP = async () => {
		if (!email) return;

		isLoading = true;
		errorMessage = '';
		allowResendOTP = false;
		pinCodeComponent?.reset();

		const { error } = await authClient.emailOtp.sendVerificationOtp({
			email,
			type: 'sign-in'
		});

		isLoading = false;

		if (error) {
			errorMessage = error.message || 'Failed to send verification code';
			return;
		}

		isOTPSent = true;
	};

	const verifyOTP = async (otp: string) => {
		isLoading = true;
		errorMessage = '';

		const { error } = await authClient.signIn.emailOtp({ email, otp });

		isLoading = false;

		if (error) {
			if (error.code === 'OTP_EXPIRED') {
				allowResendOTP = true;
				errorMessage = 'Code expired. Please request a new one.';
			} else {
				errorMessage = error.message || 'Invalid code. Please try again.';
			}
			return;
		}

		goto('/dashboard');
	};

	const handleSubmit = (e: Event) => {
		e.preventDefault();
		if (!isOTPSent) {
			sendOTP();
		}
	};

	const goBack = () => {
		isOTPSent = false;
		errorMessage = '';
		allowResendOTP = false;
	};
</script>

<svelte:head>
	<title>Sign In - Speak Phở Real</title>
</svelte:head>

<div class="flex items-center justify-center min-h-[90vh]">
	<div class="flex flex-col gap-6 p-10 min-w-[365px] w-fit">
		{#if isOTPSent}
			<!-- OTP Verification Screen -->
			<div class="text-center">
				<Mail size="40" class="mx-auto my-4" />
				<div class="text-2xl font-bold leading-none tracking-tight">Check your inbox</div>
				<p class="mt-2 text-muted-foreground text-sm">
					We sent a 6-digit code to <strong>{email}</strong>
				</p>
				{#if dev}
					<p class="text-amber-600 text-xs mt-2">
						DEV MODE: Check console for OTP code
					</p>
				{/if}
			</div>

			<div class="flex flex-col items-center gap-4">
				<PinCode onComplete={verifyOTP} bind:this={pinCodeComponent} {isLoading} />

				{#if errorMessage}
					<p class="text-destructive text-sm">{errorMessage}</p>
				{/if}

				{#if allowResendOTP}
					<Button variant="outline" size="sm" onclick={sendOTP} disabled={isLoading}>
						{#if isLoading}
							<Loader2 class="h-4 w-4 mr-2 animate-spin" />
						{/if}
						Resend Code
					</Button>
				{/if}

				<button
					type="button"
					class="text-sm text-muted-foreground hover:underline"
					onclick={goBack}
				>
					← Use a different email
				</button>
			</div>
		{:else}
			<!-- Login Options Screen -->
			<h1 class="text-2xl font-bold text-center">Sign In</h1>

			<!-- Google OAuth -->
			<button
				onclick={signInWithGoogle}
				class={twMerge(
					buttonVariants({ variant: 'outline', size: 'lg' }),
					'flex items-center gap-2 w-full'
				)}
			>
				<Google class="h-4 w-4" />
				Continue with Google
			</button>

			<!-- Divider -->
			<div class="relative">
				<div class="absolute inset-0 flex items-center">
					<span class="w-full border-t"></span>
				</div>
				<div class="relative flex justify-center text-xs uppercase">
					<span class="bg-background px-2 text-muted-foreground">Or</span>
				</div>
			</div>

			<!-- Email OTP Form -->
			<form class="flex flex-col gap-4" onsubmit={handleSubmit}>
				<div class="flex flex-col gap-2">
					<label for="email" class="text-sm font-medium">Email</label>
					<Input
						type="email"
						id="email"
						placeholder="you@example.com"
						bind:value={email}
						required
						disabled={isLoading}
					/>
				</div>

				{#if errorMessage}
					<p class="text-destructive text-sm">{errorMessage}</p>
				{/if}

				<Button type="submit" disabled={isLoading || !email}>
					{#if isLoading}
						<Loader2 class="h-4 w-4 mr-2 animate-spin" />
					{/if}
					Continue with Email
				</Button>
			</form>
		{/if}
	</div>
</div>
