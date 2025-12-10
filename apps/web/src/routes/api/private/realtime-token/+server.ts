import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';

/**
 * POST /api/private/realtime-token
 *
 * Creates an ephemeral token for OpenAI Realtime API.
 * The token is valid for 1 minute and allows the client to connect directly.
 *
 * Protected by hooks.server.ts - only authenticated users can access.
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	// Auth is enforced in hooks.server.ts for /api/private/* routes
	// locals.user is guaranteed to be set

	if (!OPENAI_API_KEY) {
		throw error(500, 'OpenAI API key not configured');
	}

	try {
		const body = await request.json().catch(() => ({}));
		const model = body.model || 'gpt-4o-realtime-preview';

		// Request ephemeral token from OpenAI
		const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${OPENAI_API_KEY}`,
				'Content-Type': 'application/json'
			},
			body: JSON.stringify({
				model,
				voice: 'coral'
			})
		});

		if (!response.ok) {
			const errorData = await response.json().catch(() => ({}));
			console.error('OpenAI token error:', errorData);
			throw error(response.status, errorData.error?.message || 'Failed to create session');
		}

		const data = await response.json();

		// Return the ephemeral token
		return json({
			token: data.client_secret?.value || data.client_secret,
			expires_at: data.expires_at
		});
	} catch (err) {
		console.error('Realtime token error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Failed to create realtime session');
	}
};
