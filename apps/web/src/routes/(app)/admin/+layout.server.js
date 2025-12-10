import { redirect, error } from '@sveltejs/kit';

export async function load({ locals, depends }) {
    
    depends('admin:layout');

    if(!locals.user || !locals.session || locals.user.role !== 'admin'){
       redirect(302, '/login');
    }

    return {
        user: locals.user,
        session: locals.session,
        subscription: locals.subscription
    }
}
