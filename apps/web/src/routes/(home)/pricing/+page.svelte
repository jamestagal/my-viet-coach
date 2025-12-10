<script>
    import { PUBLIC_APP_NAME } from '$env/static/public';
    import ToggleButton from '$lib/client/components/ToggleButton.svelte';
    import ArrowRight from '@icons/arrow-right.svelte'
    import Check from '@icons/check.svelte'
    import ProductCard from '@components/ProductCard.svelte';

    let { data } = $props();
    let products = $derived(data.products || []);

    let selectedInterval = $state('month');

    // Check if any product has a yearly fixed price option
    let hasYearlyPlans = $derived(products.some(product => 
        product.prices.some(price => price.amountType === 'fixed' && price.interval === 'year')
    ));

    // Derived list of products to display
    let filteredProducts = $derived(products.filter(product => {
        const hasFixedOneTime = product.prices.some(p => p.amountType === 'fixed' && p.interval === 'one_time');
        const hasFixedSelectedInterval = product.prices.some(p => p.amountType === 'fixed' && p.interval === selectedInterval);
        const hasOnlyMetered = !product.prices.some(p => p.amountType === 'fixed');
        const hasMeteredSelectedInterval = product.prices.some(p => p.amountType === 'metered_unit' && p.interval === selectedInterval);

        return hasFixedOneTime || hasFixedSelectedInterval || (hasOnlyMetered && hasMeteredSelectedInterval);
    }));


</script>

<svelte:head>
    <title>Pricing | {PUBLIC_APP_NAME}</title>
</svelte:head>

<section class="flex flex-col w-full h-full mx-auto px-4 gap-12 mt-20 items-center justify-center">

    <header class="heading">
            <h1>PRICING</h1>
            <h2>Choose Your Plan</h2>
            <h3>All plans include 14-day money-back guarantee.</h3>
    </header>



    {#if hasYearlyPlans}
    <div class="card card-ring flex flex-row gap-2 p-1 mb-6 text-sm w-full max-w-md">
        <button type="button" class="button w-1/2 p-2 justify-center {selectedInterval === 'month' ? 'action shadow-lg' : ''}" onclick={() => selectedInterval = 'month'}>
            Monthly
        </button>
        <button type="button" class="button w-1/2 p-2 gap-2 justify-center {selectedInterval === 'year' ? 'action shadow-lg' : ''}" onclick={() => selectedInterval = 'year'}>
            Yearly <span class="badge bg-primary-accent text-main text-xxs">2 Months Free</span>
        </button>
    </div>
    {/if}

    <div class="flex flex-row flex-wrap w-full gap-6 items-stretch justify-center">
        
        {#if filteredProducts.length === 0}
             <p class="text-fade text-center w-full">No plans available currently.</p>
        {:else}
            {#each filteredProducts as product (product.productId)}
             

                <ProductCard product={product} />

            {/each}
        {/if}
    </div>
</section>
