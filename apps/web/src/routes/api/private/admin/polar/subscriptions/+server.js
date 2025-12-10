import { json } from '@sveltejs/kit';
import { polarClient } from '$lib/server/utils/polar';
import { POLAR_ORGANIZATION_ID } from '$env/static/private';

export async function GET({ url }) {
    try {
        const limit = parseInt(url.searchParams.get('limit') || '10');
        const page = parseInt(url.searchParams.get('page') || '1');

        const getSubscriptions = await polarClient.subscriptions.list({
            organizationId: [POLAR_ORGANIZATION_ID],
            active: true,
            limit: limit,
            page: page
          });

        if(!getSubscriptions.result?.items) {
            console.error('No subscriptions found');
            return json({ subscriptions: [] }, { status: 200 });
        }

        const subscriptions = getSubscriptions.result.items;
        const pagination = getSubscriptions.result.pagination;

        // console.log(subscriptions)
        return json({ subscriptions, pagination }, { status: 200 });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return json({ message: 'Failed to fetch subscriptions' }, { status: 500 });
    }
}

