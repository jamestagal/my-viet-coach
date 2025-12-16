/**
 * Better Auth catch-all route handler
 *
 * This route exists to ensure SvelteKit doesn't return a 404 for auth routes.
 * The hooks.server.ts initializes the database and env vars before this runs.
 */
import { getAuth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
	try {
		const auth = getAuth();
		return auth.handler(event.request);
	} catch (error) {
		console.error('[Auth Route GET] Error:', error);
		return new Response(JSON.stringify({ error: String(error) }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};

export const POST: RequestHandler = async (event) => {
	try {
		const auth = getAuth();
		console.log('[Auth Route POST] Handling:', event.url.pathname);
		const response = await auth.handler(event.request);
		console.log('[Auth Route POST] Response status:', response.status);
		return response;
	} catch (error) {
		console.error('[Auth Route POST] Error:', error);
		return new Response(JSON.stringify({ error: String(error) }), {
			status: 500,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
