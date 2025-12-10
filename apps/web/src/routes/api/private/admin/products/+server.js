import { json } from '@sveltejs/kit';
import { getDb } from '$lib/server/database/db';
import { product } from '$lib/server/database/schema';

export async function GET() {
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
    } catch (error) {
        console.error('API Error in GET /api/private/admin/products:', error);
        const message = error instanceof Error ? error.message : 'An unexpected error occurred';
        return json({ products: [], error: message }, { status: 500 });
    }
}

export async function POST({ request }) {
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

        console.log('[Product Import] Created product:', result);

        return json(result, { status: 201 });
    } catch (e) {
        console.error('[Product Import] Unexpected API Error processing POST request:', e);
        return json({ message: 'An unexpected server error occurred.', error: e.message }, { status: 500 });
    }
}
