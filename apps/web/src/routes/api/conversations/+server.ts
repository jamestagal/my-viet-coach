/**
 * GET /api/conversations
 *
 * Returns a paginated list of the authenticated user's voice conversation sessions.
 * Includes session metadata and aggregated correction counts.
 *
 * Query Parameters:
 * - page: number (default: 1)
 * - limit: number (default: 10, max: 50)
 *
 * Response:
 * - sessions: Array of session objects with correctionCount
 * - pagination: { page, limit, total }
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { usageSessions, sessionCorrections } from '$lib/server/database/schema';
import { eq, desc, sql, count } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals, url }) => {
	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDb();

		// Parse pagination parameters
		const pageParam = url.searchParams.get('page');
		const limitParam = url.searchParams.get('limit');

		const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
		const limit = Math.min(50, Math.max(1, parseInt(limitParam || '10', 10) || 10));
		const offset = (page - 1) * limit;

		// Get total count for pagination
		const totalResult = await db
			.select({ count: count() })
			.from(usageSessions)
			.where(eq(usageSessions.userId, userId));

		const total = totalResult[0]?.count ?? 0;

		// Get sessions with aggregated correction counts
		// Using a subquery to count corrections per session
		const sessionsWithCorrections = await db
			.select({
				id: usageSessions.id,
				startedAt: usageSessions.startedAt,
				endedAt: usageSessions.endedAt,
				topic: usageSessions.topic,
				difficulty: usageSessions.difficulty,
				mode: usageSessions.mode,
				provider: usageSessions.provider,
				messageCount: usageSessions.messageCount,
				correctionCount: sql<number>`(
					SELECT COUNT(*) FROM session_corrections
					WHERE session_corrections.session_id = ${usageSessions.id}
				)`.as('correctionCount')
			})
			.from(usageSessions)
			.where(eq(usageSessions.userId, userId))
			.orderBy(desc(usageSessions.startedAt))
			.limit(limit)
			.offset(offset);

		// Format the response
		const sessions = sessionsWithCorrections.map((session) => ({
			id: session.id,
			startedAt: session.startedAt instanceof Date ? session.startedAt.getTime() : (typeof session.startedAt === 'number' ? session.startedAt * 1000 : session.startedAt),
			endedAt: session.endedAt instanceof Date ? session.endedAt.getTime() : (typeof session.endedAt === 'number' ? session.endedAt * 1000 : session.endedAt),
			topic: session.topic,
			difficulty: session.difficulty,
			mode: session.mode,
			provider: session.provider,
			messageCount: session.messageCount ?? 0,
			correctionCount: Number(session.correctionCount) || 0
		}));

		return json({
			success: true,
			data: {
				sessions,
				pagination: {
					page,
					limit,
					total
				}
			}
		});
	} catch (err) {
		console.error('[GET /api/conversations] Error:', err);
		throw error(500, 'Failed to fetch conversations');
	}
};
