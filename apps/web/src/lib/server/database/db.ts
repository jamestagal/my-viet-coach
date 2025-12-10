import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { dev } from '$app/environment';
import * as schema from '$lib/server/database/schema';

// Type for the database instance
type DbInstance = ReturnType<typeof drizzleD1<typeof schema>>;

// Store the database instance
let _db: DbInstance | null = null;

/**
 * Initialize the database with a D1 binding (for production on Cloudflare)
 * Call this from hooks.server.ts with platform.env.DB
 */
export function initDb(d1: D1Database) {
	if (!_db) {
		_db = drizzleD1(d1, { schema });
	}
	return _db;
}

/**
 * Initialize database for local development using Wrangler's getPlatformProxy
 * This emulates Cloudflare D1 locally, matching production behavior
 */
export async function initLocalDb() {
	if (!_db && dev) {
		// Use wrangler's local D1 emulation
		const { getPlatformProxy } = await import('wrangler');
		const { env } = await getPlatformProxy();
		_db = drizzleD1(env.DB as D1Database, { schema });
	}
	return _db;
}

/**
 * Get the database instance
 * Must call initDb() or initLocalDb() first
 */
export function getDb(): DbInstance {
	if (!_db) {
		throw new Error('Database not initialized. Call initDb() or initLocalDb() first.');
	}
	return _db;
}

// For backwards compatibility with existing code that imports `db` directly
// This will throw if accessed before initialization
export const db = new Proxy({} as DbInstance, {
	get(_, prop) {
		return (getDb() as Record<string | symbol, unknown>)[prop];
	}
});
