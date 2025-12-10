-- Initial schema for Speak Phở Real
-- User authentication tables

CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY NOT NULL,
    email TEXT NOT NULL,
    email_verified INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL REFERENCES user(id),
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS email_verification_token (
    id TEXT PRIMARY KEY NOT NULL,
    user_id TEXT NOT NULL,
    email TEXT NOT NULL,
    expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS signin (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    logged_in_at INTEGER NOT NULL,
    ip_address TEXT NOT NULL,
    email TEXT NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_session_user_id ON session(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_user_id ON email_verification_token(user_id);
CREATE INDEX IF NOT EXISTS idx_signin_email ON signin(email);
