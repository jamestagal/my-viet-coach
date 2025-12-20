/**
 * POST /api/session/corrections
 *
 * Saves corrections for a completed session.
 * Used after AI extraction of corrections from coach mode sessions.
 *
 * Request body:
 * - sessionId: string (required)
 * - corrections: SessionCorrection[] (required)
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { sessionCorrections, usageSessions } from '$lib/server/database/schema';
import { eq, and } from 'drizzle-orm';
import { randomUUID } from 'crypto';

interface SessionCorrection {
	original: string;
	correction: string;
	explanation?: string;
	category?: 'grammar' | 'tone' | 'vocabulary' | 'word_order' | 'pronunciation';
}

interface RequestBody {
	sessionId: string;
	corrections: SessionCorrection[];
}

const VALID_CATEGORIES = ['grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation'];

export const POST: RequestHandler = async ({ locals, request }) => {
	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	// Parse request body
	let body: RequestBody;
	try {
		body = await request.json();
	} catch {
		throw error(400, 'Invalid JSON body');
	}

	// Validate sessionId
	if (!body.sessionId || typeof body.sessionId !== 'string') {
		throw error(400, 'sessionId is required');
	}

	// Validate corrections array
	if (!body.corrections || !Array.isArray(body.corrections)) {
		throw error(400, 'corrections must be an array');
	}

	for (const corr of body.corrections) {
		if (typeof corr.original !== 'string') {
			throw error(400, 'Each correction must have an original string');
		}
		if (typeof corr.correction !== 'string') {
			throw error(400, 'Each correction must have a correction string');
		}
		if (corr.category && !VALID_CATEGORIES.includes(corr.category)) {
			throw error(400, `Invalid correction category. Must be one of: ${VALID_CATEGORIES.join(', ')}`);
		}
	}

	try {
		const db = getDb();

		// Verify the session belongs to this user
		const sessionResult = await db
			.select({ id: usageSessions.id })
			.from(usageSessions)
			.where(and(eq(usageSessions.id, body.sessionId), eq(usageSessions.userId, userId)))
			.limit(1);

		if (sessionResult.length === 0) {
			throw error(404, 'Session not found');
		}

		// Insert corrections
		if (body.corrections.length > 0) {
			const nowSeconds = Math.floor(Date.now() / 1000);

			const correctionInserts = body.corrections.map((corr) => ({
				id: randomUUID(),
				sessionId: body.sessionId,
				userId: userId,
				original: corr.original,
				correction: corr.correction,
				explanation: corr.explanation ?? null,
				category: corr.category ?? null,
				createdAt: new Date(nowSeconds * 1000)
			}));

			await db.insert(sessionCorrections).values(correctionInserts);
		}

		return json({
			success: true,
			data: {
				savedCount: body.corrections.length
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[POST /api/session/corrections] Error:', err);
		throw error(500, 'Failed to save corrections');
	}
};
