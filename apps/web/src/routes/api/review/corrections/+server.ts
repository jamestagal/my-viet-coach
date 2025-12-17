/**
 * GET /api/review/corrections
 *
 * Returns all corrections for the authenticated user with filtering and stats.
 *
 * Query Parameters:
 * - reviewed: 'true' | 'false' (optional, filter by reviewed status)
 * - category: string (optional, filter by correction category)
 * - page: number (default: 1)
 * - limit: number (default: 20, max: 100)
 *
 * Response:
 * - corrections: Array of correction objects
 * - stats: { total, reviewed, byCategory }
 * - pagination: { page, limit, total }
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { sessionCorrections } from '$lib/server/database/schema';
import { eq, desc, and, count, sql } from 'drizzle-orm';

const VALID_CATEGORIES = ['grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation'] as const;

export const GET: RequestHandler = async ({ locals, url }) => {
	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	try {
		const db = getDb();

		// Parse query parameters
		const reviewedParam = url.searchParams.get('reviewed');
		const categoryParam = url.searchParams.get('category');
		const pageParam = url.searchParams.get('page');
		const limitParam = url.searchParams.get('limit');

		const page = Math.max(1, parseInt(pageParam || '1', 10) || 1);
		const limit = Math.min(100, Math.max(1, parseInt(limitParam || '20', 10) || 20));
		const offset = (page - 1) * limit;

		// Validate category if provided
		if (categoryParam && !VALID_CATEGORIES.includes(categoryParam as (typeof VALID_CATEGORIES)[number])) {
			throw error(400, `Invalid category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
		}

		// Build filter conditions
		const conditions = [eq(sessionCorrections.userId, userId)];

		if (reviewedParam !== null) {
			const reviewedValue = reviewedParam === 'true';
			conditions.push(eq(sessionCorrections.reviewed, reviewedValue));
		}

		if (categoryParam) {
			conditions.push(eq(sessionCorrections.category, categoryParam as (typeof VALID_CATEGORIES)[number]));
		}

		const whereClause = and(...conditions);

		// Get filtered corrections
		const corrections = await db
			.select({
				id: sessionCorrections.id,
				sessionId: sessionCorrections.sessionId,
				original: sessionCorrections.original,
				correction: sessionCorrections.correction,
				explanation: sessionCorrections.explanation,
				category: sessionCorrections.category,
				reviewed: sessionCorrections.reviewed,
				reviewedAt: sessionCorrections.reviewedAt,
				confidenceLevel: sessionCorrections.confidenceLevel,
				createdAt: sessionCorrections.createdAt
			})
			.from(sessionCorrections)
			.where(whereClause)
			.orderBy(desc(sessionCorrections.createdAt))
			.limit(limit)
			.offset(offset);

		// Get total count for filtered results
		const totalResult = await db
			.select({ count: count() })
			.from(sessionCorrections)
			.where(whereClause);

		const filteredTotal = totalResult[0]?.count ?? 0;

		// Get overall stats (unfiltered for user)
		const userCondition = eq(sessionCorrections.userId, userId);

		// Total corrections
		const totalStatsResult = await db
			.select({ count: count() })
			.from(sessionCorrections)
			.where(userCondition);

		const totalCorrections = totalStatsResult[0]?.count ?? 0;

		// Reviewed count
		const reviewedStatsResult = await db
			.select({ count: count() })
			.from(sessionCorrections)
			.where(and(userCondition, eq(sessionCorrections.reviewed, true)));

		const reviewedCount = reviewedStatsResult[0]?.count ?? 0;

		// By category breakdown
		const byCategoryResult = await db
			.select({
				category: sessionCorrections.category,
				count: count()
			})
			.from(sessionCorrections)
			.where(userCondition)
			.groupBy(sessionCorrections.category);

		const byCategory: Record<string, number> = {
			grammar: 0,
			tone: 0,
			vocabulary: 0,
			word_order: 0,
			pronunciation: 0
		};

		for (const row of byCategoryResult) {
			if (row.category && row.category in byCategory) {
				byCategory[row.category] = Number(row.count);
			}
		}

		// Format corrections for response
		const formattedCorrections = corrections.map((corr) => ({
			id: corr.id,
			sessionId: corr.sessionId,
			original: corr.original,
			correction: corr.correction,
			explanation: corr.explanation,
			category: corr.category,
			reviewed: corr.reviewed ?? false,
			reviewedAt:
				corr.reviewedAt instanceof Date ? corr.reviewedAt.getTime() : corr.reviewedAt ?? null,
			confidenceLevel: corr.confidenceLevel ?? 0,
			createdAt: corr.createdAt instanceof Date ? corr.createdAt.getTime() : corr.createdAt
		}));

		return json({
			success: true,
			data: {
				corrections: formattedCorrections,
				stats: {
					total: totalCorrections,
					reviewed: reviewedCount,
					byCategory
				},
				pagination: {
					page,
					limit,
					total: filteredTotal
				}
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[GET /api/review/corrections] Error:', err);
		throw error(500, 'Failed to fetch corrections');
	}
};
