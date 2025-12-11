import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * POST /api/private/images
 *
 * Handles image uploads for user avatars.
 * Protected by hooks.server.ts - only authenticated users can access.
 *
 * Note: This is a stub implementation. In production, you would:
 * - Upload to R2, S3, or Cloudflare Images
 * - Process/resize images
 * - Return the uploaded image URL
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	// Auth is enforced in hooks.server.ts for /api/private/* routes
	const user = locals.user;

	if (!user) {
		throw error(401, 'Unauthorized');
	}

	try {
		const formData = await request.formData();
		const images = formData.getAll('images') as File[];
		const cropDataStr = formData.get('cropData') as string;

		if (!images || images.length === 0) {
			throw error(400, 'No images provided');
		}

		// Parse crop data if provided
		let cropData = [];
		if (cropDataStr) {
			try {
				cropData = JSON.parse(cropDataStr);
			} catch {
				console.warn('[Images API] Invalid crop data JSON');
			}
		}

		// TODO: Implement actual image upload
		// Options:
		// 1. Upload to Cloudflare R2
		// 2. Upload to Cloudflare Images
		// 3. Upload to S3
		// 4. Process with Sharp/Jimp for cropping/resizing

		console.log('[Images API] Received upload request:', {
			userId: user.id,
			imageCount: images.length,
			cropData
		});

		// For now, return success stub
		// In production, return the uploaded image URLs
		return json({
			success: true,
			message: 'Images uploaded successfully',
			urls: images.map((_, i) => `/placeholder-avatar-${i}.png`)
		});
	} catch (err) {
		console.error('[Images API] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, 'Failed to upload images');
	}
};
