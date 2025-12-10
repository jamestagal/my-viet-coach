import { dev } from '$app/environment';
import { Polar } from '@polar-sh/sdk';
import { POLAR_ACCESS_TOKEN } from '$env/static/private';

export const polarClient = new Polar({
	accessToken: POLAR_ACCESS_TOKEN,
	server: dev ? 'sandbox' : 'production'
});

// Webhook handlers - stub implementations for now
// TODO: Implement proper database models for subscriptions and products
export const handleWebhook = {
	onOrderPaid: async (event: unknown) => {
		console.log('[Polar webhook] order.paid:', event);
		// TODO: Handle one-time purchases (e.g., lifetime plans)
	},
	onSubscriptionUpdated: async (event: unknown) => {
		console.log('[Polar webhook] subscription.updated:', event);
		// TODO: Update subscription in database when models are created
	},
	onProductUpdated: async (event: unknown) => {
		console.log('[Polar webhook] product.updated:', event);
		// TODO: Sync product updates to database when models are created
	}
};

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
