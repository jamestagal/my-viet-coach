import { dev } from '$app/environment';
import { Polar } from '@polar-sh/sdk';
import { POLAR_ACCESS_TOKEN } from '$env/static/private';
import { getDb } from '$lib/server/database/db';
import { subscription, product } from '$lib/server/database/schema';
import { eq, and } from 'drizzle-orm';

// ============================================================================
// POLAR CLIENT INITIALIZATION
// ============================================================================

// Lazy-initialized Polar client to prevent crashes when env vars are missing
let _polarClient: Polar | null = null;

export function getPolarClient(): Polar {
	if (!_polarClient) {
		if (!POLAR_ACCESS_TOKEN) {
			throw new Error('POLAR_ACCESS_TOKEN environment variable is not set');
		}
		_polarClient = new Polar({
			accessToken: POLAR_ACCESS_TOKEN,
			server: dev ? 'sandbox' : 'production'
		});
	}
	return _polarClient;
}

// Keep backwards compatibility - but this will now throw if accessed without the token
export const polarClient = {
	get customers() { return getPolarClient().customers; },
	get products() { return getPolarClient().products; },
	get subscriptions() { return getPolarClient().subscriptions; },
	get checkouts() { return getPolarClient().checkouts; },
	get orders() { return getPolarClient().orders; }
} as unknown as Polar;

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Type for subscription webhook event
interface SubscriptionWebhookEvent {
	type: string;
	data: {
		id: string;
		status: string;
		customer?: {
			id: string;
			externalId?: string;
		};
		product?: {
			id: string;
		};
		currentPeriodStart?: string;
		currentPeriodEnd?: string;
		trialEnds?: string;
		cancelAtPeriodEnd?: boolean;
	};
}

// Type for product webhook event
interface ProductWebhookEvent {
	type: string;
	data: PolarProduct;
}

// Type definitions for Polar product mapping
interface PolarPrice {
	isArchived?: boolean;
	amountType: string;
	type: string;
	recurringInterval?: string;
	priceAmount?: number;
	unitAmount?: number;
	meter?: {
		name?: string;
	};
}

interface PolarProduct {
	id: string;
	name: string;
	description?: string;
	isArchived?: boolean;
	prices?: PolarPrice[];
	metadata?: {
		plan?: string;
	};
}

interface MappedPrice {
	amountType: string;
	interval: string | null;
	name?: string;
	amount: number;
}

interface MappedProduct {
	name: string;
	description?: string;
	plan?: string;
	productId: string;
	active: boolean;
	prices: MappedPrice[];
}

// ============================================================================
// PLAN MAPPING UTILITIES (Task 4.3)
// ============================================================================

/**
 * Usage plan types that map to Durable Object plans
 */
export type UsagePlanType = 'free' | 'basic' | 'pro';

/**
 * Map Polar product metadata.plan to usage plan types.
 * Includes aliases for common plan naming variations.
 */
export const PLAN_MAPPING: Record<string, UsagePlanType> = {
	'free': 'free',
	'basic': 'basic',
	'starter': 'basic',     // Alias
	'pro': 'pro',
	'premium': 'pro',       // Alias
	'enterprise': 'pro',    // Treat enterprise as pro for usage limits
};

/**
 * Convert a Polar plan name to a usage plan type.
 * Returns 'free' for unknown or missing plans.
 */
export function mapPolarPlanToUsagePlan(polarPlan: string | null | undefined): UsagePlanType {
	if (!polarPlan) return 'free';
	return PLAN_MAPPING[polarPlan.toLowerCase()] ?? 'free';
}

// ============================================================================
// DURABLE OBJECT INTEGRATION (Task 4.4)
// ============================================================================

/**
 * Update the UserUsageObject when a subscription changes.
 * This ensures real-time plan enforcement without database lookups.
 *
 * Uses an internal API endpoint because:
 * - SvelteKit Pages and Durable Objects live in separate workers
 * - Cross-worker communication requires HTTP or service bindings
 *
 * @param env - Platform environment with API_URL and INTERNAL_API_SECRET
 * @param userId - The user's ID to update
 * @param plan - The new usage plan type
 * @param action - The type of change: upgrade, downgrade, or cancel
 */
