<script>
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { toast } from '@components/toast';
	import { UserRound, EllipsisVertical, ChevronLeft, ChevronRight, TicketPercent, Gauge, CreditCard } from 'lucide-svelte';
	import { ToolBox } from '@components/toolbox';
	import { authClient } from '$lib/actions/authClient';
	import AdminPageHeader from '$lib/components/admin/AdminPageHeader.svelte';

	const session = authClient.useSession();
	let subscriptions = $state([]);
	let isLoading = $state(false);
	
	// Pagination
	let totalSubscriptions = $state(0);
	let limit = $state(10);
	let offset = $state(0);
	let page = $derived(offset / limit + 1);
	let totalPages = $derived(Math.ceil(totalSubscriptions / limit));

	onMount(async () => {
		await getSubscriptions();
	});

	async function getSubscriptions() {
		isLoading = true;
	
		try {
			// Added limit and offset to the API call
			const response = await fetch(`/api/private/admin/polar/subscriptions?limit=${limit}&page=${page}`);


			if (!response.ok) {
				if(response.status === 401) {
					$session.refetch()
					invalidate('admin:layout')
				} else {
					throw new Error(`Failed to fetch subscriptions: ${response.statusText}`);
				}
			}

			const data = await response.json();

			if (data && Array.isArray(data.subscriptions) && data.pagination) {
				subscriptions = data.subscriptions;
				totalSubscriptions = data.pagination.totalCount ?? 0;
			} 

		} catch (error) {
			const errorMessage = error.message || 'Error fetching subscriptions';
			toast.error(errorMessage);
			console.error(errorMessage, error);
			subscriptions = [];
			totalSubscriptions = 0;
		} finally {
			isLoading = false;
		}
	}

	// Helper to format currency (assumes amount is in cents)
	function formatCurrency(amount, currency = 'usd') {
		// Check if amount is valid number before processing
		if (typeof amount !== 'number' || isNaN(amount)) return 'N/A';
		return (amount / 100).toLocaleString('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		});
	}

	// Helper to capitalize string
	function capitalize(str) {
		if (!str) return '';
		return str.charAt(0).toUpperCase() + str.slice(1);
	}

	// Updated function to format status, incorporating cancelAtPeriodEnd
	function formatStatus(subscription) {
		const { status, cancelAtPeriodEnd, endsAt } = subscription;
		if (cancelAtPeriodEnd) {
			// Optional: Display cancel date if available
			const date = endsAt ? new Date(endsAt).toLocaleDateString() : ''; // Assuming cancelAt is a UNIX timestamp
			return `Cancels ${date ? `${date}` : ''}`.trim();
			// return 'Canceling'; // Simplified
		}
		return capitalize(status) || 'N/A';
	}

	// Helper to get status badge color
	function getStatusBadgeClass(subscription) {
		const { status, cancelAtPeriodEnd, endsAt } = subscription;
		if ((status === 'active' || status === 'trialing') && cancelAtPeriodEnd) return 'orange'; // Use a distinct color for canceling state
		switch (status) {
			case 'active':
			case 'trialing':
				return 'bg-success';
			case 'past_due':
				return 'bg-warning';
			case 'canceled':
			case 'unpaid': // Added unpaid status
			case 'incomplete': // Added incomplete status
			case 'incomplete_expired': // Added incomplete_expired status
				return 'bg-danger';
			default:
				return 'bg-secondary-2'; // Default for unknown statuses
		}
	}

	// Updated formatPlanDetails
	function formatPlanDetails(subscription) {
		if (!subscription) return { name: 'N/A', details: [], productName: 'N/A' };

		const product = subscription.product;
		const productName = product?.name || 'Unknown Product';
		let details = [];

		// 1. Base Price (Prioritize subscription-specific price/amount)
		let basePriceString = 'N/A';
		// Use the first price object directly attached to the subscription if available
		const subPrice = subscription.prices?.[0];
		const subAmount = subPrice?.price_amount ?? subscription.amount; // Fallback to top-level amount
		const subCurrency = subPrice?.price_currency ?? subscription.currency;
		const subInterval = subPrice?.recurring_interval ?? subscription.recurring_interval;

		if (typeof subAmount === 'number') {
			const formattedAmount = formatCurrency(subAmount, subCurrency);
			const interval = subInterval ? subInterval.replace('_', ' ') : '';
			basePriceString = `${formattedAmount}${interval ? ` / ${interval}` : ''}`;
			details.push({ type: 'price', text: basePriceString });
		} else {
			details.push({ type: 'price', text: 'No base price info' });
		}


		// 2. Discount Information
		const discount = subscription.discount;
		if (discount) {
			let discountString = 'Discount Applied';
			if (discount.name) {
				discountString = `Discount: ${discount.name}`;
			} else if (discount.code) {
				discountString = `Code: ${discount.code}`;
			}

			if (discount.type === 'fixed' && typeof discount.amount === 'number') {
				discountString += ` (${formatCurrency(discount.amount, discount.currency)} off)`;
			} else if (discount.type === 'percentage' && typeof discount.amount === 'number') {
				// Note: Stripe uses 'percent_off' in discount object, but sample shows 'amount' - adjust if needed
				discountString += ` (${discount.amount}% off)`;
			}

			if (discount.duration) {
				discountString += ` (${discount.duration})`;
			}
			details.push({ type: 'discount', text: discountString, icon: TicketPercent });
		}

		// 3. Metered Usage (Optional - Simple Example)
        // Displaying complex metering might need more UI space or a modal
		if (subscription.meters && subscription.meters.length > 0) {
			const meter = subscription.meters[0]; // Displaying info for the first meter only
			if (meter && meter.meter) {
                let meterString = `Usage (${meter.meter.name || 'Metered'}): `;
                meterString += `${meter.consumed_units ?? 0}`;
                if (typeof meter.credited_units === 'number') {
                    meterString += ` / ${meter.credited_units} units`;
                } else {
                     meterString += ` units`;
                }
                // You could add pricing per unit if available in your data
				details.push({ type: 'meter', text: meterString, icon: Gauge });
			}
		}


		return {
			productName: productName,
			details: details
		};
	}

	// Pagination functions
	function changePage(page) {
        offset = (page - 1) * limit;
        getSubscriptions();
    }
</script>

<svelte:head>
    <title>Subscriptions | Admin</title>
</svelte:head>

<AdminPageHeader
    title="Subscriptions"
    subtitle="View and manage active subscriptions from Polar"
    icon={CreditCard}
/>

<div class="card overflow-hidden">
	<div class="overflow-x-auto">
			<!-- Table Header - Hidden on mobile, shown as grid on larger screens -->
			<div class="hidden sm:grid grid-cols-[2fr_1fr_2fr_auto] items-center border-b border-border/50 text-sm font-medium bg-muted">
				<div class="p-2 sm:p-3">User</div>
				<div class="p-2 sm:p-3">Status</div>
				<div class="p-2 sm:p-3">Plan & Price</div>
				<div class="p-2 sm:p-3 text-right">Actions</div>
			</div>

			<!-- Table Body -->
			<div class="divide-y divide-border/50 {isLoading ? 'transition-opacity duration-100 opacity-50' : ''} ">
				{#each subscriptions as subscription (subscription.id)}
					{@const user = subscription.customer}
					{@const planInfo = formatPlanDetails(subscription)}
					{@const status = subscription.status}
					{@const cancelEnd = subscription.cancel_at_period_end}
					{@const cancelAt = subscription.canceled_at}

					<!-- Mobile card layout -->
					<div class="sm:hidden p-3 bg-background hover:bg-muted transition-colors">
						<div class="flex items-start justify-between gap-2">
							<a href={`/admin/users/${user?.externalId || user?.id || ''}`} class="flex items-center gap-2 text-sm min-w-0 flex-1">
								<div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden shrink-0">
									{#if user?.avatar_url}
										<img src={user.avatar_url} alt={user.name || user.email} class="w-full h-full object-cover" />
									{:else}
										<UserRound size={18} />
									{/if}
								</div>
								<div class="flex flex-col truncate">
									<span class="font-medium truncate">{user?.name || 'N/A'}</span>
									<span class="truncate text-secondary-4 text-xs">{user?.email || 'N/A'}</span>
								</div>
							</a>
							<ToolBox position="left" closeOnClick={true}>
								{#snippet trigger()}
									<EllipsisVertical size={20} />
								{/snippet}
								<div class="p-1 min-w-40">
									<a href={`/admin/users/${user?.externalId || user?.id || ''}`} class="button menu w-full">
										<UserRound size={20} />
										<span>View User</span>
									</a>
								</div>
							</ToolBox>
						</div>
						<div class="flex items-center gap-2 mt-2 flex-wrap">
							<span class="badge {getStatusBadgeClass(subscription)}">
								{formatStatus(subscription)}
							</span>
							<span class="text-xs text-secondary-4">{planInfo.productName}</span>
						</div>
					</div>

					<!-- Desktop grid layout -->
					<div class="hidden sm:grid grid-cols-[2fr_1fr_2fr_auto] items-center bg-background hover:bg-muted transition-colors">
						<!-- User Info -->
						<a href={`/admin/users/${user?.externalId || user?.id || ''}`} class="p-2 sm:p-3 flex items-center gap-2 sm:gap-3 text-sm truncate">
							<div class="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground overflow-hidden shrink-0">
								{#if user?.avatar_url}
									<img src={user.avatar_url} alt={user.name || user.email} class="w-full h-full object-cover" />
								{:else}
									<UserRound size={20} />
								{/if}
							</div>
							<div class="flex flex-col truncate">
								<span class="font-medium truncate">{user?.name || 'N/A'}</span>
								<span class="truncate text-secondary-4 text-xs">{user?.email || 'N/A'}</span>
							</div>
						</a>

						<!-- Status -->
						<div class="p-2 sm:p-3">
							<span class="badge {getStatusBadgeClass(subscription)}">
								{formatStatus(subscription)}
							</span>
						</div>

						<!-- Plan & Price Details -->
						<div class="p-2 sm:p-3 text-sm flex flex-col gap-0.5">
							<span class="font-medium text-secondary truncate">{planInfo.productName}</span>
							{#each planInfo.details as detail}
								<div class="text-secondary-4 flex items-center gap-1 text-xs">
                                    <detail.icon size={12} class="opacity-70 shrink-0" />
									<span class="truncate">{detail.text}</span>
								</div>
							{/each}
						</div>

						<!-- Actions -->
						<div class="p-2 sm:p-3 flex justify-end">
							<ToolBox position="left" closeOnClick={true}>
								{#snippet trigger()}
									<EllipsisVertical size={20} />
								{/snippet}
								<div class="p-1 min-w-40">
									<a href={`/admin/users/${user?.externalId || user?.id || ''}`} class="button menu w-full">
										<UserRound size={20} />
										<span>View User</span>
									</a>
								</div>
							</ToolBox>
						</div>
					</div>
				{:else}
                    <div class="w-full p-4 h-full flex items-center justify-center z-10">
                        {#if isLoading}
                            <div class="animate-spin h-6 w-6 border-3 border-border border-t-muted-foreground rounded-full"></div>
                        {:else}
                            <div class="text-sm text-secondary-4">No subscriptions found</div>
                        {/if}
                    </div>
				{/each}
			</div>
		</div>
		<!-- Pagination -->
		{#if totalPages > 1}
		<div class="flex flex-col sm:flex-row justify-between items-center gap-2 p-2 sm:p-3 border-t border-border/50">
			<span class="text-xs sm:text-sm text-secondary-4">
				Page {page} of {totalPages} <span class="hidden sm:inline">({totalSubscriptions} subscriptions)</span>
			</span>
			<div class="flex gap-2">
				<button class="button p-2 highlight" onclick={() => changePage(page - 1)} disabled={page <= 1 || isLoading}>
					<ChevronLeft size={18} />
				</button>
				<button class="button p-2 highlight" onclick={() => changePage(page + 1)} disabled={page >= totalPages || isLoading}>
					<ChevronRight size={18} />
				</button>
			</div>
		</div>
	{/if}
</div>
