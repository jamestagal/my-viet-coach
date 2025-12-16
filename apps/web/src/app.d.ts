// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		interface Locals {
			user: {
				id: string;
				name: string | null;
				email: string;
				emailVerified: boolean;
				image: string | null;
				role: string;
				createdAt: Date | null;
				updatedAt: Date | null;
			} | null;
			session: {
				id: string;
				userId: string;
				token: string;
				expiresAt: Date;
				ipAddress: string | null;
				userAgent: string | null;
				createdAt: Date | null;
				updatedAt: Date | null;
			} | null;
			subscription: {
				id: string;
				userId: string;
				productId: string | null;
				polarSubscriptionId: string;
				polarProductId: string;
				polarCustomerId: string | null;
				status: string;
				plan: string | null;
				currentPeriodStart: Date | null;
				currentPeriodEnd: Date | null;
				trialEnds: Date | null;
				cancelAtPeriodEnd: boolean;
				createdAt: Date | null;
				updatedAt: Date | null;
			} | null;
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				DB: D1Database;
				// API Worker URL for cross-worker communication
				API_URL?: string;
				// Internal API secret for secure cross-worker calls
				INTERNAL_API_SECRET?: string;
			};
		}
	}
}

export {};
