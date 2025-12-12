<script>
    import { onMount } from 'svelte';
    import { goto } from '$app/navigation';
    import { LoaderCircle, CreditCard, CircleCheck } from 'lucide-svelte';
    import { Dropdown } from '$lib/components/ui/dropdown';
    import { ToggleButton } from '$lib/components/ui/toggle-button';
    import { Button } from '$lib/components/ui/button';
    import { toast } from '$lib/components/ui/toast';
    import { authClient } from '$lib/actions/authClient';

    const useSession = authClient.useSession();



    let products = $state([]);
    let subscriptions = $state([]);
    let selectedInterval = $state('month');
    let isLoading = $state(true);


    onMount(async () => {
        await getSubscriptions();
        await getProducts();
        isLoading = false;
    });


    async function getSubscriptions() {
        try {
       
            const response = await fetch('/api/private/subscriptions');

            if(!response.ok) {
                if(response.status === 401) {
                    await $useSession.refetch();
                }
                throw new Error(`Failed to fetch subscription state: ${response.statusText}`);
            }
            subscriptions = await response.json();
        } catch (error) {
            toast.error('Trouble fetching subscription state');
            console.error('Error fetching subscription state:', error);
        }
    }


    async function getProducts() {
        try {
            if(subscriptions.length > 0) {
                return;
            }
            const response = await fetch('/api/public/products');
            if(!response.ok) {
                throw new Error('Failed to fetch products');
            }
            products = await response.json();
        } catch (error) {
            toast.error('Error fetching products');
            console.error('Error fetching products:', error);
        }
    }



    // Create a derived state for available products based on the selected interval
    let availableProducts = $derived.by(() => {

        return products
            .filter(product => {
                const hasOneTimePrice = product.prices.some(p => p.interval === 'one_time');
                const hasMatchingIntervalPrice = product.prices.some(p => p.interval === selectedInterval);
                return hasOneTimePrice || hasMatchingIntervalPrice;
            })
            .map(product => {
                let price = product.prices.find(p => p.interval === selectedInterval);
                if (!price) {
                    price = product.prices.find(p => p.interval === 'one_time');
                }

                // Return the product structure needed for display
                return {
                    name: product.name,
                    productId: product.productId,
                    price: price ? price.amount / 100 : 'unknown',
                    interval: price ? price.interval : 'unknown',
                    description: product.description,
                };
            })
            .sort((a, b) => a.price - b.price);
    });


    function handleToggleChange(checked) {
        selectedInterval = checked ? 'year' : 'month';
    }

    /**
     * Redirect to Polar checkout with the selected product
     */
    function startCheckout(productId) {
        // The @polar-sh/sveltekit Checkout handler expects 'products' as the query param
        window.location.href = `/api/polar/checkout?products=${productId}`;
    }
</script>

        {#if subscriptions.length > 0}
             <!-- User HAS active subscriptions: Show Manage View -->
             <div class="flex flex-col my-8 gap-4">
                 <h3 class="text-lg font-semibold text-center mb-4">Your Active Subscription(s)</h3>
                 <div class="flex flex-col gap-3">
                    {#each subscriptions as sub (sub._id)}
                        {@const productDetails = sub.productId || {}}
                        {@const priceInfo = productDetails.prices?.[0] || {}}
                        {@const displayPrice = priceInfo.amount ? priceInfo.amount / 100 : 0}
                        {@const displayInterval = priceInfo.interval || 'unknown'}
                         <div class="flex items-center justify-between p-4 card !border-secondary-4 shadow-md">
                            <div class="flex flex-col gap-2">
                                <span class="font-bold">{productDetails.name || 'Subscribed Plan'}</span>
                                <span class="text-sm text-secondary-4">
                                    ${displayPrice} {displayInterval && displayInterval !== 'one_time' ? `/ ${displayInterval}` : ''}
                                </span>
                                <span class="text-xs flex items-center gap-1 font-medium">
                                     <CircleCheck size={14} /> Active
                                </span>
                            </div>
                            <a href="/api/polar/portal" class="button center action px-3 py-2 text-sm">
                                Manage
                            </a>
                        </div>
                    {/each}
                 </div>
             </div>
        {:else if availableProducts.length > 0}
             <!-- User does NOT have active subscriptions: Show Product Selection View -->
            <div class="flex flex-col my-8 gap-4">
                <div class="flex flex-row items-center justify-center gap-2 text-sm">
                    <span>Monthly</span>
                    <ToggleButton onchange={handleToggleChange} />
                    <span>Yearly <span class="text-emerald-500">20% off</span></span>
                </div>

                <div class="flex flex-col gap-3">
                     {#each availableProducts as product (product.productId)}
                         <div class="flex items-center justify-between p-4 card">
                            <div class="flex flex-col gap-2">
                                <span class="font-bold">{product.name}</span>
                                <span class="text-sm text-fade">
                                    ${product.price} {product.interval !== 'one_time' ? `/ ${product.interval}` : ''}
                                </span>
                                {#if product.description}
                                    <span class="text-xs text-fade">{product.description}</span>
                                {/if}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onclick={() => startCheckout(product.productId)}
                            >
                                {product.interval === 'one_time' ? 'Purchase' : 'Subscribe'}
                            </Button>
                         </div>
                     {/each}
                </div>

                <div class="text-fade text-center text-xs">
                    Looking to compare plans? <a href="/pricing" target="_blank" class="text-emerald-500">See pricing</a>
                </div>
            </div>
        {:else if !isLoading}
            <div class="flex flex-col my-8 gap-4">
                <h3 class="text-lg font-semibold text-center mb-4">No active subscriptions</h3>
                <p class="text-center text-sm text-fade">
                    You don't have any active subscriptions.
                </p>
            </div>
        {:else}
            <div class="flex flex-col my-8 gap-4 items-center justify-center">
                <LoaderCircle size={24} class="animate-spin text-fade" />
            </div>
        {/if}