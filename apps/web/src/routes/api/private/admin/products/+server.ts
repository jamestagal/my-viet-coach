import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { product } from '$lib/server/database/schema';

/**
 * GET /api/private/admin/products
 *
 * Returns all products from database with plans.
 * Admin-only endpoint - requires admin role.
 */
export const GET: RequestHandler = async ({ locals }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDb();
		const products = await db.select().from(product);

		// Default plans for filtering
		const plans = [
			{ name: 'None', value: null },
			{ name: 'Free', value: 'free' },
			{ name: 'Pro', value: 'pro' },
			{ name: 'Enterprise', value: 'enterprise' }
		];

		return json({ products, plans });
	} catch (err) {
		console.error('[Admin Products API] Error in GET:', err);
		const message = err instanceof Error ? err.message : 'An unexpected error occurred';
		return json({ products: [], error: message }, { status: 500 });
	}
};

/**
 * POST /api/private/admin/products
 *
 * Creates a new product in database (imports from Polar).
 * Admin-only endpoint - requires admin role.
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	try {
		const productData = await request.json();
		const db = getDb();
		const now = new Date();

		// Map incoming data to our schema
		const newProduct = {
			id: crypto.randomUUID(),
			polarProductId: productData.productId || productData.polarProductId || crypto.randomUUID(),
			name: productData.name,
			description: productData.description || null,
			plan: productData.plan || null,
			prices: productData.prices ? JSON.stringify(productData.prices) : null,
			features: productData.features ? JSON.stringify(productData.features) : null,
			active: productData.active !== false,
			showOnPricingPage: productData.showOnPricingPage || false,
			createdAt: now,
			updatedAt: now
		};

		const [result] = await db.insert(product).values(newProduct).returning();

		console.log('[Admin Products API] Created product:', result);

		return json(result, { status: 201 });
	} catch (err) {
		console.error('[Admin Products API] Error in POST:', err);
		const message = err instanceof Error ? err.message : 'An unexpected server error occurred';
		return json({ message, error: message }, { status: 500 });
	}
};
