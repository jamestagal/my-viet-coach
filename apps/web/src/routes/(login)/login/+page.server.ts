import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getAuth } from '$lib/server/auth';

export const load: PageServerLoad = async ({ locals }) => {
	// If already logged in, redirect to dashboard
	if (locals.user) {
		redirect(302, '/dashboard');
	}
	return { user: locals.user };
};

export const actions: Actions = {
	signout: async ({ request }) => {
		// Better-Auth handles signout via form action
		const auth = getAuth();
		await auth.api.signOut({
			headers: request.headers
		});
		redirect(302, '/login');
	}
};
