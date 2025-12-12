import { CustomerPortal } from '@polar-sh/sveltekit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { getPolarClient } from '$lib/server/utils/polar';

/**
 * GET /api/polar/portal
 *
 * Redirects authenticated users to their Polar customer portal.
 * Users can manage their subscriptions, update payment methods, etc.
 */
export const GET = CustomerPortal({
	accessToken: env.POLAR_ACCESS_TOKEN || '',
	server: dev ? 'sandbox' : 'production',
	returnUrl: '/settings/billing',
	// Get customer by email from the session
	getExternalCustomerId: async (event) => {
		const user = event.locals.user;
		if (!user?.email) {
			throw new Error('User not authenticated');
		}

		// Find the customer in Polar by email
		const polar = getPolarClient();
		const customersResponse = await polar.customers.list({
			email: user.email
		});

		const customer = customersResponse.result.items[0];
		if (!customer) {
			throw new Error('No Polar customer found for this user');
		}

		// Return the external ID (which should be the user ID)
		// If not set, we fall back to using the customer ID
		return customer.externalId || customer.id;
	}
});
