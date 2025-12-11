import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { polarClient } from '$lib/server/utils/polar';
import { POLAR_ORGANIZATION_ID } from '$env/static/private';

/**
 * GET /api/private/admin/polar/subscriptions
 *
 * Returns active subscriptions from Polar API with pagination.
 * Admin-only endpoint - requires admin role.
 */
export const GET: RequestHandler = async ({ locals, url }) => {
	// Admin check
	if (locals.user?.role !== 'admin') {
		throw error(401, 'Unauthorized');
	}

	try {
		const limit = parseInt(url.searchParams.get('limit') || '10', 10);
		const page = parseInt(url.searchParams.get('page') || '1', 10);

		const getSubscriptions = await polarClient.subscriptions.list({
			organizationId: POLAR_ORGANIZATION_ID ? [POLAR_ORGANIZATION_ID] : undefined,
			active: true,
			limit: limit,
			page: page
		});

		if (!getSubscriptions.result?.items) {
			console.error('[Admin Polar Subscriptions] No subscriptions found');
			return json({ subscriptions: [], pagination: { totalCount: 0 } }, { status: 200 });
		}

		const subscriptions = getSubscriptions.result.items;
		const pagination = getSubscriptions.result.pagination;

		return json({ subscriptions, pagination }, { status: 200 });
	} catch (err) {
		console.error('[Admin Polar Subscriptions API] Error fetching subscriptions:', err);
		return json({ message: 'Failed to fetch subscriptions' }, { status: 500 });
	}
};