export async function updateUserUsageDO(
	env: App.Platform['env'] | undefined,
	userId: string,
	plan: UsagePlanType,
	action: 'upgrade' | 'downgrade' | 'cancel'
): Promise<void> {
	if (!env) {
		console.warn('[Polar->DO] Platform env not available, skipping DO update');
		return;
	}

	try {
		// Get API URL from env or use production default
		const apiUrl = env.API_URL || 'https://viet-coach-api.benjaminwaller.workers.dev';
		const internalSecret = env.INTERNAL_API_SECRET;

		if (!internalSecret) {
			console.warn('[Polar->DO] INTERNAL_API_SECRET not configured, skipping DO update');
			return;
		}

		const response = await fetch(`${apiUrl}/api/internal/update-plan`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Internal-Secret': internalSecret,
			},
			body: JSON.stringify({ userId, plan, action }),
		});

		if (!response.ok) {
			const errorText = await response.text();
			console.error('[Polar->DO] API call failed:', response.status, errorText);
		} else {
			const result = await response.json();
			console.log(`[Polar->DO] Updated user ${userId} to ${plan} plan via API`, result);
		}
	} catch (error) {
		// Log error but don't throw - DO update is secondary to D1 update
		console.error('[Polar->DO] Error calling API:', error);
	}
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

