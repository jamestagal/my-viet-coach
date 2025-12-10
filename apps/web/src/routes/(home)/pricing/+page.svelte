<script>
    import { PUBLIC_PROJECT_NAME } from '$env/static/public';
    import { Check } from 'lucide-svelte';
</script>

<svelte:head>
    <title>Pricing | {PUBLIC_PROJECT_NAME}</title>
</svelte:head>

<section class="flex flex-col w-full min-h-screen mx-auto px-4 py-20 gap-12 items-center justify-center">
    <header class="text-center">
        <h1 class="text-sm uppercase tracking-widest text-muted-foreground mb-2">Pricing</h1>
        <h2 class="text-3xl font-bold mb-4">Choose Your Plan</h2>
        <p class="text-muted-foreground">Start learning Vietnamese today</p>
    </header>

    <div class="grid md:grid-cols-2 gap-6 max-w-3xl w-full">
        <!-- Free Plan -->
        <div class="bg-card border border-border rounded-xl p-6 flex flex-col">
            <h3 class="text-xl font-semibold mb-2">Free</h3>
            <p class="text-3xl font-bold mb-4">$0<span class="text-sm text-muted-foreground">/month</span></p>
            <ul class="flex-1 space-y-3 mb-6">
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    5 practice sessions per day
                </li>
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    Basic pronunciation feedback
                </li>
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    Essential vocabulary lessons
                </li>
            </ul>
            <a href="/login" class="btn bg-muted hover:bg-muted/80 text-center py-2 rounded-lg font-medium">
                Get Started
            </a>
        </div>

        <!-- Pro Plan -->
        <div class="bg-card border-2 border-primary rounded-xl p-6 flex flex-col relative">
            <span class="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full">
                Popular
            </span>
            <h3 class="text-xl font-semibold mb-2">Pro</h3>
            <p class="text-3xl font-bold mb-4">$9<span class="text-sm text-muted-foreground">/month</span></p>
            <ul class="flex-1 space-y-3 mb-6">
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    Unlimited practice sessions
                </li>
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    Advanced AI pronunciation coach
                </li>
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    Full lesson library access
                </li>
                <li class="flex items-center gap-2 text-sm">
                    <Check size={16} class="text-primary" />
                    Progress tracking & analytics
                </li>
            </ul>
            <a href="/login" class="btn bg-primary hover:bg-primary/90 text-primary-foreground text-center py-2 rounded-lg font-medium">
                Start Free Trial
            </a>
        </div>
    </div>
</section>
