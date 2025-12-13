<script>
    import { onMount } from 'svelte';
    import { toast } from '$lib/components/ui/toast';
    import { Loader2 } from 'lucide-svelte';

    let { saveInBrowser = false } = $props();

    let email = $state('');
    let isSubscribed = $state(false);
    let isLoading = $state(false);
    let successMessage = $state('');

    const handleSubmit = async (event) => {
        event.preventDefault();

        if (!email || isLoading) return;

        isLoading = true;

        try {
            const response = await fetch('/api/public/newsletter', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (response.ok) {
                email = '';
                isSubscribed = true;
                successMessage = data.message || 'Thank you! Subscribed successfully.';
                if (saveInBrowser) {
                    localStorage.setItem('newsletterSubscribed', 'true');
                }
                toast.success(successMessage);
            } else {
                toast.error(data.message || 'Failed to subscribe');
            }
        } catch (error) {
            toast.error('Failed to subscribe to waitlist');
            console.error(error);
        } finally {
            isLoading = false;
        }
    }


    onMount(() => {
        if (saveInBrowser) {
            const subscribed = localStorage.getItem('newsletterSubscribed');
            if(subscribed === 'true') {
                isSubscribed = true;
                successMessage = 'Thank you! Subscribed successfully.';
            }
        }
    });
</script>

<div class="flex flex-col gap-4">
    {#if isSubscribed}
        <p class="text-center success font-bold">{successMessage}</p>
    {:else}
        <form onsubmit={handleSubmit}>
            <div class="input-container !flex-row mb-2">
                <div class="input-field">
                    <input
                        type="email"
                        bind:value={email}
                        placeholder="Email"
                        disabled={isLoading}
                        required
                    />
                </div>
                <button
                    type="submit"
                    class="button action p-2 text-sm font-medium flex items-center gap-2"
                    disabled={isLoading || !email}
                >
                    {#if isLoading}
                        <Loader2 class="h-4 w-4 animate-spin" />
                        <span>Joining...</span>
                    {:else}
                        <span>Join Waitlist</span>
                    {/if}
                </button>
            </div>
            <p class="text-xxs text-fade text-center">We'll notify you when early access opens.</p>
        </form>
    {/if}
</div>


<!-- @component
- Displays a complete dynamic newsletter/waitlist form.
- If optional saveInBrowser is true, the user's email will be saved in browser and input will be hidden after subscribing.
### Usage:
```html
<Newsletter saveInBrowser?={true} />
```
-->
