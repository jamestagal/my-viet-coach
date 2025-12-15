# Database Models - Speak Phở Real

Standards for Drizzle ORM schema definitions with Cloudflare D1.

## Schema Location

```
apps/web/src/lib/server/database/
  schema.ts       # All table definitions
  db.ts           # Database connection
```

## Table Definition Pattern

```typescript
// schema.ts
import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const user = sqliteTable('user', {
  // Primary key
  id: text('id').primaryKey(),

  // Required fields
  email: text('email').notNull().unique(),
  name: text('name').notNull(),

  // Optional fields
  image: text('image'),

  // Timestamps (stored as Unix milliseconds)
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),

  // Enums
  role: text('role', { enum: ['user', 'admin'] }).default('user'),

  // Boolean (SQLite uses integer 0/1)
  emailVerified: integer('email_verified', { mode: 'boolean' }).default(false),
}, (table) => ({
  // Indexes
  emailIdx: uniqueIndex('user_email_idx').on(table.email),
  createdAtIdx: index('user_created_at_idx').on(table.createdAt),
}));

// Type exports
export type User = typeof user.$inferSelect;
export type NewUser = typeof user.$inferInsert;
```

## Data Types

| Drizzle Type | SQLite Type | Use For |
|--------------|-------------|---------|
| `text('col')` | TEXT | Strings, UUIDs, enums |
| `integer('col')` | INTEGER | Numbers, timestamps, booleans |
| `integer('col', { mode: 'timestamp' })` | INTEGER | Dates (Unix ms) |
| `integer('col', { mode: 'boolean' })` | INTEGER | Booleans (0/1) |
| `real('col')` | REAL | Floating point numbers |
| `blob('col')` | BLOB | Binary data |

## Relationships

```typescript
// Foreign key reference
export const session = sqliteTable('session', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => user.id, {
    onDelete: 'cascade'
  }),
  // ...
});

// Self-referential
export const comment = sqliteTable('comment', {
  id: text('id').primaryKey(),
  parentId: text('parent_id').references(() => comment.id),
  // ...
});
```

## Indexes

```typescript
// Single column index
emailIdx: index('user_email_idx').on(table.email),

// Unique index
emailUnique: uniqueIndex('user_email_unique').on(table.email),

// Composite index
userPeriodIdx: index('usage_user_period_idx')
  .on(table.userId, table.periodStart),
```

## Common Patterns

### Timestamps

```typescript
// Always include created/updated timestamps
createdAt: integer('created_at', { mode: 'timestamp' })
  .notNull()
  .$defaultFn(() => new Date()),

updatedAt: integer('updated_at', { mode: 'timestamp' })
  .notNull()
  .$defaultFn(() => new Date()),
```

### Enums

```typescript
// Define as const array for type safety
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

difficulty: text('difficulty', {
  enum: DIFFICULTIES
}).default('intermediate'),
```

### UUID Primary Keys

```typescript
// Use text for UUIDs (generated in app code)
id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
```

## Querying with Drizzle

```typescript
import { getDb } from '$lib/server/database/db';
import { user, session } from '$lib/server/database/schema';
import { eq, and, gt, desc } from 'drizzle-orm';

// Get database instance
const db = getDb();

// Select
const users = await db.select().from(user).limit(10);

// Select with where
const activeUser = await db
  .select()
  .from(user)
  .where(eq(user.id, userId))
  .limit(1);

// Select with join
const userWithSessions = await db
  .select()
  .from(user)
  .leftJoin(session, eq(user.id, session.userId))
  .where(eq(user.id, userId));

// Insert
await db.insert(user).values({
  id: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'User',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Update
await db
  .update(user)
  .set({ name: 'New Name', updatedAt: new Date() })
  .where(eq(user.id, userId));

// Delete
await db.delete(session).where(eq(session.userId, userId));
```

## Best Practices

- **Primary keys:** Use `text` for UUIDs, never auto-increment integers
- **Timestamps:** Always use Unix milliseconds (integer), not ISO strings
- **Indexes:** Add indexes on foreign keys and commonly queried columns
- **Enums:** Define as TypeScript const arrays, reference in schema
- **Nullability:** Prefer `notNull()` with defaults over nullable columns
- **Naming:** Use snake_case for column names, camelCase for Drizzle fields
