import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY, GOOGLE_API_KEY } from '$env/static/private';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UsageStatus {
	plan: string;
	minutesUsed: number;
	minutesRemaining: number;
	minutesLimit: number;
	hasActiveSession: boolean;
	activeSessionMinutes: number;
	percentUsed: number;
}

interface StatusApiResponse {
	success: boolean;
	data?: UsageStatus;
	error?: string;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Verify user has an active session and remaining credits by calling the API worker.
 * Returns the usage status if valid, or throws an error if not.
 *
 * Task 4.8: Session verification before token generation
 */
async function verifySessionAndCredits(
	userId: string,
	platform: App.Platform | undefined
): Promise<UsageStatus> {
	// Get API URL from env or use production default
	const apiUrl = platform?.env?.API_URL || 'https://viet-coach-api.benjaminwaller.workers.dev';

	try {
		const response = await fetch(`${apiUrl}/api/session/status`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-User-Id': userId
			}
		});

		if (!response.ok) {
			console.error('[Realtime Token] Session status check failed:', response.status);
			throw error(502, 'Failed to verify session status');
		}

		const result = (await response.json()) as StatusApiResponse;

		if (!result.success || !result.data) {
			throw error(500, 'Invalid session status response');
		}

		return result.data;
	} catch (err) {
		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}
		console.error('[Realtime Token] Error checking session status:', err);
		throw error(502, 'Failed to verify session status');
	}
}

// ============================================================================
// ENDPOINT HANDLER
// ============================================================================

/**
 * POST /api/private/realtime-token
 *
 * Creates an ephemeral token for voice APIs (Gemini or OpenAI).
 * Protected by hooks.server.ts - only authenticated users can access.
 *
 * Task 4.8: Updated to verify active session and credits before generating token
 *
 * Request body:
 * - provider: 'gemini' | 'openai' (default: 'gemini')
 * - model: string (optional, for OpenAI)
 * - skipSessionCheck: boolean (optional, for backwards compatibility during migration)
 *
 * Response:
 * - token: string
 * - provider: 'gemini' | 'openai'
 * - expiresIn: number (seconds)
 * - minutesRemaining: number (Task 4.8)
 */
export const POST: RequestHandler = async ({ locals, request, platform }) => {
	// Auth is enforced in hooks.server.ts for /api/private/* routes
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		const body = await request.json().catch(() => ({}));
		const provider = body.provider || 'gemini';
		const skipSessionCheck = body.skipSessionCheck === true;

		// ================================================================
		// SESSION AND CREDIT VERIFICATION (Task 4.8)
		// ================================================================

		let minutesRemaining = 0;

		if (!skipSessionCheck) {
			const status = await verifySessionAndCredits(userId, platform);

			// Check if user has an active session
			if (!status.hasActiveSession) {
				throw error(403, 'No active session. Call /api/session/start first.');
			}

			// Check if user has remaining credits
			if (status.minutesRemaining <= 0) {
				throw error(403, 'No credits remaining. Please upgrade your plan.');
			}

			minutesRemaining = status.minutesRemaining;
		} else {
			// Backwards compatibility: skip check but set a default
			minutesRemaining = -1; // Indicates check was skipped
			console.warn('[Realtime Token] Session check skipped for user:', userId);
		}

		// ================================================================
		// TOKEN GENERATION
		// ================================================================

		if (provider === 'gemini') {
			// Gemini Live API
			if (!GOOGLE_API_KEY) {
				throw error(500, 'Google API key not configured');
			}

			return json({
				token: GOOGLE_API_KEY,
				provider: 'gemini',
				expiresIn: 900, // 15 minutes (Gemini session limit)
				minutesRemaining
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
				minutesRemaining
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
