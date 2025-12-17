/**
 * GET /api/conversations/[id]
 *
 * Returns full details of a specific conversation session including
 * all messages and corrections.
 *
 * Requires authentication and verifies the session belongs to the requesting user.
 *
 * Response:
 * - session: Session metadata
 * - messages: Array of messages ordered by sequenceNumber
 * - corrections: Array of corrections with all fields
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { usageSessions, sessionMessages, sessionCorrections } from '$lib/server/database/schema';
import { eq, and, asc } from 'drizzle-orm';

export const GET: RequestHandler = async ({ locals, params }) => {
	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const sessionId = params.id;
	if (!sessionId) {
		throw error(400, 'Session ID is required');
	}

	try {
		const db = getDb();

		// Fetch the session and verify ownership
		const sessionResult = await db
			.select()
			.from(usageSessions)
			.where(and(eq(usageSessions.id, sessionId), eq(usageSessions.userId, userId)))
			.limit(1);

		const session = sessionResult[0];
		if (!session) {
			throw error(404, 'Session not found');
		}

		// Fetch messages ordered by sequence number
		const messages = await db
			.select({
				id: sessionMessages.id,
				role: sessionMessages.role,
				text: sessionMessages.text,
				timestamp: sessionMessages.timestamp,
				sequenceNumber: sessionMessages.sequenceNumber
			})
			.from(sessionMessages)
			.where(eq(sessionMessages.sessionId, sessionId))
			.orderBy(asc(sessionMessages.sequenceNumber));

		// Fetch all corrections for this session
		const corrections = await db
			.select({
				id: sessionCorrections.id,
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
			.where(eq(sessionCorrections.sessionId, sessionId));

		// Format timestamps for response
		const formattedSession = {
			id: session.id,
			startedAt:
				session.startedAt instanceof Date ? session.startedAt.getTime() : (typeof session.startedAt === 'number' ? session.startedAt * 1000 : session.startedAt),
			endedAt: session.endedAt instanceof Date ? session.endedAt.getTime() : (typeof session.endedAt === 'number' ? session.endedAt * 1000 : session.endedAt),
			topic: session.topic,
			difficulty: session.difficulty,
			mode: session.mode,
			provider: session.provider,
			initialProvider: session.initialProvider,
			providerSwitchedAt:
				session.providerSwitchedAt instanceof Date
					? session.providerSwitchedAt.getTime()
					: (typeof session.providerSwitchedAt === 'number' ? session.providerSwitchedAt * 1000 : session.providerSwitchedAt),
			disconnectCode: session.disconnectCode,
			disconnectReason: session.disconnectReason,
			messageCount: session.messageCount ?? 0,
			minutesUsed: session.minutesUsed
		};

		const formattedMessages = messages.map((msg) => ({
			id: msg.id,
			role: msg.role,
			text: msg.text,
			timestamp: msg.timestamp instanceof Date ? msg.timestamp.getTime() : (typeof msg.timestamp === 'number' ? msg.timestamp * 1000 : msg.timestamp),
			sequenceNumber: msg.sequenceNumber
		}));

		const formattedCorrections = corrections.map((corr) => ({
			id: corr.id,
			original: corr.original,
			correction: corr.correction,
			explanation: corr.explanation,
			category: corr.category,
			reviewed: corr.reviewed ?? false,
			reviewedAt:
				corr.reviewedAt instanceof Date ? corr.reviewedAt.getTime() : (typeof corr.reviewedAt === 'number' ? corr.reviewedAt * 1000 : corr.reviewedAt ?? null),
			confidenceLevel: corr.confidenceLevel ?? 0,
			createdAt: corr.createdAt instanceof Date ? corr.createdAt.getTime() : (typeof corr.createdAt === 'number' ? corr.createdAt * 1000 : corr.createdAt)
		}));

		return json({
			success: true,
			data: {
				session: formattedSession,
				messages: formattedMessages,
				corrections: formattedCorrections
			}
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[GET /api/conversations/:id] Error:', err);
		throw error(500, 'Failed to fetch session details');
	}
};
