import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Better-Auth user table
export const user = sqliteTable('user', {
	id: text('id').primaryKey(),
	name: text('name'),
	email: text('email').notNull().unique(),
	emailVerified: integer('emailVerified', { mode: 'boolean' }).default(false),
	image: text('image'),
	role: text('role').default('user'),
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
	productId: text('productId')
		.references(() => product.id, { onDelete: 'set null' }),
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
