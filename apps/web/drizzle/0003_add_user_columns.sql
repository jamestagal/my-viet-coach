-- Add missing columns to user table for Better-Auth compatibility
ALTER TABLE user ADD COLUMN name TEXT;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN emailVerified INTEGER DEFAULT 0;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN image TEXT;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';
--> statement-breakpoint
ALTER TABLE user ADD COLUMN createdAt INTEGER;
--> statement-breakpoint
ALTER TABLE user ADD COLUMN updatedAt INTEGER;
