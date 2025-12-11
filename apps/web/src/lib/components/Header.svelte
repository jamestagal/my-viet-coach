<script lang="ts">
	import { PUBLIC_PROJECT_NAME } from '$env/static/public';

	import { page } from '$app/state';
	import { buttonVariants } from './ui/button';
	import LogoutButton from './login/LogoutButton.svelte';
	import { BookOpen } from 'lucide-svelte';
	import VietLogo from './icons/VietLogo.svelte';
</script>

<header
	class="container border-border/40 bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50 w-full border-b backdrop-blur"
>
	<div class="flex h-14 max-w-screen-2xl items-center">
		<div class="mr-4 flex justify-between w-full">
			<div class="flex items-center gap-6">
				<a href="/" class="flex items-center space-x-2 group">
					<VietLogo class="transition-transform group-hover:scale-105" size={44} />
					<span class="font-semibold text-lg inline-block">{PUBLIC_PROJECT_NAME}</span>
				</a>
				<nav class="hidden md:flex items-center gap-1">
					<a
						href="/practice"
						class="{buttonVariants({ variant: 'ghost', size: 'sm' })} flex items-center gap-2"
					>
						<BookOpen class="h-4 w-4" />
						<span>Practice</span>
					</a>
				</nav>
			</div>
			<div class="flex items-center gap-2">
				{#if page.data.user}
					<LogoutButton />
				{:else}
					<a href="/login" class={buttonVariants({ variant: 'ghost' })}>Sign in</a>
				{/if}
			</div>
		</div>
	</div>
</header>
