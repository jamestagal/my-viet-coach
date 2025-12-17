/**
 * Session Start Proxy
 *
 * Proxies POST /api/session/start to the API worker.
 * Adds authentication via Better Auth session.
 *
 * Extended to accept mode and provider parameters for session health tracking.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Request body interface for session start.
 * Includes extended parameters for health tracking.
 */
interface SessionStartBody {
	topic?: string;
	difficulty?: 'beginner' | 'intermediate' | 'advanced';
	/** Practice mode: 'free' for free conversation, 'coach' for correction mode */
	mode?: 'free' | 'coach';
	/** Voice AI provider: 'gemini' or 'openai' */
	provider?: 'gemini' | 'openai';
}

export const POST: RequestHandler = async ({ locals, request, platform }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const apiUrl = platform?.env?.API_URL || 'https://viet-coach-api.benjaminwaller.workers.dev';

	try {
		// Parse and validate request body
		let body: SessionStartBody = {};
		const text = await request.text();
		if (text) {
			try {
				body = JSON.parse(text);
			} catch {
				// Invalid JSON - use defaults
			}
		}

		// Validate mode enum if provided
		if (body.mode && !['free', 'coach'].includes(body.mode)) {
			throw error(400, 'Invalid mode. Must be "free" or "coach".');
		}

		// Validate provider enum if provided
		if (body.provider && !['gemini', 'openai'].includes(body.provider)) {
			throw error(400, 'Invalid provider. Must be "gemini" or "openai".');
		}

		// Forward the request to API worker with extended parameters
		const response = await fetch(`${apiUrl}/api/session/start`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-User-Id': userId
			},
			body: JSON.stringify(body)
		});

		const data = await response.json();

		return json(data, { status: response.status });
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[Session Start Proxy] Error:', err);
		throw error(502, 'Failed to start session');
	}
};
