import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY, GOOGLE_API_KEY } from '$env/static/private';

/**
 * POST /api/private/realtime-token
 *
 * Creates an ephemeral token for voice APIs (Gemini or OpenAI).
 * Protected by hooks.server.ts - only authenticated users can access.
 * 
 * Request body:
 * - provider: 'gemini' | 'openai' (default: 'gemini')
 * - model: string (optional, for OpenAI)
 * 
 * Response:
 * - token: string
 * - provider: 'gemini' | 'openai'
 * - expiresIn: number (seconds)
 */
export const POST: RequestHandler = async ({ locals, request }) => {
	// Auth is enforced in hooks.server.ts for /api/private/* routes

	try {
		const body = await request.json().catch(() => ({}));
		const provider = body.provider || 'gemini';

		if (provider === 'gemini') {
			// Gemini Live API
			if (!GOOGLE_API_KEY) {
				throw error(500, 'Google API key not configured');
			}

			return json({
				token: GOOGLE_API_KEY,
				provider: 'gemini',
				expiresIn: 900, // 15 minutes (Gemini session limit)
			});
		} else if (provider === 'openai') {
			// OpenAI Realtime API
			if (!OPENAI_API_KEY) {
				throw error(500, 'OpenAI API key not configured');
			}

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

			return json({
				token: data.client_secret?.value || data.client_secret,
				provider: 'openai',
				expiresIn: 60, // 1 minute
			});
		} else {
			throw error(400, 'Invalid provider. Must be "gemini" or "openai"');
		}
	} catch (err) {
		console.error('Realtime token error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Failed to create realtime session');
	}
};
