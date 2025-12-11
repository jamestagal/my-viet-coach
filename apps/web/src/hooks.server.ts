import { svelteKitHandler } from 'better-auth/svelte-kit';
import { initDb, initLocalDb, getDb } from '$lib/server/database/db';
import { getAuth } from '$lib/server/auth';
import { dev } from '$app/environment';
import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { subscription } from '$lib/server/database/schema';
import { eq, and, or } from 'drizzle-orm';

export const handle: Handle = async ({ event, resolve }) => {
	// Initialize database FIRST (before auth)
	if (dev) {
		await initLocalDb();
	} else {
		// Production: Get D1 binding from platform.env
		const platform = event.platform;
		const env = platform?.env;
		const d1 = env?.DB;

		console.log('[Hooks] Platform check:', {
			hasPlatform: !!platform,
			hasEnv: !!env,
			hasDB: !!d1,
			envKeys: env ? Object.keys(env) : [],
			platformKeys: platform ? Object.keys(platform) : []
		});

		if (d1) {
			initDb(d1);
		} else {
			console.error('[Hooks] D1 database binding not found!');
			// Return 500 with clear error rather than crashing
			return new Response(JSON.stringify({
				error: 'Database connection unavailable',
				debug: {
					hasPlatform: !!platform,
					hasEnv: !!env,
					hasDB: !!d1,
					envKeys: env ? Object.keys(env) : [],
					platformKeys: platform ? Object.keys(platform) : []
				}
			}), {
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			});
		}
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

				// Load user's active subscription
				try {
					const db = getDb();
					const userSubscription = await db
						.select()
						.from(subscription)
						.where(
							and(
								eq(subscription.userId, fetchedSession.user.id),
								or(
									eq(subscription.status, 'active'),
									eq(subscription.status, 'trialing')
								)
							)
						)
						.limit(1);

					event.locals.subscription = userSubscription[0] || null;
				} catch (subError) {
					console.error('[Hooks] Error loading subscription:', subError);
					event.locals.subscription = null;
				}
			} else {
				event.locals.user = null;
				event.locals.session = null;
				event.locals.subscription = null;
			}
		} catch (e) {
			console.error('[Hooks] getSession error:', e);
			event.locals.user = null;
			event.locals.session = null;
			event.locals.subscription = null;
		}
	} else {
		// For auth routes, just set null - auth will handle session internally
		event.locals.user = null;
		event.locals.session = null;
		event.locals.subscription = null;
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
