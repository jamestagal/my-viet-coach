import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { polarClient, helpers } from '$lib/server/utils/polar';
import { POLAR_ORGANIZATION_ID } from '$env/static/private';
import { dev } from '$app/environment';

/**
 * GET /api/private/admin/polar/products
 *
 * Returns all active products from Polar API.
 * Admin-only endpoint - requires admin role.
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	try {
		let products: ReturnType<typeof helpers.mapPolarProduct>[] = [];

		const polarResponse = await polarClient.products.list({
			organizationId: POLAR_ORGANIZATION_ID ? [POLAR_ORGANIZATION_ID] : undefined,
			isArchived: false
		});

		if (Array.isArray(polarResponse.result?.items)) {
			// Map the raw Polar products (cast to any to handle SDK type differences)
			products = polarResponse.result.items
				.map((item) => helpers.mapPolarProduct(item as Parameters<typeof helpers.mapPolarProduct>[0]))
				.filter((p): p is NonNullable<typeof p> => p !== null);
		} else {
			console.warn(
				'[Admin Polar Products] No products found in Polar response or unexpected structure:',
				polarResponse
			);
		}

		return json(products, { status: 200 });
	} catch (err) {
		console.log('[ERROR] [Admin Polar Products]');
		if (err && typeof err === 'object' && 'error' in err && err.error === 'invalid_token') {
			console.error(
				`Please provide a valid ${dev ? '[sandbox]' : '[production]'} Polar API token`
			);
		} else {
			console.error('Error fetching products:', err);
		}
		return json({ message: 'Failed to fetch products' }, { status: 500 });
	}
};
