import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Require authentication - redirect to login if not authenticated
	if (!locals.user || !locals.session) {
		redirect(302, '/login');
	}

	return {
		user: locals.user
	};
};
