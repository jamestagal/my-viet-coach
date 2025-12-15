# Database Migrations - Speak Phở Real

Standards for Drizzle migrations with Cloudflare D1.

## Migration Workflow

```bash
# 1. Modify schema.ts with your changes

# 2. Generate migration
pnpm --filter web run generate

# 3. Review generated SQL in migrations/ folder

# 4. Run migration on production D1
pnpm --filter web run migrate:prod

# Or run directly with wrangler:
pnpm wrangler d1 execute noi-hay-db --remote --file=./migrations/0001_migration_name.sql
```

## Migration Location

```
apps/web/
  drizzle/
    migrations/
      0000_initial.sql
      0001_add_subscriptions.sql
      meta/
        _journal.json    # Migration history
```

## Drizzle Config

```typescript
// drizzle.config.ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/lib/server/database/schema.ts',
  out: './drizzle/migrations',
  dialect: 'sqlite',
  driver: 'd1-http',
  dbCredentials: {
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID!,
    databaseId: '1b0a331d-eb7c-4835-96cd-e50f3a7f7a41',
    token: process.env.CLOUDFLARE_API_TOKEN!,
  },
});
```

## Migration Patterns

### Add Column

```sql
-- migrations/0002_add_user_role.sql
ALTER TABLE user ADD COLUMN role TEXT DEFAULT 'user';
```

### Add Table

```sql
-- migrations/0003_add_usage_sessions.sql
CREATE TABLE IF NOT EXISTS usage_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER,
  minutes_used INTEGER NOT NULL DEFAULT 0,
  topic TEXT,
  FOREIGN KEY (user_id) REFERENCES user(id)
);

CREATE INDEX IF NOT EXISTS usage_sessions_user_id_idx ON usage_sessions(user_id);
```

### Add Index

```sql
-- migrations/0004_add_session_index.sql
CREATE INDEX IF NOT EXISTS session_expires_idx ON session(expiresAt);
```

### Modify Column (SQLite Limitation)

SQLite doesn't support `ALTER COLUMN`. Create a new table and migrate data:

```sql
-- migrations/0005_change_column_type.sql

-- 1. Create new table with correct schema
CREATE TABLE user_new (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 2. Copy data
INSERT INTO user_new SELECT id, email, name, created_at FROM user;

-- 3. Drop old table
DROP TABLE user;

-- 4. Rename new table
ALTER TABLE user_new RENAME TO user;

-- 5. Recreate indexes
CREATE UNIQUE INDEX user_email_idx ON user(email);
```

## Manual Migration Commands

```bash
# View current tables
pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"

# View table schema
pnpm wrangler d1 execute noi-hay-db --remote --command "PRAGMA table_info(user);"

# View indexes
pnpm wrangler d1 execute noi-hay-db --remote --command "PRAGMA index_list(user);"

# Run raw SQL
pnpm wrangler d1 execute noi-hay-db --remote --command "ALTER TABLE user ADD COLUMN role TEXT;"

# Run migration file
pnpm wrangler d1 execute noi-hay-db --remote --file=./drizzle/migrations/0005_new_migration.sql
```

## Best Practices

- **Test locally first:** Use local D1 (`--local` flag) before production
- **One change per migration:** Keep migrations small and focused
- **Use IF NOT EXISTS:** Prevent errors on re-runs
- **Never modify deployed migrations:** Create new migrations instead
- **Add indexes separately:** Create indexes in their own migration for large tables
- **Backup before destructive changes:** Export data before DROP operations

## D1 Limitations

- No `ALTER COLUMN` - must recreate table
- No concurrent index creation
- No stored procedures or triggers (limited)
- Maximum 10GB database size
- Limited to SQLite syntax
