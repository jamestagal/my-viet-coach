-- Migration: Add Usage Tracking Tables
-- Date: 2024-12-15
-- Description: Adds usage_periods and usage_sessions tables for voice coaching session tracking

-- Usage periods table - monthly usage records synced from Durable Objects
CREATE TABLE IF NOT EXISTS `usage_periods` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`period_start` text NOT NULL,
	`period_end` text NOT NULL,
	`plan` text NOT NULL DEFAULT 'free' CHECK (`plan` IN ('free', 'basic', 'pro')),
	`minutes_used` integer NOT NULL DEFAULT 0,
	`minutes_limit` integer NOT NULL DEFAULT 10,
	`synced_at` text,
	`version` integer NOT NULL DEFAULT 1,
	`archived` integer DEFAULT false,
	`created_at` integer
);
--> statement-breakpoint
-- Unique constraint for UPSERT operations on (user_id, period_start)
CREATE UNIQUE INDEX IF NOT EXISTS `usage_periods_user_period_unique` ON `usage_periods` (`user_id`, `period_start`);
--> statement-breakpoint
-- Index on user_id for query performance
CREATE INDEX IF NOT EXISTS `usage_periods_user_id_idx` ON `usage_periods` (`user_id`);
--> statement-breakpoint
-- Usage sessions table - individual voice session logs
CREATE TABLE IF NOT EXISTS `usage_sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL REFERENCES `user`(`id`) ON DELETE CASCADE,
	`started_at` integer NOT NULL,
	`ended_at` integer,
	`minutes_used` integer NOT NULL DEFAULT 0,
	`topic` text,
	`difficulty` text CHECK (`difficulty` IN ('beginner', 'intermediate', 'advanced')),
	`end_reason` text CHECK (`end_reason` IN ('user_ended', 'limit_reached', 'timeout', 'error', 'stale'))
);
--> statement-breakpoint
-- Index on user_id for query performance
CREATE INDEX IF NOT EXISTS `usage_sessions_user_id_idx` ON `usage_sessions` (`user_id`);
--> statement-breakpoint
-- Index on started_at for time-based queries
CREATE INDEX IF NOT EXISTS `usage_sessions_started_at_idx` ON `usage_sessions` (`started_at`);
