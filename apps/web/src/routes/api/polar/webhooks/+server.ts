import { Webhooks } from '@polar-sh/sveltekit';
import { env } from '$env/dynamic/private';
import { handleWebhook } from '$lib/server/utils/polar';

/**
 * POST /api/polar/webhooks
 *
 * Handles incoming Polar webhook events.
 * Configure this URL in your Polar dashboard webhook settings.
 *
 * Events handled:
 * - subscription.created/updated/canceled - Updates local subscription records
 * - order.paid - Handles one-time purchases
 * - product.updated - Syncs product changes
 */
export const POST = Webhooks({
	webhookSecret: env.POLAR_WEBHOOK_SECRET || '',

	onSubscriptionCreated: async (payload) => {
		console.log('[Polar Webhook] subscription.created:', payload.data.id);
		await handleWebhook.onSubscriptionUpdated(payload);
	},

	onSubscriptionUpdated: async (payload) => {
		console.log('[Polar Webhook] subscription.updated:', payload.data.id);
		await handleWebhook.onSubscriptionUpdated(payload);
	},

	onSubscriptionCanceled: async (payload) => {
		console.log('[Polar Webhook] subscription.canceled:', payload.data.id);
		await handleWebhook.onSubscriptionUpdated(payload);
	},

	onOrderPaid: async (payload) => {
		console.log('[Polar Webhook] order.paid:', payload.data.id);
		await handleWebhook.onOrderPaid(payload);
	},

	onProductUpdated: async (payload) => {
		console.log('[Polar Webhook] product.updated:', payload.data.id);
		await handleWebhook.onProductUpdated(payload);
	}
});
