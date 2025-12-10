import { POLAR_ORGANIZATION_ID } from '$env/static/private';
import { polarClient, helpers } from '$lib/server/utils/polar';
import { json } from '@sveltejs/kit';
import { dev } from '$app/environment';

export async function GET() {
    try {
        let products = [];

        const polarResponse = await polarClient.products.list({
            organizationId: [POLAR_ORGANIZATION_ID],
            isArchived: false
        });

        if (Array.isArray(polarResponse.result?.items)) {
            // Map the raw unlisted Polar products
            products = polarResponse.result.items
                .map(helpers.mapPolarProduct)
                .filter(Boolean); // Remove any null values from failed mappings
        } else {
            console.warn('No products found in Polar response or unexpected structure:', polarResponse);
        }

        return json(products, { status: 200 });
    } catch (error) {
        console.log('[ERROR] [Polar Product Fetch]');
        if (error.error === 'invalid_token') {
            console.error(`Please provide a valid ${dev ? '[sandbox]' : '[production]'} Polar API token`);
        } else {
            console.error('Error fetching products:', error);
        }
        return json({ message: 'Failed to fetch products' }, { status: 500 });
    }
}

