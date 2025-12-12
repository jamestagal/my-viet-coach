import { Checkout } from '@polar-sh/sveltekit';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';

/**
 * GET /api/polar/checkout
 *
 * Creates a Polar checkout session and redirects to the checkout page.
 * Pass productId as a query parameter: /api/polar/checkout?productId=xxx
 *
 * The @polar-sh/sveltekit Checkout handler:
 * - Creates a checkout session via Polar API
 * - Redirects user to Polar's hosted checkout page
 * - On success, redirects back to successUrl with checkout_id
 */
export const GET = Checkout({
	accessToken: env.POLAR_ACCESS_TOKEN,
	successUrl: '/settings/billing/success?checkout_id={CHECKOUT_ID}',
	server: dev ? 'sandbox' : 'production'
});
