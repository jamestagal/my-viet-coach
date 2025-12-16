import { Webhooks } from '@polar-sh/sveltekit';
import { env } from '$env/dynamic/private';
import { handleWebhook } from '$lib/server/utils/polar';
import type { RequestEvent } from '@sveltejs/kit';

/**
 * POST /api/polar/webhooks
 *
 * Handles incoming Polar webhook events.
 * Configure this URL in your Polar dashboard webhook settings.
 *
 * Events handled:
 * - subscription.created/updated/canceled - Updates local subscription records and Durable Object
 * - order.paid - Handles one-time purchases
 * - product.updated - Syncs product changes
 *
 * Task 4.6: Updated to pass platform context to webhook handlers for DO updates
 */
export const POST = async (event: RequestEvent) => {
	// Capture platform for DO access in webhook handlers
	const platform = event.platform;

	const webhookHandler = Webhooks({
		webhookSecret: env.POLAR_WEBHOOK_SECRET || '',

		onSubscriptionCreated: async (payload) => {
			console.log('[Polar Webhook] subscription.created:', payload.data.id);
			await handleWebhook.onSubscriptionUpdated(payload, platform);
		},

		onSubscriptionUpdated: async (payload) => {
			console.log('[Polar Webhook] subscription.updated:', payload.data.id);
			await handleWebhook.onSubscriptionUpdated(payload, platform);
		},

		onSubscriptionCanceled: async (payload) => {
			console.log('[Polar Webhook] subscription.canceled:', payload.data.id);
			await handleWebhook.onSubscriptionUpdated(payload, platform);
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

	return webhookHandler(event);
};
