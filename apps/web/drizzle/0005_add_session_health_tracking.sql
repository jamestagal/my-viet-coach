-- Migration: Add Session Health Tracking & Conversation History
-- Date: 2024-12-17
-- Description: Extends usage_sessions with provider tracking, adds session_messages and session_corrections tables

-- Extend usage_sessions table with provider tracking columns
ALTER TABLE `usage_sessions` ADD COLUMN `provider` text DEFAULT 'gemini' CHECK (`provider` IN ('gemini', 'openai'));
--> statement-breakpoint
ALTER TABLE `usage_sessions` ADD COLUMN `initial_provider` text CHECK (`initial_provider` IN ('gemini', 'openai'));
--> statement-breakpoint
ALTER TABLE `usage_sessions` ADD COLUMN `provider_switched_at` integer;
--> statement-breakpoint

-- Extend usage_sessions table with disconnect tracking columns
ALTER TABLE `usage_sessions` ADD COLUMN `disconnect_code` integer;
--> statement-breakpoint
ALTER TABLE `usage_sessions` ADD COLUMN `disconnect_reason` text;
--> statement-breakpoint

-- Extend usage_sessions table with session details columns
ALTER TABLE `usage_sessions` ADD COLUMN `mode` text CHECK (`mode` IN ('free', 'coach'));
--> statement-breakpoint
ALTER TABLE `usage_sessions` ADD COLUMN `message_count` integer DEFAULT 0;
--> statement-breakpoint

-- Add indexes on extended usage_sessions columns for admin queries
CREATE INDEX IF NOT EXISTS `usage_sessions_provider_idx` ON `usage_sessions` (`provider`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `usage_sessions_disconnect_code_idx` ON `usage_sessions` (`disconnect_code`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `usage_sessions_mode_idx` ON `usage_sessions` (`mode`);
--> statement-breakpoint

-- Create session_messages table for conversation history
CREATE TABLE IF NOT EXISTS `session_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL CHECK (`role` IN ('user', 'coach')),
	`text` text NOT NULL,
	`timestamp` integer NOT NULL,
	`sequence_number` integer NOT NULL
);
--> statement-breakpoint

-- Add indexes for session_messages table
CREATE INDEX IF NOT EXISTS `session_messages_session_idx` ON `session_messages` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_messages_user_idx` ON `session_messages` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_messages_timestamp_idx` ON `session_messages` (`timestamp`);
--> statement-breakpoint

-- Create session_corrections table for learning corrections
CREATE TABLE IF NOT EXISTS `session_corrections` (
	`id` text PRIMARY KEY NOT NULL,
	`session_id` text NOT NULL,
	`user_id` text NOT NULL,
	`original` text NOT NULL,
	`correction` text NOT NULL,
	`explanation` text,
	`category` text CHECK (`category` IN ('grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation')),
	`reviewed` integer DEFAULT false,
	`reviewed_at` integer,
	`confidence_level` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
--> statement-breakpoint

-- Add indexes for session_corrections table
CREATE INDEX IF NOT EXISTS `session_corrections_session_idx` ON `session_corrections` (`session_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_corrections_user_idx` ON `session_corrections` (`user_id`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_corrections_category_idx` ON `session_corrections` (`category`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `session_corrections_reviewed_idx` ON `session_corrections` (`reviewed`);
