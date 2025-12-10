import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/database/db';
import { product } from '$lib/server/database/schema';

export async function GET({ params }) {
    const { id } = params;

    try {
        const db = getDb();
        const [result] = await db.select().from(product).where(eq(product.id, id));

        if (!result) {
            return json({ message: 'Product not found' }, { status: 404 });
        }

        return json(result);
    } catch (error) {
        console.error(`Unexpected API Error in GET /api/private/admin/product/${id}:`, error);
        return json({ message: 'An unexpected error occurred', error: error.message }, { status: 500 });
    }
}

export async function PUT({ request, params }) {
    const { id } = params;

    try {
        const updates = await request.json();
        const db = getDb();
        const now = new Date();

        // Map incoming data to our schema, handling JSON fields
        const updateData = {
            ...updates,
            updatedAt: now
        };

        // Handle JSON fields if provided
        if (updates.prices !== undefined) {
            updateData.prices = typeof updates.prices === 'string'
                ? updates.prices
                : JSON.stringify(updates.prices);
        }
        if (updates.features !== undefined) {
            updateData.features = typeof updates.features === 'string'
                ? updates.features
                : JSON.stringify(updates.features);
        }

        // Remove fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.createdAt;

        const [updatedProduct] = await db.update(product)
            .set(updateData)
            .where(eq(product.id, id))
            .returning();

        if (!updatedProduct) {
            return json({ message: 'Product not found' }, { status: 404 });
        }

        console.log(`[Admin Product PUT] Updated product ${id}:`, updatedProduct);

        return json(updatedProduct);
    } catch (error) {
        console.error(`[Admin Product] Unexpected error in PUT:`, error);
        return json({ message: 'Server error occurred' }, { status: 500 });
    }
}

export async function DELETE({ params }) {
    const { id } = params;

    try {
        const db = getDb();

        const [deleted] = await db.delete(product)
            .where(eq(product.id, id))
            .returning();

        if (!deleted) {
            return json({ message: 'Product not found' }, { status: 404 });
        }

        console.log(`[Admin Product DELETE] Deleted product ${id}`);

        return json({ message: 'Product deleted successfully' }, { status: 200 });
    } catch (error) {
        console.error(`Unexpected API Error in DELETE /api/private/admin/product/${id}:`, error);
        return json({ message: 'An unexpected error occurred', error: error.message }, { status: 500 });
    }
}
