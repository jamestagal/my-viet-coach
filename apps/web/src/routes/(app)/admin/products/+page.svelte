<script>
	import { AdminButton } from '$lib/components/ui/admin-button';
	import { ToggleButton } from '$lib/components/ui/toggle-button';
    import { Dropdown } from '$lib/components/ui/dropdown';
	import { Modal } from '$lib/components/ui/model';
    import { onMount } from 'svelte';
	import { toast } from '$lib/components/ui/toast';
	import { Settings, X, Plus, Check, Package } from 'lucide-svelte';
	import AdminPageHeader from '$lib/components/admin/AdminPageHeader.svelte';

    
	// Use separate state variables for clarity
	let dbProducts = $state([]);
	let polarProducts = $state([]);
    let plans = $state([]);
    let isLoading = $state(false); // Keep loading state for delete/import actions
    let isImporting = $state(false); // Keep loading state for delete/import actions
    let isFetchingDatabaseProducts = $state(true);
    let isFetchingPolarProducts = $state(true);


    onMount(async () => {
        await fetchDatabaseProducts();
        await fetchPolarProducts();
    });

    async function fetchDatabaseProducts() {
        try {
            isFetchingDatabaseProducts = true;
            const response = await fetch('/api/private/admin/products');
            if (!response.ok) {
                throw new Error('Failed to fetch database products');
            }
            const data = await response.json();
            dbProducts = data.products || [];
            plans = data.plans || [];
        } catch (error) {
            const errorMessage = error.message || 'Error fetching database products';
            toast.error(errorMessage);
            console.error('Error fetching database products:', error);
        } finally {
            isFetchingDatabaseProducts = false;
        }
    }

    async function fetchPolarProducts() {
        try {
            isFetchingPolarProducts = true;
            const response = await fetch('/api/private/admin/polar/products');
            if (!response.ok) {
                throw new Error('Failed to fetch polar products');
            }
            const data = await response.json();
            // Filter out products that already exist in dbProducts
            const allPolarProducts = data || [];
            polarProducts = allPolarProducts.filter(polarProduct => 
                !dbProducts.some(dbProduct => dbProduct.productId === polarProduct.productId)
            );
        } catch (error) {
            const errorMessage = error.message || 'Error fetching polar products';
            toast.error(errorMessage);
            console.error(errorMessage, error);
        } finally {
            isFetchingPolarProducts = false;
        }
    }


    // Modal state
    let modalOpen = $state(false);
    let currentProduct = $state(null);
    let editFeatures = $state([]);
    
    function openSettings(product) {
        currentProduct = {...product};
        editFeatures = [...(product.features || [])];
        modalOpen = true;
    }
    
    function closeModal() {
        modalOpen = false;
        currentProduct = null;
    }
    
    // Add a new feature
    let newFeature = $state('');
    
    function addFeature() {
        if (!newFeature.trim()) return;
        editFeatures = [...editFeatures, newFeature.trim()];
        newFeature = '';
    }
    
    function removeFeature(index) {
        editFeatures = editFeatures.filter((_, i) => i !== index);
    }

	// Handle toggling 'showOnPricingPage'
	async function handleUpdate(productId, updates) {
		try {
            isLoading = true;
			const response = await fetch(`/api/private/admin/products/${productId}`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(updates)
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({ message: `HTTP Error: ${response.status}` }));
				throw new Error(errorData.message || 'Failed to update product');
			}

            // Optimistically update UI or refetch/update from response
            const updatedProduct = await response.json();
            dbProducts = dbProducts.map(p => p._id === productId ? updatedProduct : p);
            toast.success(`Settings saved for: ${updatedProduct.name}`);
            closeModal();

		} catch (error) {
            dbProducts = data.products || [];
            console.error(`Error updating product:`, error);
            toast.error(error.message);
		} finally {
			isLoading = false;
		}
    }
    
    // Save all settings from modal
    function saveSettings() {

        
        handleUpdate(currentProduct._id, {
            active: currentProduct.active,
            showOnPricingPage: currentProduct.showOnPricingPage,
            plan: currentProduct.plan,
            features: editFeatures
        });
    }

	// Keep the delete function for database products
	async function handleDelete(id) {
		if (!confirm('Are you sure you want to delete this product from the database?')) {
			return;
		}
        
		try {
            isLoading = true;
			const response = await fetch(`/api/private/admin/products/${id}`, {
				method: 'DELETE'
			});

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP Error: ${response.status}` }));
                throw new Error(errorData.message || 'Failed to delete product');
            }

			// Remove the product from the local list
			dbProducts = dbProducts.filter(p => p._id !== id);
            closeModal();

		} catch (error) {
            console.error('Error deleting product:', error);
            pageError = `Error deleting product: ${error.message}`;
		} finally {
            isLoading = false;
        }
	}

    // Import a Polar product using its raw data
    async function handleImport(productToImport) {
        console.log("Attempting to import raw Polar product data:", productToImport);

        isLoading = true;

        try {
             const response = await fetch(`/api/private/admin/products`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productToImport)
             });

             if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: `HTTP Error: ${response.status}` }));
                throw new Error(errorData.message || 'Failed to import product');
            }

            const newDbProduct = await response.json();

            // Add to dbProducts and remove from polarProducts
            dbProducts = [...dbProducts, newDbProduct];
            polarProducts = polarProducts.filter(p => p.productId !== productToImport.productId);

        } catch (error) {
             console.error('Error importing product:', error);
             pageError = `Error importing product: ${error.message}`;
        } finally {
            isLoading = false;
        }
    }
</script>

<svelte:head>
    <title>Products | Admin</title>
</svelte:head>

<AdminPageHeader
    title="Products"
    subtitle="Manage your products and sync with Polar"
    icon={Package}
/>

<div class="flex flex-col space-y-12">

    <!-- Section for Products in Database -->
    <section>
        {#if isFetchingDatabaseProducts}
             <div class="card p-8 flex justify-center items-center min-h-40">
                <div class="animate-spin h-8 w-8 border-3 border-primary-3 border-t-primary-6 rounded-full"></div>
             </div>
        {:else if dbProducts.length > 0}
            <div class="flex flex-row flex-wrap gap-8">
                {#each dbProducts as product (product._id)}
                    {@const fixedPrice = product.prices?.find(p => p.amountType === 'fixed')}
                    {@const meteredPrices = product.prices?.filter(p => p.amountType === 'metered_unit') || []}

                    <div class="card card-ring w-full md:max-w-96 p-5 flex flex-col justify-between space-y-3">
                        <div class="flex-grow space-y-2">
                            <div class="flex justify-between items-start">
                                <h3 class="text-lg font-semibold">{product.name}</h3>
                                <button 
                                    class="button p-1.5"
                                    onclick={() => openSettings(product)}
                                    aria-label="Product settings"
                                >
                                    <Settings size={18} />
                                </button>
                            </div>
                            
                            {#if product.description}
                                <div class="max-h-12 overflow-x-hidden overflow-y-auto">
                                    <strong>Description:</strong> {product.description}
                                </div>
                            {/if}
                            {#if product.plan}
                                <div>
                                    <strong>Plan:</strong> {product.plan}
                                </div>
                            {/if}
                            
                            {#if fixedPrice}
                                <div>
                                    <strong>Base Price:</strong> ${(fixedPrice.amount / 100).toFixed(2)} / {fixedPrice.interval || 'one-time'}
                                </div>
                            {/if}
                            
                            {#if meteredPrices.length > 0}
                            <div class="flex flex-col gap-1">
                                <div>
                                    {#if fixedPrice}
                                       Plus additional usage-based charges:
                                    {:else}
                                       Usage-based:
                                    {/if}
                                </div>

                                {#each meteredPrices as unit, i}
                                <div class="    pt-1">
                                       <strong>{unit.name}</strong> ${(unit.amount / 100).toFixed(2)}/unit (billed per {unit.interval || 'product interval'})
                                </div>
                                {/each}
                            </div>
                            {/if}
                            
                            <!-- Display features -->
                            {#if product.features && product.features.length > 0}
                                <div class="flex flex-col gap-1">
                                    <h4 class="text-sm font-medium">Features:</h4>
                                        {#each product.features as feature}
                                            <div class="flex flex-row items-center gap-1">
                                                <Check size={14} />
                                                <span>{feature}</span>
                                            </div>
                                        {/each}
                                    </div>
                            {/if}
                        </div>

                        <div class="border-t border-primary-2 pt-3 space-y-2">
                            <div class="flex items-center gap-2">
                                {#if product.active}
                                    <span class="px-2 py-0.5 bg-success text-main text-xs rounded-full">Active</span>
                                {:else}
                                    <span class="px-2 py-0.5 bg-primary-2 text-main text-xs rounded-full">Inactive</span>
                                {/if}
                                
                                {#if product.showOnPricingPage}
                                    <span class="px-2 py-0.5 bg-secondary-2 text-main text-xs rounded-full">Public</span>
                                {:else}
                                    <span class="px-2 py-0.5 bg-primary-2 text-main text-xs rounded-full">Hidden</span>
                                {/if}
                            </div>
                        </div>

                        <p class="text-xs text-secondary-4">Polar ID: {product.productId}</p>
                    </div>
                {/each}
            </div>
        {:else}
             <div class="card p-5 text-center text-secondary-4">
                No products found in the database. Add one manually or import from Polar.
            </div>
        {/if}
    </section>


     <!-- Section for Unlisted Products from Polar -->
    <section>
        <h2 class="text-xl font-semibold mb-1">Available for Import</h2>
        <p class="text-sm text-fade mb-4">Import products from <strong>Polar</strong> to the database.</p>
        {#if isFetchingPolarProducts}
            <div class="card p-8 flex justify-center items-center min-h-40">
                <div class="animate-spin h-8 w-8 border-3 border-primary-3 border-t-primary-6 rounded-full"></div>
            </div>
        {:else if polarProducts.length > 0}
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {#each polarProducts as product (product.productId)} <!-- Use productId as key -->
                    {@const fixedPrice = product.prices?.find(p => p.amountType === 'fixed')}
                    {@const meteredPrices = product.prices?.filter(p => p.amountType === 'metered_unit') || []}
                    <div class="card p-5 opacity-70 hover:opacity-100 transition-opacity duration-300 flex flex-col justify-between bg-primary-2 space-y-3">
                         <div class="flex-grow space-y-1.5">
                            <h3 class="text-lg font-semibold flex items-center gap-2">
                                {product.name}
                                {#if !product.active} <!-- Uses active field from mapped object -->
                                    <span class="badge orange">Archived</span>
                                {/if}
                            </h3>
                            {#if product.description}
                                <p>{product.description}</p>
                            {/if}
                            {#if fixedPrice}
                                <p>
                                    <span class="font-medium">Fixed Price:</span>
                                     ${(fixedPrice.amount / 100).toFixed(2)} / {fixedPrice.interval}
                                </p>
                             {/if}

                            {#if meteredPrices.length > 0}
                                <div class="pt-1">
                                    <span class="font-medium">Metered Units:</span>
                                    <div class="flex flex-col gap-1">
                                        {#each meteredPrices as unit, i}
                                            <span>{unit.name} (${(unit.amount / 100).toFixed(2)}/unit billed per {unit.interval || 'interval'})</span>
                                        {/each}
                                    </div>
                                </div>
                            {/if}
                             <p class="text-secondary-4 text-xs pt-1">Polar ID: {product.productId}</p>
                        </div>
                        <div class="flex gap-2 pt-3">
                            <AdminButton
                                onclick={() => handleImport(product)}
                                size="sm"
                                variant="action"
                                isLoading={isLoading}
                                disabled={isLoading || !product.active}
                                title={!product.active ? 'Cannot import archived product' : 'Import to Database'}
                            >
                                Import to DB
                            </AdminButton>
                        </div>
                    </div>
                {/each}
            </div>
        {:else}
            <div class="card p-5 text-center text-secondary-4">
                No unlisted products found in Polar.
            </div>
        {/if}
    </section>

</div>

<!-- Settings Modal -->
{#if currentProduct}
<Modal
    isOpen={modalOpen}
    title="Product Settings"
    maxWidth="max-w-lg"
    on:close={closeModal}
>
    <div class="p-5 space-y-3">
        <div>
            <h3 class="font-semibold text-lg">{currentProduct.name}</h3>
            {#if currentProduct.description}
                <p class="text-sm text-fade">{currentProduct.description}</p>
            {/if}
        </div>

        <Dropdown name="plan" options={plans} bind:value={currentProduct.plan} />

        <div class="bg-primary-2 rounded-lg p-3 text-sm">
            Based on Polar webhooks 
            <span class="font-medium bg-primary-3 p-1 rounded-lg text-xs">
                subscription.plan = {currentProduct.plan}
            </span>
            will be updated according to this setting.
        </div>

        <div class="flex justify-between items-center card p-2">
            <label for="active-toggle" class="font-medium">Active</label>
            <ToggleButton
                name="active-toggle"
                checked={currentProduct.active}
                onchange={() => currentProduct.active = !currentProduct.active}
            />
        </div>
        
        <div class="flex justify-between items-center card p-2">
            <label for="pricing-toggle" class="font-medium">Show on Pricing Page</label>
            <ToggleButton
                name="pricing-toggle"
                checked={currentProduct.showOnPricingPage}
                onchange={() => currentProduct.showOnPricingPage = !currentProduct.showOnPricingPage}
            />
        </div>
        
        <!-- Features Management -->
        <div class="flex flex-col gap-2">
            <h4 class="font-medium mb-2">Features</h4>
            
            <div class="flex flex-col gap-2 overflow-hidden">
                {#if editFeatures.length === 0}
                    <p class="text-sm text-secondary-4 italic">No features added yet</p>
                {:else}
                    {#each editFeatures as feature, i}
                        <div class="flex items-center card p-2">
                            <span class="flex-grow">{feature}</span>
                            <button
                                class="button danger p-1"
                                onclick={() => removeFeature(i)}
                                aria-label="Remove feature"
                            >
                                <X strokeWidth={3} size={12} />
                            </button>
                        </div>
                    {/each}
                {/if}
            </div>
            
            <div class="input-container !flex-row gap-2">
                <div class="input-field">

                    <input 
                        type="text"
                        placeholder="Add new feature (e.g. 'Unlimited emails')"
                        bind:value={newFeature}
                        onkeydown={(e) => e.key === 'Enter' && addFeature()}
                        />
              
                </div>
                <AdminButton
                onclick={addFeature}
                variant="outline"
                disabled={!newFeature.trim()}>
                <Plus strokeWidth={3} size={12} />
                </AdminButton>
            </div>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex justify-between pt-4">
            <AdminButton
                onclick={() => handleDelete(currentProduct._id)}
                size="sm"
                variant="danger"
                disabled={isLoading}
            >
                Delete Product
            </AdminButton>


                <AdminButton
                    onclick={saveSettings}
                    size="sm"
                    variant="action"
                    isLoading={isLoading}
                    disabled={isLoading}
                >
                    Save Changes
                </AdminButton>

        </div>
    </div>
</Modal>
{/if}