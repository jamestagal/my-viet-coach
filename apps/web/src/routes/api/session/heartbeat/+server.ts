/**
 * Session Heartbeat Proxy
 *
 * Proxies POST /api/session/heartbeat to the API worker.
 * Adds authentication via Better Auth session.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, request, platform }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const apiUrl = platform?.env?.API_URL || 'https://viet-coach-api.benjaminwaller.workers.dev';

	try {
		const body = await request.text();

		const response = await fetch(`${apiUrl}/api/session/heartbeat`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-User-Id': userId
			},
			body
		});

		const data = await response.json();

		return json(data, { status: response.status });
	} catch (err) {
		console.error('[Session Heartbeat Proxy] Error:', err);
		throw error(502, 'Failed to send heartbeat');
	}
};
