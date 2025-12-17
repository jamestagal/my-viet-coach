/**
 * Session End Proxy
 *
 * Proxies POST /api/session/end to the API worker.
 * Adds authentication via Better Auth session.
 *
 * Extended to accept disconnect info, messages array, and corrections array
 * for session health tracking and learning history.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Message object for session transcript.
 */
interface SessionMessage {
	role: 'user' | 'coach';
	text: string;
	timestamp: number;
}

/**
 * Correction object from coach mode sessions.
 */
interface SessionCorrection {
	original: string;
	correction: string;
	explanation?: string;
	category?: 'grammar' | 'tone' | 'vocabulary' | 'word_order' | 'pronunciation';
}

/**
 * Request body interface for session end.
 * Includes extended parameters for health tracking and learning history.
 */
interface SessionEndBody {
	sessionId: string;
	/** WebSocket close code (1000, 1006, 1011, etc.) */
	disconnectCode?: number;
	/** Human-readable disconnect explanation */
	disconnectReason?: string;
	/** Total number of messages in the conversation */
	messageCount?: number;
	/** Final provider used ('gemini' or 'openai') */
	provider?: 'gemini' | 'openai';
	/** Whether provider was switched during the session */
	providerSwitched?: boolean;
	/** Conversation transcript messages */
	messages?: SessionMessage[];
	/** Learning corrections extracted from the session */
	corrections?: SessionCorrection[];
}

export const POST: RequestHandler = async ({ locals, request, platform }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const apiUrl = platform?.env?.API_URL || 'https://viet-coach-api.benjaminwaller.workers.dev';

	try {
		// Parse request body
		let body: SessionEndBody;
		try {
			body = await request.json();
		} catch {
			throw error(400, 'Invalid JSON body');
		}

		// Validate required sessionId
		if (!body.sessionId || typeof body.sessionId !== 'string') {
			throw error(400, 'sessionId is required');
		}

		// Validate provider enum if provided
		if (body.provider && !['gemini', 'openai'].includes(body.provider)) {
			throw error(400, 'Invalid provider. Must be "gemini" or "openai".');
		}

		// Validate messages array structure if provided
		if (body.messages) {
			if (!Array.isArray(body.messages)) {
				throw error(400, 'messages must be an array');
			}
			for (const msg of body.messages) {
				if (!msg.role || !['user', 'coach'].includes(msg.role)) {
					throw error(400, 'Each message must have a valid role ("user" or "coach")');
				}
				if (typeof msg.text !== 'string') {
					throw error(400, 'Each message must have a text string');
				}
				if (typeof msg.timestamp !== 'number') {
					throw error(400, 'Each message must have a numeric timestamp');
				}
			}
		}

		// Validate corrections array structure if provided
		if (body.corrections) {
			if (!Array.isArray(body.corrections)) {
				throw error(400, 'corrections must be an array');
			}
			const validCategories = ['grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation'];
			for (const corr of body.corrections) {
				if (typeof corr.original !== 'string') {
					throw error(400, 'Each correction must have an original string');
				}
				if (typeof corr.correction !== 'string') {
					throw error(400, 'Each correction must have a correction string');
				}
				if (corr.category && !validCategories.includes(corr.category)) {
					throw error(400, `Invalid correction category. Must be one of: ${validCategories.join(', ')}`);
				}
			}
		}

		// Forward the request to API worker with all extended parameters
		const response = await fetch(`${apiUrl}/api/session/end`, {
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
		console.error('[Session End Proxy] Error:', err);
		throw error(502, 'Failed to end session');
	}
};
