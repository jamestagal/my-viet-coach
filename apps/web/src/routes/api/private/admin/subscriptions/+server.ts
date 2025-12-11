import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/database/db';
import { subscription, user } from '$lib/server/database/schema';

/**
 * GET /api/private/admin/subscriptions
 *
 * Returns subscriptions from local database with optional user filter.
 * Admin-only endpoint - requires admin role.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	const userId = url.searchParams.get('userId');

	try {
		const db = getDb();

		// Query subscriptions with optional user filter
		let query = db
			.select({
				subscription: subscription,
				user: {
					id: user.id,
					name: user.name,
					email: user.email
				}
			})
			.from(subscription)
			.leftJoin(user, eq(subscription.userId, user.id));

		if (userId) {
			query = query.where(eq(subscription.userId, userId)) as typeof query;
		}

		const results = await query;

		// Format the results to match expected structure
		const subscriptions = results.map((row) => ({
			...row.subscription,
			user: row.user
		}));

		console.log(
			`[Admin Subscriptions GET] Fetching subscriptions${userId ? ` for user ${userId}` : ''}: found ${subscriptions.length}`
		);

		return json({ subscriptions }, { status: 200 });
	} catch (err) {
		console.error('[Admin Subscriptions API] Error fetching subscriptions:', err);
		return json({ message: 'Failed to fetch subscriptions' }, { status: 500 });
	}
};
