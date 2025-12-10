import { json } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';
import { getDb } from '$lib/server/database/db';
import { subscription, user } from '$lib/server/database/schema';

export async function GET({ url }) {
    const userId = url.searchParams.get('userId');

    try {
        const db = getDb();

        // Query subscriptions with optional user filter
        let query = db.select({
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
            query = query.where(eq(subscription.userId, userId));
        }

        const results = await query;

        // Format the results to match expected structure
        const subscriptions = results.map(row => ({
            ...row.subscription,
            user: row.user
        }));

        console.log(`[Admin Subscriptions GET] Fetching subscriptions${userId ? ` for user ${userId}` : ''}: found ${subscriptions.length}`);

        return json({ subscriptions }, { status: 200 });
    } catch (error) {
        console.error('Error fetching subscriptions:', error);
        return json({ message: 'Failed to fetch subscriptions' }, { status: 500 });
    }
}
