import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

// Better-Auth user table
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
	image: text('image'),
	role: text('role').default('user'),
	banned: integer('banned', { mode: 'boolean' }).default(false),
	banReason: text('banReason'),
	banExpires: integer('banExpires', { mode: 'timestamp' }),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

// Better-Auth session table
export const session = sqliteTable('session', {
	id: text('id').primaryKey(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	token: text('token').notNull().unique(),
	ipAddress: text('ipAddress'),
	userAgent: text('userAgent'),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

// Better-Auth account table (OAuth providers)
export const account = sqliteTable('account', {
	id: text('id').primaryKey(),
	accountId: text('accountId').notNull(),
	providerId: text('providerId').notNull(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	accessToken: text('accessToken'),
	refreshToken: text('refreshToken'),
	idToken: text('idToken'),
	accessTokenExpiresAt: integer('accessTokenExpiresAt', { mode: 'timestamp' }),
	refreshTokenExpiresAt: integer('refreshTokenExpiresAt', { mode: 'timestamp' }),
	scope: text('scope'),
	password: text('password'),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

// Better-Auth verification table (OTP, email verification)
export const verification = sqliteTable('verification', {
	id: text('id').primaryKey(),
	identifier: text('identifier').notNull(),
	value: text('value').notNull(),
	expiresAt: integer('expiresAt', { mode: 'timestamp' }).notNull(),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

// Product table (synced from Polar)
export const product = sqliteTable('product', {
	id: text('id').primaryKey(),
	polarProductId: text('polarProductId').notNull().unique(),
	name: text('name').notNull(),
	description: text('description'),
	plan: text('plan'), // 'free', 'pro', 'enterprise', etc.
	prices: text('prices', { mode: 'json' }), // JSON array of price objects
	features: text('features', { mode: 'json' }), // JSON array of feature strings
	active: integer('active', { mode: 'boolean' }).default(true),
	showOnPricingPage: integer('showOnPricingPage', { mode: 'boolean' }).default(false),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

// Subscription table (tracks user subscriptions from Polar)
export const subscription = sqliteTable('subscription', {
	id: text('id').primaryKey(),
	userId: text('userId')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	productId: text('productId').references(() => product.id, { onDelete: 'set null' }),
	polarSubscriptionId: text('polarSubscriptionId').notNull().unique(),
	polarProductId: text('polarProductId'),
	polarCustomerId: text('polarCustomerId'),
	status: text('status').notNull().default('active'), // 'active', 'canceled', 'past_due', 'trialing', etc.
	plan: text('plan'), // 'free', 'pro', 'enterprise', etc.
	currentPeriodStart: integer('currentPeriodStart', { mode: 'timestamp' }),
	currentPeriodEnd: integer('currentPeriodEnd', { mode: 'timestamp' }),
	trialEnds: integer('trialEnds', { mode: 'timestamp' }),
	cancelAtPeriodEnd: integer('cancelAtPeriodEnd', { mode: 'boolean' }).default(false),
	createdAt: integer('createdAt', { mode: 'timestamp' }),
	updatedAt: integer('updatedAt', { mode: 'timestamp' })
});

// Plan type enum values
const PLAN_TYPES = ['free', 'basic', 'pro'] as const;

// Difficulty enum values
const DIFFICULTY_LEVELS = ['beginner', 'intermediate', 'advanced'] as const;

// End reason enum values
const END_REASONS = ['user_ended', 'limit_reached', 'timeout', 'error', 'stale'] as const;

/**
 * Usage periods table - monthly usage records synced from Durable Objects
 * This is the billing record used for invoicing and analytics
 */
export const usagePeriods = sqliteTable(
	'usage_periods',
	{
		id: text('id').primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),

		// Period info (stored as ISO date strings YYYY-MM-DD)
		periodStart: text('period_start').notNull(),
		periodEnd: text('period_end').notNull(),

		// Plan at time of usage
		plan: text('plan', { enum: PLAN_TYPES }).notNull().default('free'),

		// Usage metrics
		minutesUsed: integer('minutes_used').notNull().default(0),
		minutesLimit: integer('minutes_limit').notNull().default(10),

		// Sync metadata (ISO timestamp of last DO sync)
		syncedAt: text('synced_at'),
		version: integer('version').notNull().default(1),
		archived: integer('archived', { mode: 'boolean' }).default(false),

		// Timestamps
		createdAt: integer('created_at', { mode: 'timestamp' })
	},
	(table) => [
		// Unique constraint for UPSERT operations
		uniqueIndex('usage_periods_user_period_unique').on(table.userId, table.periodStart),
		// Index on user_id for query performance
		index('usage_periods_user_id_idx').on(table.userId)
	]
);

/**
 * Usage sessions table - individual voice session logs
 * Detailed audit trail for support and analytics
 */
export const usageSessions = sqliteTable(
	'usage_sessions',
	{
		id: text('id').primaryKey(), // Same as session ID from DO
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),

		// Session timing
		startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
		endedAt: integer('ended_at', { mode: 'timestamp' }),

		// Usage
		minutesUsed: integer('minutes_used').notNull().default(0),

		// Context
		topic: text('topic'),
		difficulty: text('difficulty', { enum: DIFFICULTY_LEVELS }),

		// Metadata
		endReason: text('end_reason', { enum: END_REASONS })
	},
	(table) => [
		// Index on user_id for query performance
		index('usage_sessions_user_id_idx').on(table.userId),
		// Index on started_at for time-based queries
		index('usage_sessions_started_at_idx').on(table.startedAt)
	]
);

// Type exports for usage_periods
export type UsagePeriod = typeof usagePeriods.$inferSelect;
export type NewUsagePeriod = typeof usagePeriods.$inferInsert;

// Type exports for usage_sessions
export type UsageSession = typeof usageSessions.$inferSelect;
export type NewUsageSession = typeof usageSessions.$inferInsert;
