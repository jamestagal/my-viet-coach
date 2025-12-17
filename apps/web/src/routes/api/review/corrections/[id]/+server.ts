/**
 * PATCH /api/review/corrections/[id]
 *
 * Updates the reviewed status and confidence level of a correction.
 * Verifies the correction belongs to the authenticated user.
 *
 * Request Body:
 * - reviewed: boolean (optional)
 * - confidenceLevel: number 0-5 (optional)
 *
 * Response:
 * - Updated correction with reviewedAt timestamp
 */
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getDb } from '$lib/server/database/db';
import { sessionCorrections } from '$lib/server/database/schema';
import { eq, and } from 'drizzle-orm';

interface PatchBody {
	reviewed?: boolean;
	confidenceLevel?: number;
}

export const PATCH: RequestHandler = async ({ locals, params, request }) => {
	// Require authentication
	const userId = locals.user?.id;
	if (!userId) {
		throw error(401, 'Unauthorized');
	}

	const correctionId = params.id;
	if (!correctionId) {
		throw error(400, 'Correction ID is required');
	}

	try {
		const db = getDb();

		// Parse request body
		let body: PatchBody;
		try {
			body = await request.json();
		} catch {
			throw error(400, 'Invalid JSON body');
		}

		// Validate confidenceLevel if provided
		if (body.confidenceLevel !== undefined) {
			if (
				typeof body.confidenceLevel !== 'number' ||
				body.confidenceLevel < 0 ||
				body.confidenceLevel > 5
			) {
				throw error(400, 'confidenceLevel must be a number between 0 and 5');
			}
		}

		// Validate reviewed if provided
		if (body.reviewed !== undefined && typeof body.reviewed !== 'boolean') {
			throw error(400, 'reviewed must be a boolean');
		}

		// Check if at least one field is being updated
		if (body.reviewed === undefined && body.confidenceLevel === undefined) {
			throw error(400, 'At least one field (reviewed or confidenceLevel) must be provided');
		}

		// Verify the correction exists and belongs to the user
		const existingResult = await db
			.select()
			.from(sessionCorrections)
			.where(and(eq(sessionCorrections.id, correctionId), eq(sessionCorrections.userId, userId)))
			.limit(1);

		const existing = existingResult[0];
		if (!existing) {
			throw error(404, 'Correction not found');
		}

		// Build update object
		const updateData: {
			reviewed?: boolean;
			reviewedAt?: Date;
			confidenceLevel?: number;
		} = {};

		if (body.reviewed !== undefined) {
			updateData.reviewed = body.reviewed;
			if (body.reviewed) {
				updateData.reviewedAt = new Date();
			} else {
				// Clear reviewedAt when unmarking as reviewed
				updateData.reviewedAt = undefined;
			}
		}

		if (body.confidenceLevel !== undefined) {
			updateData.confidenceLevel = body.confidenceLevel;
		}

		// Update the correction
		await db
			.update(sessionCorrections)
			.set(updateData)
			.where(eq(sessionCorrections.id, correctionId));

		// Fetch the updated correction
		const updatedResult = await db
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
			.where(eq(sessionCorrections.id, correctionId))
			.limit(1);

		const updated = updatedResult[0];

		// Format response
		const formattedCorrection = {
			id: updated.id,
			sessionId: updated.sessionId,
			original: updated.original,
			correction: updated.correction,
			explanation: updated.explanation,
			category: updated.category,
			reviewed: updated.reviewed ?? false,
			reviewedAt:
				updated.reviewedAt instanceof Date
					? updated.reviewedAt.getTime()
					: updated.reviewedAt ?? null,
			confidenceLevel: updated.confidenceLevel ?? 0,
			createdAt: updated.createdAt instanceof Date ? updated.createdAt.getTime() : updated.createdAt
		};

		return json({
			success: true,
			data: formattedCorrection
		});
	} catch (err) {
		// Re-throw SvelteKit errors
		if (err && typeof err === 'object' && 'status' in err) {
			throw err;
		}
		console.error('[PATCH /api/review/corrections/:id] Error:', err);
		throw error(500, 'Failed to update correction');
	}
};
