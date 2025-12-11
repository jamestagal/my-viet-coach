<script>
    import { onMount } from 'svelte';
    import { toast } from '$lib/components/ui/toast';

    let { saveInBrowser = false } = $props();

    let email = $state('');
    let isSubscribed = $state(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        try {
            const response = await fetch('/api/public/newsletter', {
                method: 'POST',
                body: JSON.stringify({ email }),
            });
            console.log(response)
            if (response.ok) {
                email = '';
                isSubscribed = true;
                if (saveInBrowser) {
                    localStorage.setItem('newsletterSubscribed', 'true');
                }
                toast.success('Thank you! Subscribed successfully');
            } else {
                const data = await response.json();
                toast.error(data.message);
            }
        } catch (error) {
            toast.error('Failed to subscribe to newsletter');
            console.error(error);
        }
    }


    onMount(() => {
        if (saveInBrowser) {
            const subscribed = localStorage.getItem('newsletterSubscribed');
            if(subscribed === 'true') {
                isSubscribed = true;
            }
        }
    });
</script>

<div class="flex flex-col gap-4">
    {#if isSubscribed}
        <p class="text-center success font-bold">Thank you! Subscribed successfully.</p>
    {:else}
        <form onsubmit={handleSubmit}>
            <div class="input-container !flex-row mb-2">
                <div class="input-field">
                    <input type="email" bind:value={email} placeholder="Email" />
                </div>
                <button type="submit" class="button action p-2 text-sm font-medium">Subscribe</button>
            </div>
            <p class="text-xxs text-fade text-center">By subscribing, you agree to receive our weekly email newsletter.</p>
        </form>
    {/if}
</div>


<!-- @component
- Displays a complete dynamic  newsletter form.
- If optional saveInBrowser is true, the user's email will be saved in browser and input will be hidden after subscribing.
### Usage:
```html
<Newsletter saveInBrowser?={true} />
```
-->
