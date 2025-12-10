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
		}
		// interface PageData {}
		// interface PageState {}
		interface Platform {
			env?: {
				DB: D1Database;
			};
		}
	}
}

export {};
