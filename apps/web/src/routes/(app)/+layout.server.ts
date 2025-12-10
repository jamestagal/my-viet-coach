import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = async ({ locals, depends }) => {
	depends('app:layout');

	if (!locals.user || !locals.session) {
		redirect(302, '/login');
	}

	return {
		user: locals.user,
		session: locals.session
	};
};
