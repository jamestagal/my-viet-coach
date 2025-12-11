import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/database/db';
import { product } from '$lib/server/database/schema';

/**
 * GET /api/private/admin/products/[id]
 *
 * Returns a single product by ID.
 * Admin-only endpoint - requires admin role.
 */
export const GET: RequestHandler = async ({ params, locals }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	const { id } = params;

	try {
		const db = getDb();
		const [result] = await db.select().from(product).where(eq(product.id, id));

		if (!result) {
			throw error(404, 'Product not found');
		}

		return json(result);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error(`[Admin Products API] Error in GET ${id}:`, err);
		const message = err instanceof Error ? err.message : 'An unexpected error occurred';
		return json({ message }, { status: 500 });
	}
};

/**
 * PUT /api/private/admin/products/[id]
 *
 * Updates a product by ID.
 * Admin-only endpoint - requires admin role.
 */
export const PUT: RequestHandler = async ({ request, params, locals }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	const { id } = params;

	try {
		const updates = await request.json();
		const db = getDb();
		const now = new Date();

		// Map incoming data to our schema, handling JSON fields
		const updateData: Record<string, unknown> = {
			...updates,
			updatedAt: now
		};

		// Handle JSON fields if provided
		if (updates.prices !== undefined) {
			updateData.prices =
				typeof updates.prices === 'string' ? updates.prices : JSON.stringify(updates.prices);
		}
		if (updates.features !== undefined) {
			updateData.features =
				typeof updates.features === 'string' ? updates.features : JSON.stringify(updates.features);
		}

		// Remove fields that shouldn't be updated directly
		delete updateData.id;
		delete updateData.createdAt;

		const [updatedProduct] = await db
			.update(product)
			.set(updateData)
			.where(eq(product.id, id))
			.returning();

		if (!updatedProduct) {
			throw error(404, 'Product not found');
		}

		console.log(`[Admin Products API] Updated product ${id}:`, updatedProduct);

		return json(updatedProduct);
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('[Admin Products API] Error in PUT:', err);
		return json({ message: 'Server error occurred' }, { status: 500 });
	}
};

/**
 * DELETE /api/private/admin/products/[id]
 *
 * Deletes a product by ID.
 * Admin-only endpoint - requires admin role.
 */
export const DELETE: RequestHandler = async ({ params, locals }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	const { id } = params;

	try {
		const db = getDb();

		const [deleted] = await db.delete(product).where(eq(product.id, id)).returning();

		if (!deleted) {
			throw error(404, 'Product not found');
		}

		console.log(`[Admin Products API] Deleted product ${id}`);

		return json({ message: 'Product deleted successfully' }, { status: 200 });
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error(`[Admin Products API] Error in DELETE ${id}:`, err);
		const message = err instanceof Error ? err.message : 'An unexpected error occurred';
		return json({ message }, { status: 500 });
	}
};
