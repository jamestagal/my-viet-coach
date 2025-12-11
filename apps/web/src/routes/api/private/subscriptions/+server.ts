import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { polarClient, helpers } from '$lib/server/utils/polar';

/**
 * GET /api/private/subscriptions
 *
 * Returns the authenticated user's active subscriptions.
 * Protected by hooks.server.ts - only authenticated users can access.
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Auth is enforced in hooks.server.ts for /api/private/* routes
	const user = locals.user;

	if (!user?.email) {
		throw error(401, 'Unauthorized');
	}

	try {
		// Find the customer by email in Polar
		const customersResponse = await polarClient.customers.list({
			email: user.email
		});

		const customer = customersResponse.result.items[0];

		if (!customer) {
			// No customer record - return empty subscriptions
			return json([]);
		}

		// Get subscriptions for this customer
		const subscriptionsResponse = await polarClient.subscriptions.list({
			customerId: customer.id,
			active: true
		});

		// Map subscriptions to the expected format with product details
		const subscriptions = await Promise.all(
			subscriptionsResponse.result.items.map(async (sub) => {
				// Fetch the product details
				let productDetails = null;
				if (sub.productId) {
					try {
						const product = await polarClient.products.get({ id: sub.productId });
						productDetails = helpers.mapPolarProduct(product);
					} catch (e) {
						console.error('[Subscriptions API] Error fetching product:', e);
					}
				}

				return {
					_id: sub.id,
					polarSubscriptionId: sub.id,
					polarCustomerId: customer.id,
					status: sub.status,
					productId: productDetails,
					currentPeriodStart: sub.currentPeriodStart,
					currentPeriodEnd: sub.currentPeriodEnd,
					cancelAtPeriodEnd: sub.cancelAtPeriodEnd
				};
			})
		);

		return json(subscriptions);
	} catch (err) {
		console.error('[Subscriptions API] Error fetching subscriptions:', err);
		throw error(500, 'Failed to fetch subscriptions');
	}
};
