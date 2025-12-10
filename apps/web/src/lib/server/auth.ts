import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { emailOTP, admin } from 'better-auth/plugins';
import { polar, checkout, portal, webhooks } from '@polar-sh/better-auth';
import { dev } from '$app/environment';
import { getDb } from './database/db';
import { polarClient, handleWebhook } from './utils/polar';
import {
	GOOGLE_CLIENT_ID,
	GOOGLE_CLIENT_SECRET,
	POLAR_WEBHOOK_SECRET
} from '$env/static/private';
import { PUBLIC_PROJECT_NAME, PUBLIC_ORIGIN } from '$env/static/public';
import { send } from './email/email';

// Lazy-initialized auth instance (database must be initialized first)
let authInstance: ReturnType<typeof betterAuth> | null = null;

function createAuth() {
	return betterAuth({
		appName: PUBLIC_PROJECT_NAME,
		baseURL: dev ? 'http://localhost:5173' : PUBLIC_ORIGIN,

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
				clientId: GOOGLE_CLIENT_ID,
				clientSecret: GOOGLE_CLIENT_SECRET
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
					await send.otpVerification({ toEmail: email, otp });
				}
			}),
			polar({
				client: polarClient,
				createCustomerOnSignUp: true,
				enableCustomerPortal: true,
				use: [
					checkout({
						successUrl: '/settings/billing/success?checkout_id={CHECKOUT_ID}',
						authenticatedUsersOnly: true
					}),
					portal(),
					webhooks({
						secret: POLAR_WEBHOOK_SECRET || '',
						onPayLoad: async (event) => {
							if (event.type === 'order.paid') {
								await handleWebhook.onOrderPaid(event);
							}
						},
						onSubscriptionUpdated: handleWebhook.onSubscriptionUpdated,
						onProductUpdated: handleWebhook.onProductUpdated
					})
				]
			})
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
