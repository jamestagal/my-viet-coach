/**
 * GET /api/admin/sessions
 *
 * Admin endpoint for session health monitoring.
 * Restricted to users with admin role.
 *
 * Query Parameters:
 * - from: ISO date string (optional, filter sessions from date)
 * - to: ISO date string (optional, filter sessions to date)
 * - provider: 'gemini' | 'openai' (optional, filter by provider)
 * - hasDisconnect: 'true' | 'false' (optional, filter by disconnect status)
 * - page: number (default: 1)
 * - limit: number (default: 50, max: 200)
 *
 * Response:
 * - sessions: Array of sessions with user email
 * - stats: { totalSessions, avgDuration, providerBreakdown, disconnectBreakdown, providerSwitchRate }
 * - pagination: { page, limit, total }
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { usageSessions, user } from '$lib/server/database/schema';
import { eq, and, gte, lte, isNotNull, isNull, desc, count, sql, avg } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals, url }) => {
	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	// Require admin role
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Admin access required');
	}

	try {
		const db = getDb();

		// Parse query parameters
		const fromParam = url.searchParams.get('from');
		const toParam = url.searchParams.get('to');
		const providerParam = url.searchParams.get('provider');
		const hasDisconnectParam = url.searchParams.get('hasDisconnect');
		const pageParam = url.searchParams.get('page');
		const limitParam = url.searchParams.get('limit');

		const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
		const limit = Math.min(200, Math.max(1, parseInt(limitParam || '50', 10) || 50));
		const offset = (page - 1) * limit;

		// Validate provider if provided
		if (providerParam && !['gemini', 'openai'].includes(providerParam)) {
			throw error(400, 'Invalid provider. Must be "gemini" or "openai".');
		}

		// Build filter conditions
		const conditions: ReturnType<typeof eq>[] = [];

		// Date range filters
		if (fromParam) {
			const fromDate = new Date(fromParam);
			if (!isNaN(fromDate.getTime())) {
				conditions.push(gte(usageSessions.startedAt, fromDate));
			}
		}

		if (toParam) {
			const toDate = new Date(toParam);
			if (!isNaN(toDate.getTime())) {
				// Set to end of day
				toDate.setHours(23, 59, 59, 999);
				conditions.push(lte(usageSessions.startedAt, toDate));
			}
		}

		// Provider filter
		if (providerParam) {
			conditions.push(eq(usageSessions.provider, providerParam as 'gemini' | 'openai'));
		}

		// Disconnect filter
		if (hasDisconnectParam !== null) {
			if (hasDisconnectParam === 'true') {
				conditions.push(isNotNull(usageSessions.disconnectCode));
			} else {
				conditions.push(isNull(usageSessions.disconnectCode));
			}
		}

		const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

		// Get sessions with user email
		const sessions = await db
			.select({
				id: usageSessions.id,
				userId: usageSessions.userId,
				userEmail: user.email,
				startedAt: usageSessions.startedAt,
				endedAt: usageSessions.endedAt,
				minutesUsed: usageSessions.minutesUsed,
				topic: usageSessions.topic,
				difficulty: usageSessions.difficulty,
				mode: usageSessions.mode,
				provider: usageSessions.provider,
				initialProvider: usageSessions.initialProvider,
				providerSwitchedAt: usageSessions.providerSwitchedAt,
				disconnectCode: usageSessions.disconnectCode,
				disconnectReason: usageSessions.disconnectReason,
				messageCount: usageSessions.messageCount
			})
			.from(usageSessions)
			.leftJoin(user, eq(usageSessions.userId, user.id))
			.where(whereClause)
			.orderBy(desc(usageSessions.startedAt))
			.limit(limit)
			.offset(offset);

		// Get total count for filtered results
		const totalResult = await db
			.select({ count: count() })
			.from(usageSessions)
			.where(whereClause);

		const total = totalResult[0]?.count ?? 0;

		// Calculate stats (for filtered results)
		// Total sessions
		const totalSessions = total;

		// Average duration
		const avgDurationResult = await db
			.select({ avg: avg(usageSessions.minutesUsed) })
			.from(usageSessions)
			.where(whereClause);

		const avgDuration = Number(avgDurationResult[0]?.avg) || 0;

		// Provider breakdown
		const providerBreakdownResult = await db
			.select({
				provider: usageSessions.provider,
				count: count()
			})
			.from(usageSessions)
			.where(whereClause)
			.groupBy(usageSessions.provider);

		const providerBreakdown: Record<string, number> = {
			gemini: 0,
			openai: 0
		};

		for (const row of providerBreakdownResult) {
			if (row.provider) {
				providerBreakdown[row.provider] = Number(row.count);
			}
		}

		// Disconnect breakdown
		const disconnectBreakdownResult = await db
			.select({
				disconnectCode: usageSessions.disconnectCode,
				count: count()
			})
			.from(usageSessions)
			.where(and(whereClause, isNotNull(usageSessions.disconnectCode)))
			.groupBy(usageSessions.disconnectCode);

		const disconnectBreakdown: Record<string, number> = {};
		for (const row of disconnectBreakdownResult) {
			if (row.disconnectCode !== null) {
				disconnectBreakdown[String(row.disconnectCode)] = Number(row.count);
			}
		}

		// Provider switch rate
		const switchedCountResult = await db
			.select({ count: count() })
			.from(usageSessions)
			.where(and(whereClause, isNotNull(usageSessions.providerSwitchedAt)));

		const switchedCount = switchedCountResult[0]?.count ?? 0;
		const providerSwitchRate = totalSessions > 0 ? switchedCount / totalSessions : 0;

		// Format sessions for response
		const formattedSessions = sessions.map((session) => ({
			id: session.id,
			userId: session.userId,
			userEmail: session.userEmail,
			startedAt:
				session.startedAt instanceof Date ? session.startedAt.getTime() : session.startedAt,
			endedAt: session.endedAt instanceof Date ? session.endedAt.getTime() : session.endedAt,
			minutesUsed: session.minutesUsed,
			topic: session.topic,
			difficulty: session.difficulty,
			mode: session.mode,
			provider: session.provider,
			initialProvider: session.initialProvider,
			providerSwitched: session.providerSwitchedAt !== null,
			providerSwitchedAt:
				session.providerSwitchedAt instanceof Date
					? session.providerSwitchedAt.getTime()
					: session.providerSwitchedAt,
			disconnectCode: session.disconnectCode,
			disconnectReason: session.disconnectReason,
			messageCount: session.messageCount ?? 0
		}));

		return json({
			success: true,
			data: {
				sessions: formattedSessions,
				stats: {
					totalSessions,
					avgDuration: Math.round(avgDuration * 10) / 10, // Round to 1 decimal
					providerBreakdown,
					disconnectBreakdown,
					providerSwitchRate: Math.round(providerSwitchRate * 1000) / 1000 // Round to 3 decimals
				},
				pagination: {
					page,
					limit,
					total
				}
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[GET /api/admin/sessions] Error:', err);
		throw error(500, 'Failed to fetch session data');
	}
};
