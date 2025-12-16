/**
 * Session Status Proxy
 *
 * Proxies GET /api/session/status to the API worker.
 * Adds authentication via Better Auth session.
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, platform }) => {
	const userId = locals.user?.id;

	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const apiUrl = platform?.env?.API_URL || 'https://viet-coach-api.benjaminwaller.workers.dev';

	try {
		const response = await fetch(`${apiUrl}/api/session/status`, {
			method: 'GET',
			headers: {
				'Content-Type': 'application/json',
				'X-User-Id': userId
			}
		});

		const data = await response.json();

		return json(data, { status: response.status });
	} catch (err) {
		console.error('[Session Status Proxy] Error:', err);
		throw error(502, 'Failed to fetch session status');
	}
};
