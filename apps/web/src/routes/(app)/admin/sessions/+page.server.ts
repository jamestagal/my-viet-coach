import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	// Check authentication
	if (!locals.user || !locals.session) {
		redirect(302, '/login');
	}

	// Check admin role
	if (locals.user.role !== 'admin') {
		redirect(302, '/dashboard');
	}

	return {
		user: locals.user
	};
};
