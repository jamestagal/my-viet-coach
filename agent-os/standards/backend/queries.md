# Database Queries - Speak Phở Real

Standards for querying Cloudflare D1 with Drizzle ORM.

## Query Patterns

### Basic Select

```typescript
import { getDb } from '$lib/server/database/db';
import { user } from '$lib/server/database/schema';
import { eq, and, or, gt, lt, desc, asc } from 'drizzle-orm';

const db = getDb();

// Get all users
const users = await db.select().from(user);

// Get single user by ID
const [foundUser] = await db
  .select()
  .from(user)
  .where(eq(user.id, userId))
  .limit(1);

// Select specific columns
const emails = await db
  .select({ email: user.email, name: user.name })
  .from(user);
```

### Filtering

```typescript
// Multiple conditions (AND)
const activeAdmins = await db
  .select()
  .from(user)
  .where(
    and(
      eq(user.role, 'admin'),
      eq(user.emailVerified, true)
    )
  );

// OR conditions
const relevantUsers = await db
  .select()
  .from(user)
  .where(
    or(
      eq(user.role, 'admin'),
      gt(user.createdAt, oneWeekAgo)
    )
  );
```

### Sorting & Pagination

```typescript
// Sort and limit
const recentUsers = await db
  .select()
  .from(user)
  .orderBy(desc(user.createdAt))
  .limit(10)
  .offset(0);

// Pagination helper
async function getUsers(page: number, limit: number) {
  const offset = (page - 1) * limit;
  return db
    .select()
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(limit)
    .offset(offset);
}
```

### Joins

```typescript
import { user, session } from '$lib/server/database/schema';

// Left join
const usersWithSessions = await db
  .select({
    user: user,
    session: session,
  })
  .from(user)
  .leftJoin(session, eq(user.id, session.userId));

// Inner join
const activeUsers = await db
  .select()
  .from(user)
  .innerJoin(session, eq(user.id, session.userId))
  .where(gt(session.expiresAt, new Date()));
```

### Aggregations

```typescript
import { count, sum, avg } from 'drizzle-orm';

// Count
const [{ total }] = await db
  .select({ total: count() })
  .from(user);

// Sum
const [{ totalMinutes }] = await db
  .select({ totalMinutes: sum(usageSessions.minutesUsed) })
  .from(usageSessions)
  .where(eq(usageSessions.userId, userId));
```

### Inserts

```typescript
// Single insert
await db.insert(user).values({
  id: crypto.randomUUID(),
  email: 'user@example.com',
  name: 'New User',
  createdAt: new Date(),
  updatedAt: new Date(),
});

// Insert with returning
const [newUser] = await db
  .insert(user)
  .values({ ... })
  .returning();

// Bulk insert
await db.insert(sessionMessages).values([
  { id: '1', sessionId, role: 'user', text: 'Hello' },
  { id: '2', sessionId, role: 'coach', text: 'Xin chào!' },
]);
```

### Updates

```typescript
// Update single record
await db
  .update(user)
  .set({ name: 'Updated Name', updatedAt: new Date() })
  .where(eq(user.id, userId));

// Update with returning
const [updatedUser] = await db
  .update(user)
  .set({ role: 'admin' })
  .where(eq(user.id, userId))
  .returning();
```

### Deletes

```typescript
// Delete by ID
await db.delete(session).where(eq(session.id, sessionId));

// Delete with condition
await db
  .delete(session)
  .where(lt(session.expiresAt, new Date()));
```

### Transactions

```typescript
// D1 transactions (via batch)
const results = await db.batch([
  db.insert(user).values({ ... }),
  db.insert(session).values({ ... }),
]);

// Or with raw SQL transaction
await db.run(sql`BEGIN TRANSACTION`);
try {
  await db.insert(user).values({ ... });
  await db.insert(session).values({ ... });
  await db.run(sql`COMMIT`);
} catch (error) {
  await db.run(sql`ROLLBACK`);
  throw error;
}
```

## Raw SQL

When Drizzle doesn't support a query pattern:

```typescript
import { sql } from 'drizzle-orm';

// Raw query
const result = await db.run(sql`
  SELECT * FROM user
  WHERE email LIKE ${`%${searchTerm}%`}
`);

// Get typed result
const users = await db.all<User>(sql`
  SELECT * FROM user
  WHERE role = 'admin'
`);
```

## Best Practices

- **Use Drizzle methods:** Prefer ORM methods over raw SQL for type safety
- **Parameterize queries:** Never interpolate user input directly
- **Select needed columns:** Don't select `*` when you only need specific fields
- **Use indexes:** Ensure WHERE/JOIN columns are indexed
- **Limit results:** Always use `.limit()` for list queries
- **Handle null:** Check for null/undefined after single-record queries
