import { Resend } from 'resend';
import { dev } from '$app/environment';
import { env } from '$env/dynamic/private';
import { PUBLIC_PROJECT_NAME } from '$env/static/public';

// Production: Resend SDK (native Cloudflare Workers support)
// Initialize lazily when needed
let resend: Resend | null = null;
function getResend() {
	if (!resend && env.RESEND_API_KEY) {
		resend = new Resend(env.RESEND_API_KEY);
	}
	return resend;
}

// Local dev: Mailpit - initialize lazily to avoid breaking Cloudflare Workers
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let localClient: any = null;
async function getLocalClient() {
	if (!localClient && dev) {
		const { SMTPClient } = await import('emailjs');
		localClient = new SMTPClient({
			host: 'localhost',
			port: 1025,
			ssl: false
		});
	}
	return localClient;
}

interface EmailOptions {
	to: string;
	subject: string;
	html: string;
}

async function sendLocalEmail(options: EmailOptions) {
	try {
		const client = await getLocalClient();
		if (!client) {
			console.error('[Email] Local client not available');
			return;
		}
		await client.sendAsync({
			text: options.subject,
			from: `${PUBLIC_PROJECT_NAME} <noreply@localhost>`,
			to: options.to,
			subject: options.subject,
			attachment: [{ data: options.html, alternative: true }]
		});
		console.log(`[Email] Sent to ${options.to} via Mailpit`);
	} catch (e) {
		console.error('[Email] Failed to send via Mailpit:', e);
	}
}

async function sendResendEmail(options: EmailOptions) {
	const fromEmail = env.FROM_EMAIL || `noreply@${PUBLIC_PROJECT_NAME.toLowerCase().replace(/\s/g, '')}.com`;
	const resendClient = getResend();

	if (!resendClient) {
		throw new Error('Resend API key not configured');
	}

	const { data, error } = await resendClient.emails.send({
		from: `${PUBLIC_PROJECT_NAME} <${fromEmail}>`,
		to: options.to,
		subject: options.subject,
		html: options.html
	});

	if (error) {
		console.error('[Email] Resend error:', error);
		throw new Error(error.message);
	}

	console.log(`[Email] Sent to ${options.to} via Resend`, data);
	return data;
}

export async function sendEmail(options: EmailOptions) {
	if (process.env.NODE_ENV === 'test') {
		console.log('[Email] Test mode - skipping email');
		return;
	}

	if (dev || env.LOCAL_EMAIL === 'true') {
		return sendLocalEmail(options);
	}

	return sendResendEmail(options);
}

// Email templates for Better-Auth
export const send = {
	otpVerification: async ({ toEmail, otp }: { toEmail: string; otp: string }) => {
		await sendEmail({
			to: toEmail,
			subject: `Your ${PUBLIC_PROJECT_NAME} verification code`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
					<div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
						<h2 style="margin: 0 0 16px; color: #111827; font-size: 24px;">Your verification code</h2>
						<p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
							Enter this code to sign in to ${PUBLIC_PROJECT_NAME}:
						</p>
						<div style="font-size: 32px; font-weight: bold; letter-spacing: 0.15em; background: #f3f4f6; padding: 16px 24px; border-radius: 8px; text-align: center; color: #111827;">
							${otp}
						</div>
						<p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px;">
							This code expires in 5 minutes. If you didn't request this code, you can safely ignore this email.
						</p>
					</div>
				</body>
				</html>
			`
		});
	},

	emailVerification: async ({ toEmail, url }: { toEmail: string; url: string }) => {
		await sendEmail({
			to: toEmail,
			subject: `Verify your email for ${PUBLIC_PROJECT_NAME}`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
					<div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
						<h2 style="margin: 0 0 16px; color: #111827; font-size: 24px;">Verify your email</h2>
						<p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
							Click the button below to verify your email address for ${PUBLIC_PROJECT_NAME}:
						</p>
						<a href="${url}" style="display: inline-block; background: #111827; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">
							Verify Email
						</a>
						<p style="margin: 24px 0 0; color: #9ca3af; font-size: 12px;">
							If you didn't create an account, you can safely ignore this email.
						</p>
					</div>
				</body>
				</html>
			`
		});
	}
};
