-- Better-Auth user table (recreate with full schema)
CREATE TABLE IF NOT EXISTS `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`email` text NOT NULL UNIQUE,
	`emailVerified` integer DEFAULT false,
	`image` text,
	`role` text DEFAULT 'user',
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
-- Better-Auth session table
CREATE TABLE IF NOT EXISTS `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL UNIQUE,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
-- Better-Auth account table (OAuth providers)
CREATE TABLE IF NOT EXISTS `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
-- Better-Auth verification table (OTP, email verification)
CREATE TABLE IF NOT EXISTS `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
-- Product table (synced from Polar)
CREATE TABLE IF NOT EXISTS `product` (
	`id` text PRIMARY KEY NOT NULL,
	`polarProductId` text NOT NULL UNIQUE,
	`name` text NOT NULL,
	`description` text,
	`plan` text,
	`prices` text,
	`features` text,
	`active` integer DEFAULT true,
	`showOnPricingPage` integer DEFAULT false,
	`createdAt` integer,
	`updatedAt` integer
);
--> statement-breakpoint
-- Subscription table (tracks user subscriptions from Polar)
CREATE TABLE IF NOT EXISTS `subscription` (
	`id` text PRIMARY KEY NOT NULL,
	`userId` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`productId` text REFERENCES `product`(`id`) ON DELETE SET NULL,
	`polarSubscriptionId` text NOT NULL UNIQUE,
	`polarProductId` text,
	`polarCustomerId` text,
	`status` text NOT NULL DEFAULT 'active',
	`plan` text,
	`currentPeriodStart` integer,
	`currentPeriodEnd` integer,
	`trialEnds` integer,
	`cancelAtPeriodEnd` integer DEFAULT false,
	`createdAt` integer,
	`updatedAt` integer
);
