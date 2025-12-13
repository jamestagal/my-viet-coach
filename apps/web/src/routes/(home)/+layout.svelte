<script lang="ts">
    import { PUBLIC_APP_NAME } from '$env/static/public';
    import { browser } from '$app/environment';
    import { page } from '$app/stores';
    import VietLogo from '$lib/components/icons/VietLogo.svelte';
    const { children } = $props();

    // Show login only when #login hash is present in URL
    let showLogin = $state(false);

    $effect(() => {
        if (browser) {
            // Check on initial load and hash changes
            showLogin = window.location.hash === '#login';

            // Listen for hash changes
            const handleHashChange = () => {
                showLogin = window.location.hash === '#login';
            };
            window.addEventListener('hashchange', handleHashChange);

            return () => window.removeEventListener('hashchange', handleHashChange);
        }
    });

    function scrollToWaitlist(e: MouseEvent) {
        e.preventDefault();
        const waitlistSection = document.getElementById('waitlist');
        if (waitlistSection) {
            waitlistSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
</script>

<header>
    <nav class="flex justify-between items-center h-20 px-6">

        <!-- left container -->
        <div class="flex flex-row items-center gap-3">
            <a href="/" class="flex items-center gap-2 group">
                <VietLogo class="transition-transform group-hover:scale-105" size={36} />
                <span class="font-semibold text-lg">{PUBLIC_APP_NAME}</span>
            </a>
        </div>

        <!-- right container -->
        <div class="flex items-center gap-4">
            {#if showLogin}
                <a href="/login" class="text-muted-foreground hover:text-foreground transition-colors font-medium">
                    Login
                </a>
            {/if}
            <button
                onclick={scrollToWaitlist}
                class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors cursor-pointer"
            >
                Get Started
            </button>
        </div>
    </nav>
</header>

<main class="flex flex-col w-full min-h-screen items-center">
    {@render children()}
</main>
