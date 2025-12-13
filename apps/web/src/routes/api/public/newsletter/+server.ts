import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Resend } from 'resend';
import { env } from '$env/dynamic/private';
import { PUBLIC_PROJECT_NAME } from '$env/static/public';
import { dev } from '$app/environment';

/**
 * POST /api/public/newsletter
 *
 * Handles waitlist subscription.
 * Sends notification email to admin for each signup.
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const { email } = await request.json();

		// Validate required fields
		if (!email) {
			throw error(400, { message: 'Email is required' });
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			throw error(400, { message: 'Invalid email format' });
		}

		// In dev mode, just log and return success
		if (dev) {
			console.log('[Waitlist] Dev mode - new signup:', email);
			return json({ success: true, message: 'Subscribed successfully' });
		}

		// Production: Use Resend API to send notification
		const resendApiKey = env.RESEND_API_KEY;

		if (!resendApiKey) {
			console.error('[Waitlist] RESEND_API_KEY not configured');
			throw error(500, { message: 'Email service not configured' });
		}

		const resend = new Resend(resendApiKey);

		// Send notification email to admin
		const notificationEmail = env.WAITLIST_NOTIFICATION_EMAIL || 'waitlist@speakphoreal.com';
		const fromEmail = env.FROM_EMAIL || 'noreply@speakphoreal.com';

		await resend.emails.send({
			from: `${PUBLIC_PROJECT_NAME} <${fromEmail}>`,
			to: notificationEmail,
			subject: `New Waitlist Signup: ${email}`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
					<h2>New Waitlist Signup</h2>
					<p><strong>Email:</strong> ${email}</p>
					<p><strong>Time:</strong> ${new Date().toISOString()}</p>
					<hr>
					<p style="color: #666; font-size: 12px;">
						This notification was sent from ${PUBLIC_PROJECT_NAME} waitlist form.
					</p>
				</body>
				</html>
			`
		});

		console.log('[Waitlist] Notification sent for:', email);

		return json({ success: true, message: 'Subscribed successfully' });
	} catch (err) {
		console.error('[Waitlist API] Error:', err);

		if (err && typeof err === 'object' && 'status' in err) {
			throw err; // Re-throw SvelteKit errors
		}

		throw error(500, { message: 'Failed to subscribe' });
	}
};
