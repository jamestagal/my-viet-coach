import { Resend } from 'resend';
import { dev } from '$app/environment';
import { PUBLIC_PROJECT_NAME } from '$env/static/public';

// Cached environment variables (set from hooks.server.ts in production)
let cachedEmailEnv: {
	RESEND_API_KEY?: string;
	FROM_EMAIL?: string;
} | null = null;

/**
 * Set email environment variables (must be called from hooks.server.ts in production)
 */
export function setEmailEnv(env: { RESEND_API_KEY?: string; FROM_EMAIL?: string }) {
	console.log('[Email] setEmailEnv called:', {
		hasApiKey: !!env.RESEND_API_KEY,
		apiKeyLength: env.RESEND_API_KEY?.length,
		fromEmail: env.FROM_EMAIL
	});
	cachedEmailEnv = env;
	// Reset Resend client to pick up new credentials
	resend = null;
}

// Production: Resend SDK (native Cloudflare Workers support)
// Initialize lazily when needed
let resend: Resend | null = null;
function getResend() {
	const apiKey = cachedEmailEnv?.RESEND_API_KEY;
	if (!resend && apiKey) {
		resend = new Resend(apiKey);
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
	const fromEmail = cachedEmailEnv?.FROM_EMAIL || `noreply@${PUBLIC_PROJECT_NAME.toLowerCase().replace(/\s/g, '')}.com`;
	const resendClient = getResend();

	console.log('[Email] sendResendEmail:', {
		to: options.to,
		fromEmail,
		hasClient: !!resendClient,
		hasCachedEnv: !!cachedEmailEnv,
		hasApiKey: !!cachedEmailEnv?.RESEND_API_KEY
	});

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

	if (dev) {
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
	},

	purchaseConfirmation: async ({
		toEmail,
		customerName,
		productName,
		amount,
		currency
	}: {
		toEmail: string;
		customerName: string | null;
		productName: string;
		amount: number;
		currency: string;
	}) => {
		const formattedAmount = new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency.toUpperCase()
		}).format(amount / 100); // Polar amounts are in cents

		const displayName = customerName || 'there';
		const formattedDate = new Date().toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'long',
			day: 'numeric'
		});

		await sendEmail({
			to: toEmail,
			subject: `Payment received - ${PUBLIC_PROJECT_NAME}`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
					<div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
						<div style="text-align: center; margin-bottom: 24px;">
							<img src="https://speakphoreal.com/speak-pho-real.svg" alt="${PUBLIC_PROJECT_NAME}" style="height: 40px; width: auto;" />
						</div>
						<h2 style="margin: 0 0 16px; color: #111827; font-size: 24px;">Payment Received</h2>
						<p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
							Hi ${displayName}, thank you for your payment!
						</p>
						<div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 24px;">
							<table style="width: 100%; border-collapse: collapse;">
								<tr>
									<td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Product</td>
									<td style="color: #111827; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${productName}</td>
								</tr>
								<tr>
									<td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Amount</td>
									<td style="color: #111827; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${formattedAmount}</td>
								</tr>
								<tr>
									<td style="color: #6b7280; font-size: 14px; padding: 8px 0;">Date</td>
									<td style="color: #111827; font-size: 14px; font-weight: 500; text-align: right; padding: 8px 0;">${formattedDate}</td>
								</tr>
							</table>
						</div>
						<p style="margin: 0; color: #9ca3af; font-size: 12px;">
							If you have any questions about this payment, please contact our support team.
						</p>
					</div>
				</body>
				</html>
			`
		});
	},

	welcome: async ({
		toEmail,
		userName
	}: {
		toEmail: string;
		userName?: string | null;
	}) => {
		const displayName = userName || 'there';

		await sendEmail({
			to: toEmail,
			subject: `Welcome to ${PUBLIC_PROJECT_NAME}!`,
			html: `
				<!DOCTYPE html>
				<html>
				<head>
					<meta charset="utf-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
				</head>
				<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; background-color: #f9fafb;">
					<div style="background: white; padding: 32px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
						<div style="text-align: center; margin-bottom: 24px;">
							<img src="https://speakphoreal.com/speak-pho-real.svg" alt="${PUBLIC_PROJECT_NAME}" style="height: 40px; width: auto;" />
						</div>
						<h2 style="margin: 0 0 16px; color: #111827; font-size: 24px;">Welcome to ${PUBLIC_PROJECT_NAME}!</h2>
						<p style="margin: 0 0 24px; color: #6b7280; font-size: 14px;">
							Hi ${displayName}, we're excited to have you join us on your Vietnamese learning journey!
						</p>
						<h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Getting Started</h3>
						<ul style="margin: 0 0 24px; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
							<li><strong>Start a practice session</strong> - Have real conversations with our AI coach</li>
							<li><strong>Free plan</strong> - Includes 10 minutes of practice per month</li>
							<li><strong>Upgrade anytime</strong> - Get more practice time with our paid plans</li>
						</ul>
						<h3 style="margin: 0 0 12px; color: #111827; font-size: 16px;">Tips for Success</h3>
						<ul style="margin: 0 0 24px; padding-left: 20px; color: #6b7280; font-size: 14px; line-height: 1.6;">
							<li>Speak naturally - don't worry about making mistakes</li>
							<li>Our coach provides real-time corrections and explanations</li>
							<li>Review your conversation history to track your progress</li>
						</ul>
						<div style="text-align: center; margin-bottom: 24px;">
							<a href="https://speakphoreal.com/practice" style="display: inline-block; background: #111827; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 500;">
								Start Practicing
							</a>
						</div>
						<p style="margin: 0; color: #9ca3af; font-size: 12px; text-align: center;">
							Happy learning!<br/>The ${PUBLIC_PROJECT_NAME} Team
						</p>
					</div>
				</body>
				</html>
			`
		});
	}
};
