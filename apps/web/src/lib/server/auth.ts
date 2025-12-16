import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, admin } from 'better-auth/plugins';
// TEMPORARILY DISABLED: @polar-sh/better-auth causes createRequire() error on Cloudflare Workers
// See: https://github.com/better-auth/better-auth/issues/1143
// import { polar, checkout, portal, webhooks } from '@polar-sh/better-auth';
import { dev } from '$app/environment';
import { getDb } from './database/db';
// import { polarClient, handleWebhook } from './utils/polar';
import { PUBLIC_PROJECT_NAME, PUBLIC_ORIGIN } from '$env/static/public';
import {
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	BETTER_AUTH_SECRET
} from '$env/static/private';
import { send } from './email/email';

/**
 * Email Allowlist - Only these emails can sign up/login
 * Add beta testers here as needed
 *
 * Set to empty array [] to allow all emails (open registration)
 */
const ALLOWED_EMAILS: string[] = [
	// Add your email here
	'benjaminjameswaller@gmail.com',
	'benjaminwaller@hotmail.com',
];

/**
 * Check if an email is allowed to sign up
 * Returns true if allowlist is empty (open registration) or email is in the list
 */
export function isEmailAllowed(email: string): boolean {
	if (ALLOWED_EMAILS.length === 0) return true;
	return ALLOWED_EMAILS.some((allowed) => allowed.toLowerCase() === email.toLowerCase());
}

// Lazy-initialized auth instance (database must be initialized first)
let authInstance: ReturnType<typeof betterAuth> | null = null;
let cachedEnv: {
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
} | null = null;

/**
 * Set environment variables for auth (must be called before getAuth in production)
 * Also resets the auth instance to pick up new env vars
 */
export function setAuthEnv(env: {
	GOOGLE_CLIENT_ID: string;
	GOOGLE_CLIENT_SECRET: string;
	BETTER_AUTH_SECRET: string;
}) {
	cachedEnv = env;
	// Reset auth instance so it picks up the new env vars
	authInstance = null;
}

function createAuth() {
	// In dev, use static imports from $env/static/private; in production, use cached env from platform
	const googleClientId = dev
		? GOOGLE_CLIENT_ID
		: cachedEnv?.GOOGLE_CLIENT_ID;
	const googleClientSecret = dev
		? GOOGLE_CLIENT_SECRET
		: cachedEnv?.GOOGLE_CLIENT_SECRET;
	const secret = dev
		? BETTER_AUTH_SECRET
		: cachedEnv?.BETTER_AUTH_SECRET;

	console.log('[Auth] Creating auth with:', {
		hasClientId: !!googleClientId,
		hasClientSecret: !!googleClientSecret,
		hasSecret: !!secret,
		clientIdLength: googleClientId?.length,
		isDev: dev,
		hasCachedEnv: !!cachedEnv,
		baseURL: dev ? 'http://localhost:5173' : PUBLIC_ORIGIN
	});

	if (!googleClientId || !googleClientSecret) {
		console.error('[Auth] Missing Google OAuth credentials!');
	}

	return betterAuth({
		secret,
		appName: PUBLIC_PROJECT_NAME,
		baseURL: dev ? 'http://localhost:5173' : PUBLIC_ORIGIN,

		// Trust Cloudflare Pages preview deployments and custom domain
		trustedOrigins: dev
			? ['http://localhost:5173']
			: [PUBLIC_ORIGIN, 'https://*.speakphoreal.pages.dev', 'https://*.noi-hay.pages.dev', 'https://speakphoreal.com'],

		database: drizzleAdapter(getDb(), {
			provider: 'sqlite'
		}),

		// Email verification
		emailVerification: {
			sendVerificationEmail: async ({ user, url }) => {
				await send.emailVerification({ toEmail: user.email, url });
			}
		},

		// Social providers
		socialProviders: {
			google: {
				clientId: googleClientId || '',
				clientSecret: googleClientSecret || ''
			}
		},

		// Session config
		session: {
			cookieCache: {
				enabled: true,
				maxAge: 10 // 10 seconds
			}
		},

		// Rate limiting (using memory for now - works on Cloudflare Workers)
		rateLimit: {
			enabled: true,
			window: 60, // 60 seconds
			max: 120, // 120 requests per window
			customRules: {
				'/email-otp/send-verification-otp': {
					window: 60,
					max: 2 // Only 2 OTP requests per minute
				}
			},
			storage: 'memory' // Use memory storage instead of database
		},

		// Advanced config
		advanced: {
			cookiePrefix: 'speakphoreal',
			ipAddress: {
				ipAddressHeaders: ['x-client-ip', 'cf-connecting-ip'],
				disableIpTracking: false
			}
		},

		// Plugins
		plugins: [
			admin(),
			emailOTP({
				async sendVerificationOTP({ email, otp }) {
					// Check email allowlist before sending OTP
					if (!isEmailAllowed(email)) {
						console.log('[Auth] Blocked OTP request for non-allowed email:', email);
						throw new Error('Sign-ups are currently invite-only. Join the waitlist to get early access!');
					}
					await send.otpVerification({ toEmail: email, otp });
				}
			})
			// TEMPORARILY DISABLED: Polar plugin causes createRequire() error on Cloudflare Workers
			// polar({
			// 	client: polarClient,
			// 	createCustomerOnSignUp: true,
			// 	enableCustomerPortal: true,
			// 	use: [
			// 		checkout({
			// 			successUrl: '/settings/billing/success?checkout_id={CHECKOUT_ID}',
			// 			authenticatedUsersOnly: true
			// 		}),
			// 		portal(),
			// 		webhooks({
			// 			secret: POLAR_WEBHOOK_SECRET || '',
			// 			onPayLoad: async (event) => {
			// 				if (event.type === 'order.paid') {
			// 					await handleWebhook.onOrderPaid(event);
			// 				}
			// 			},
			// 			onSubscriptionUpdated: handleWebhook.onSubscriptionUpdated,
			// 			onProductUpdated: handleWebhook.onProductUpdated
			// 		})
			// 	]
			// })
		]
	});
}

/**
 * Get the auth instance. Must be called after database is initialized.
 */
export function getAuth() {
	if (!authInstance) {
		authInstance = createAuth();
	}
	return authInstance;
}

export type Auth = ReturnType<typeof getAuth>;
