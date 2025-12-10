-- Better-Auth Migration
-- Migrates from Lucia tables to Better-Auth tables

-- Drop old Lucia tables (backup data if needed before running)
DROP TABLE IF EXISTS session;
DROP TABLE IF EXISTS email_verification_token;
DROP TABLE IF EXISTS signin;

-- Rename user table columns to match Better-Auth schema
-- First, create new user table with Better-Auth schema
CREATE TABLE IF NOT EXISTS user_new (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER DEFAULT 0,
    image TEXT,
    role TEXT DEFAULT 'user',
    createdAt INTEGER DEFAULT (unixepoch()),
    updatedAt INTEGER DEFAULT (unixepoch())
);

-- Copy existing user data to new table
INSERT INTO user_new (id, email, emailVerified)
SELECT id, email, email_verified FROM user;

-- Drop old user table and rename new one
DROP TABLE user;
ALTER TABLE user_new RENAME TO user;

-- Better-Auth session table
CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY NOT NULL,
    expiresAt INTEGER NOT NULL,
    token TEXT NOT NULL UNIQUE,
    ipAddress TEXT,
    userAgent TEXT,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    createdAt INTEGER DEFAULT (unixepoch()),
    updatedAt INTEGER DEFAULT (unixepoch())
);

-- Better-Auth account table (for OAuth providers)
CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY NOT NULL,
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    userId TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER DEFAULT (unixepoch()),
    updatedAt INTEGER DEFAULT (unixepoch())
);

-- Better-Auth verification table (for OTP, email verification, etc.)
CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY NOT NULL,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER DEFAULT (unixepoch()),
    updatedAt INTEGER DEFAULT (unixepoch())
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_userId ON session(userId);
CREATE INDEX IF NOT EXISTS idx_session_token ON session(token);
CREATE INDEX IF NOT EXISTS idx_account_userId ON account(userId);
CREATE INDEX IF NOT EXISTS idx_account_providerId ON account(providerId);
CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification(identifier);