export const handleWebhook = {
	/**
	 * Handle one-time purchases (lifetime plans)
	 * This is triggered for orders, not subscriptions
	 */
	onOrderPaid: async (event: unknown) => {
		console.log('[Polar webhook] order.paid:', event);
		// TODO: Implement order paid webhook for lifetime plans
		// For lifetime plans, you might want to:
		// 1. Create a subscription record with status 'lifetime' or similar
		// 2. Or add a 'purchases' table for one-time purchases
	},

	/**
	 * Handle subscription created/updated/canceled
	 * This saves the subscription to the local D1 database and updates the Durable Object.
	 *
	 * Task 4.5: Modified to accept optional platform parameter for DO updates
	 */
	onSubscriptionUpdated: async (event: unknown, platform?: App.Platform) => {
		try {
			const webhookEvent = event as SubscriptionWebhookEvent;

			if (!webhookEvent || !webhookEvent.data) {
				console.error(
					'[webhook][subscription.updated] Received subscription update with missing data',
					event
				);
				return;
			}

			const subscriptionData = webhookEvent.data;
			const externalId = subscriptionData.customer?.externalId; // This is the user's ID
			const polarProductId = subscriptionData.product?.id;
			const polarSubscriptionId = subscriptionData.id;
			const polarCustomerId = subscriptionData.customer?.id;
			const status = subscriptionData.status;
			const currentPeriodStart = subscriptionData.currentPeriodStart;
			const currentPeriodEnd = subscriptionData.currentPeriodEnd;
			const trialEnds = subscriptionData.trialEnds;
			const cancelAtPeriodEnd = subscriptionData.cancelAtPeriodEnd;

			if (!status || !externalId || !polarProductId) {
				console.error('[webhook][subscription.updated] Missing required fields:', {
					status,
					externalId,
					polarProductId
				});
				return;
			}

			const db = getDb();

			// Find the product in our database to get the plan type
			const productRecord = await db
				.select()
				.from(product)
				.where(eq(product.polarProductId, polarProductId))
				.limit(1);

			const productData = productRecord[0];

			if (!productData) {
				console.warn(
					'[webhook][subscription.updated] Product not found in DB, creating subscription without product reference',
					polarProductId
				);
			}

			// Map the product plan to usage plan type
			const usagePlan = mapPolarPlanToUsagePlan(productData?.plan);

			// ================================================================
			// UPDATE DURABLE OBJECT (Task 4.5)
			// This ensures real-time plan enforcement
			// ================================================================

			if (platform?.env) {
				const isActive = status === 'active' || status === 'trialing';
				const isCanceled = status === 'canceled' || status === 'incomplete_expired';

				if (isActive) {
					await updateUserUsageDO(platform.env, externalId, usagePlan, 'upgrade');
				} else if (isCanceled) {
					await updateUserUsageDO(platform.env, externalId, 'free', 'cancel');
				}
			} else {
				console.warn('[webhook][subscription.updated] Platform not available, DO not updated');
			}

			// ================================================================
			// UPDATE D1 DATABASE (existing logic)
			// ================================================================

			// Check if subscription already exists
			const existingSubscription = await db
				.select()
				.from(subscription)
				.where(
					and(
						eq(subscription.userId, externalId),
						eq(subscription.polarSubscriptionId, polarSubscriptionId)
					)
				)
				.limit(1);

			const now = new Date();

			if (existingSubscription.length > 0) {
				// Update existing subscription
				await db
					.update(subscription)
					.set({
						productId: productData?.id || null,
						polarProductId,
						polarCustomerId,
						status,
						plan: productData?.plan || null,
						currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : null,
						currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
						trialEnds: trialEnds ? new Date(trialEnds) : null,
						cancelAtPeriodEnd: cancelAtPeriodEnd || false,
						updatedAt: now
					})
					.where(eq(subscription.id, existingSubscription[0].id));

				console.log(
					'[webhook][subscription.updated] Updated subscription:',
					existingSubscription[0].id
				);
			} else {
				// Create new subscription
				const newSubscription = {
					id: crypto.randomUUID(),
					userId: externalId,
					productId: productData?.id || null,
					polarSubscriptionId,
					polarProductId,
					polarCustomerId,
					status,
					plan: productData?.plan || null,
					currentPeriodStart: currentPeriodStart ? new Date(currentPeriodStart) : null,
					currentPeriodEnd: currentPeriodEnd ? new Date(currentPeriodEnd) : null,
					trialEnds: trialEnds ? new Date(trialEnds) : null,
					cancelAtPeriodEnd: cancelAtPeriodEnd || false,
					createdAt: now,
					updatedAt: now
				};

				await db.insert(subscription).values(newSubscription);

				console.log('[webhook][subscription.updated] Created subscription:', newSubscription.id);
			}
		} catch (error) {
			console.error('[webhook][subscription.updated] Error updating subscription:', error);
		}
	},

	/**
	 * Handle product updates from Polar
	 * This syncs product changes to the local database
	 */
	onProductUpdated: async (event: unknown) => {
		try {
			const webhookEvent = event as ProductWebhookEvent;

			console.log(
				'[Polar webhook][product.updated] Received product update:',
				webhookEvent.data?.id
			);

			if (!webhookEvent?.data?.id) {
				console.error('[Polar webhook][product.updated] Missing product ID');
				return;
			}

			const db = getDb();

			// Find existing product
			const existingProduct = await db
				.select()
				.from(product)
				.where(eq(product.polarProductId, webhookEvent.data.id))
				.limit(1);

			if (existingProduct.length > 0) {
				// Map the Polar product data
				const mappedProduct = helpers.mapPolarProduct(webhookEvent.data);

				if (!mappedProduct) {
					console.error('[Polar webhook][product.updated] Failed to map product');
					return;
				}

				// Update existing product
				await db
					.update(product)
					.set({
						name: mappedProduct.name,
						description: mappedProduct.description,
						plan: mappedProduct.plan,
						prices: JSON.stringify(mappedProduct.prices),
						active: mappedProduct.active,
						updatedAt: new Date()
					})
					.where(eq(product.id, existingProduct[0].id));

				console.log('[Polar webhook][product.updated] Updated product:', existingProduct[0].id);
			} else {
				console.warn(
					'[Polar webhook][product.updated] Product not found in DB. Import from admin panel first.',
					webhookEvent.data.id
				);
			}
		} catch (error) {
			console.error('[Polar webhook][product.updated] Error updating product:', error);
		}
	}
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Helper functions for mapping Polar data
export const helpers = {
	mapPolarProduct: (polarProd: PolarProduct): MappedProduct | null => {
		if (!polarProd) {
			console.error('[Polar][mapPolarProduct] Provided product is undefined');
			return null;
		}

		if (!polarProd.prices || !Array.isArray(polarProd.prices) || polarProd.prices.length === 0) {
			console.error('[Polar][mapPolarProduct] Provided product has no prices', polarProd);
			return null;
		}

		const mappedPrices: MappedPrice[] = [];

		for (const price of polarProd.prices) {
			if (price.isArchived) continue;

			mappedPrices.push({
				amountType: price.amountType,
				interval: price.type === 'recurring' ? (price.recurringInterval ?? null) : price.type,
				name: price.meter?.name,
				amount: price.priceAmount || price.unitAmount || 0
			});
		}

		return {
			name: polarProd.name,
			description: polarProd.description,
			plan: polarProd.metadata?.plan,
			productId: polarProd.id,
			active: !polarProd.isArchived,
			prices: mappedPrices
		};
	}
};
