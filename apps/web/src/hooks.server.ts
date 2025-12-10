import { svelteKitHandler } from 'better-auth/svelte-kit';
import { initDb, initLocalDb } from '$lib/server/database/db';
import { getAuth } from '$lib/server/auth';
import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
	// Initialize database FIRST (before auth)
	if (dev) {
		await initLocalDb();
	} else if (event.platform?.env?.DB) {
		initDb(event.platform.env.DB);
	}

	// Get auth instance (lazily initialized after database)
	const auth = getAuth();

	// Set client IP for rate limiting (Cloudflare forwards real IP in cf-connecting-ip)
	try {
		const clientIp = event.getClientAddress();
		if (clientIp) {
			event.request.headers.set('x-client-ip', clientIp);
		}
	} catch {
		// getClientAddress() may not be available in dev mode
	}

	// Fetch session via Better-Auth (skip for auth routes - they handle their own sessions)
	if (!event.url.pathname.startsWith('/api/auth')) {
		try {
			const fetchedSession = await auth.api.getSession({
				headers: event.request.headers
			});

			if (fetchedSession) {
				event.locals.user = fetchedSession.user;
				event.locals.session = fetchedSession.session;
			} else {
				event.locals.user = null;
				event.locals.session = null;
			}
		} catch (e) {
			console.error('[Hooks] getSession error:', e);
			event.locals.user = null;
			event.locals.session = null;
		}
	} else {
		// For auth routes, just set null - auth will handle session internally
		event.locals.user = null;
		event.locals.session = null;
	}

	// Private route protection - requires authentication
	if (event.url.pathname.startsWith('/api/private')) {
		if (!event.locals?.user || !event.locals?.session) {
			return json({ message: 'Unauthorized' }, { status: 401 });
		}
	}

	// Admin route protection - requires admin role
	if (event.url.pathname.startsWith('/api/private/admin')) {
		if (event.locals?.user?.role !== 'admin') {
			return json({ message: 'Unauthorized' }, { status: 401 });
		}
	}

	// Better-Auth handler for /api/auth/* routes
	return svelteKitHandler({ event, resolve, auth });
};
