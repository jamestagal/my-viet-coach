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

// End reason enum values (extended with disconnect and provider_switch)
const END_REASONS = ['user_ended', 'limit_reached', 'timeout', 'error', 'stale', 'disconnect', 'provider_switch'] as const;

// Provider enum values
const PROVIDERS = ['gemini', 'openai'] as const;

// Mode enum values
const MODES = ['free', 'coach'] as const;

// Message role enum values
const MESSAGE_ROLES = ['user', 'coach'] as const;

// Correction category enum values
const CORRECTION_CATEGORIES = ['grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation'] as const;

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
 * Usage sessions table - individual voice session logs with health tracking
 * Detailed audit trail for support, analytics, and admin session monitoring
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
		endReason: text('end_reason', { enum: END_REASONS }),

		// Provider tracking (NEW)
		provider: text('provider', { enum: PROVIDERS }).default('gemini'),
		initialProvider: text('initial_provider', { enum: PROVIDERS }),
		providerSwitchedAt: integer('provider_switched_at', { mode: 'timestamp' }),

		// Disconnect tracking (NEW)
		disconnectCode: integer('disconnect_code'),
		disconnectReason: text('disconnect_reason'),

		// Session details (NEW)
		mode: text('mode', { enum: MODES }),
		messageCount: integer('message_count').default(0)
	},
	(table) => [
		// Index on user_id for query performance
		index('usage_sessions_user_id_idx').on(table.userId),
		// Index on started_at for time-based queries
		index('usage_sessions_started_at_idx').on(table.startedAt),
		// Index on provider for admin queries
		index('usage_sessions_provider_idx').on(table.provider),
		// Index on disconnect_code for admin queries
		index('usage_sessions_disconnect_code_idx').on(table.disconnectCode),
		// Index on mode for admin queries
		index('usage_sessions_mode_idx').on(table.mode)
	]
);

/**
 * Session messages table - conversation history for user review
 * Stores individual messages from voice sessions for learning reference
 */
export const sessionMessages = sqliteTable(
	'session_messages',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		userId: text('user_id').notNull(),

		// Message content
		role: text('role', { enum: MESSAGE_ROLES }).notNull(),
		text: text('text').notNull(),

		// Timing
		timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
		sequenceNumber: integer('sequence_number').notNull()
	},
	(table) => [
		// Index on session_id for fetching conversation history
		index('session_messages_session_idx').on(table.sessionId),
		// Index on user_id for user-specific queries
		index('session_messages_user_idx').on(table.userId),
		// Index on timestamp for time-based queries
		index('session_messages_timestamp_idx').on(table.timestamp)
	]
);

/**
 * Session corrections table - learning items from coach mode
 * Stores corrections extracted from coach mode sessions for review
 */
export const sessionCorrections = sqliteTable(
	'session_corrections',
	{
		id: text('id').primaryKey(),
		sessionId: text('session_id').notNull(),
		userId: text('user_id').notNull(),

		// Correction content
		original: text('original').notNull(),
		correction: text('correction').notNull(),
		explanation: text('explanation'),
		category: text('category', { enum: CORRECTION_CATEGORIES }),

		// Learning tracking
		reviewed: integer('reviewed', { mode: 'boolean' }).default(false),
		reviewedAt: integer('reviewed_at', { mode: 'timestamp' }),
		confidenceLevel: integer('confidence_level').default(0),

		// Timing
		createdAt: integer('created_at', { mode: 'timestamp' }).notNull()
	},
	(table) => [
		// Index on session_id for fetching session corrections
		index('session_corrections_session_idx').on(table.sessionId),
		// Index on user_id for user-specific queries
		index('session_corrections_user_idx').on(table.userId),
		// Index on category for filtering corrections by type
		index('session_corrections_category_idx').on(table.category),
		// Index on reviewed for filtering unreviewed corrections
		index('session_corrections_reviewed_idx').on(table.reviewed)
	]
);

// Type exports for usage_periods
export type UsagePeriod = typeof usagePeriods.$inferSelect;
export type NewUsagePeriod = typeof usagePeriods.$inferInsert;

// Type exports for usage_sessions
export type UsageSession = typeof usageSessions.$inferSelect;
export type NewUsageSession = typeof usageSessions.$inferInsert;

// Type exports for session_messages
export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;

// Type exports for session_corrections
export type SessionCorrection = typeof sessionCorrections.$inferSelect;
export type NewSessionCorrection = typeof sessionCorrections.$inferInsert;
