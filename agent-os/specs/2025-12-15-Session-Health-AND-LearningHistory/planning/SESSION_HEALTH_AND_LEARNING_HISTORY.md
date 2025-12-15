# Session Health Tracking & Learning History

## Speak Pho Real - Admin Monitoring & User Learning Resources

> **Document Version:** 1.0
> **Last Updated:** December 2024
> **Status:** Implementation Ready
> **Prerequisites:** [DURABLE_OBJECTS_USAGE_TRACKING.md](./DURABLE_OBJECTS_USAGE_TRACKING.md), [POLAR_WEBHOOK_DO_INTEGRATION.md](./POLAR_WEBHOOK_DO_INTEGRATION.md)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Architecture Overview](#architecture-overview)
3. [Schema Extensions](#schema-extensions)
4. [Data Flow](#data-flow)
5. [Implementation Phases](#implementation-phases)
6. [API Endpoints](#api-endpoints)
7. [Frontend Components](#frontend-components)
8. [Admin Dashboard](#admin-dashboard)

---

## Executive Summary

This document extends the Durable Objects usage tracking architecture to include:

1. **Session Health Tracking** - Admin visibility into session performance, disconnections, and provider usage
2. **Learning History** - User-accessible conversation logs and corrections (replacing localStorage)
3. **Provider Analytics** - Track Gemini vs OpenAI usage patterns and reliability

### Key Benefits

| Feature | Benefit |
|---------|---------|
| **Admin Session Logs** | Monitor system health, debug user issues, track provider reliability |
| **Persistent Learning History** | Users can review past conversations and corrections across devices |
| **Provider Fallback Tracking** | Understand when/why users switch from Gemini to OpenAI |
| **Correction Analytics** | Identify common learning patterns and areas for improvement |

### Integration with Existing Architecture

This spec **extends** the existing `usage_sessions` table from the DO plan rather than creating new tables. The DO handles real-time credit tracking, while D1 stores the detailed session data for historical analysis.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          Existing DO Architecture                                │
│  ┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐  │
│  │  UserUsageObject    │───▶│   usage_periods     │    │   subscriptions     │  │
│  │  (Real-time credits)│    │   (Monthly totals)  │    │   (Plan info)       │  │
│  └─────────────────────┘    └─────────────────────┘    └─────────────────────┘  │
│            │                                                                     │
│            ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │                    usage_sessions (EXTENDED)                                 ││
│  │  + provider, disconnect_code, mode, message_count                           ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
│            │                                                                     │
│            ▼                                                                     │
│  ┌─────────────────────────────────────────────────────────────────────────────┐│
│  │           NEW: session_messages + session_corrections                        ││
│  │           (Learning history for user review)                                 ││
│  └─────────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture Overview

### High-Level Data Flow

```
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              Voice Session Lifecycle                               │
├───────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  1. User clicks "Start Practice"                                                  │
│     │                                                                             │
│     ▼                                                                             │
│  ┌─────────────────────────┐    ┌───────────────────────────────────────────────┐│
│  │ POST /api/session/start │───▶│ UserUsageObject.startSession()               ││
│  │                         │    │ - Checks credits (zero latency!)              ││
│  │ Body: {                 │    │ - Reserves session                            ││
│  │   topic, difficulty,    │    │ - Returns sessionId                           ││
│  │   mode                  │    └───────────────────────────────────────────────┘│
│  │ }                       │                                                      │
│  └─────────────────────────┘                                                      │
│     │                                                                             │
│     │ ✓ Session approved                                                          │
│     ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ INSERT INTO usage_sessions:                                                  │ │
│  │ - id, user_id, started_at, topic, difficulty                                │ │
│  │ - provider: 'gemini' (initial)                                              │ │
│  │ - mode: 'coach' | 'free'                                                    │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│     │                                                                             │
│     ▼                                                                             │
│  ┌─────────────────────────┐                                                      │
│  │ Connect to Gemini/      │  ← Voice conversation happens                       │
│  │ OpenAI Realtime         │  ← Messages accumulated client-side                 │
│  └─────────────────────────┘                                                      │
│     │                                                                             │
│     │ If Gemini disconnects mid-session...                                        │
│     │                                                                             │
│     ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ User sees disconnect UI with options:                                        │ │
│  │ [Reconnect (Gemini)] [Try OpenAI] [End Session]                             │ │
│  │                                                                              │ │
│  │ If user clicks "Try OpenAI":                                                │ │
│  │ - UPDATE usage_sessions SET provider = 'openai', provider_switched_at = NOW │ │
│  │ - Continue conversation (history preserved)                                  │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│     │                                                                             │
│     │ Session ends (user clicks End, disconnect, or limit reached)               │
│     ▼                                                                             │
│  ┌───────────────────────────┐    ┌─────────────────────────────────────────────┐│
│  │ POST /api/session/end     │───▶│ UserUsageObject.endSession()               ││
│  │                           │    │ - Finalizes minutes                         ││
│  │ Body: {                   │    │ - Syncs to D1 immediately                   ││
│  │   sessionId,              │    └─────────────────────────────────────────────┘│
│  │   messages[],             │                                                    │
│  │   corrections[],          │                                                    │
│  │   disconnectReason,       │                                                    │
│  │   disconnectCode          │                                                    │
│  │ }                         │                                                    │
│  └───────────────────────────┘                                                    │
│     │                                                                             │
│     ▼                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────┐ │
│  │ D1 Bulk Insert:                                                              │ │
│  │ 1. UPDATE usage_sessions:                                                    │ │
│  │    - ended_at, minutes_used, end_reason, disconnect_code, message_count     │ │
│  │ 2. INSERT session_messages (conversation history for user review)            │ │
│  │ 3. INSERT session_corrections (learning items from coach mode)               │ │
│  └─────────────────────────────────────────────────────────────────────────────┘ │
│                                                                                   │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## Schema Extensions

### Extended usage_sessions Table

Add these columns to the existing `usage_sessions` table defined in `DURABLE_OBJECTS_USAGE_TRACKING.md`:

```sql
-- Migration: Extend usage_sessions for session health tracking
-- File: migrations/0003_extend_usage_sessions.sql

-- Add provider tracking columns
ALTER TABLE usage_sessions ADD COLUMN provider TEXT DEFAULT 'gemini';
ALTER TABLE usage_sessions ADD COLUMN provider_switched_at INTEGER;
ALTER TABLE usage_sessions ADD COLUMN initial_provider TEXT;

-- Add disconnect tracking columns
ALTER TABLE usage_sessions ADD COLUMN disconnect_code INTEGER;
ALTER TABLE usage_sessions ADD COLUMN disconnect_reason TEXT;

-- Add session details
ALTER TABLE usage_sessions ADD COLUMN mode TEXT CHECK (mode IN ('free', 'coach'));
ALTER TABLE usage_sessions ADD COLUMN message_count INTEGER DEFAULT 0;

-- Add index for admin queries
CREATE INDEX IF NOT EXISTS usage_sessions_provider_idx ON usage_sessions(provider);
CREATE INDEX IF NOT EXISTS usage_sessions_disconnect_code_idx ON usage_sessions(disconnect_code);
CREATE INDEX IF NOT EXISTS usage_sessions_mode_idx ON usage_sessions(mode);
```

### New session_messages Table

Store conversation history for user review and learning reference:

```sql
-- Migration: Add session messages table
-- File: migrations/0004_add_session_messages.sql

CREATE TABLE IF NOT EXISTS session_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Message content
  role TEXT NOT NULL CHECK (role IN ('user', 'coach')),
  text TEXT NOT NULL,

  -- Timing
  timestamp INTEGER NOT NULL,
  sequence_number INTEGER NOT NULL,

  -- Foreign key (logical, SQLite doesn't enforce)
  FOREIGN KEY (session_id) REFERENCES usage_sessions(id)
);

CREATE INDEX IF NOT EXISTS session_messages_session_idx ON session_messages(session_id);
CREATE INDEX IF NOT EXISTS session_messages_user_idx ON session_messages(user_id);
CREATE INDEX IF NOT EXISTS session_messages_timestamp_idx ON session_messages(timestamp);
```

### New session_corrections Table

Store corrections extracted from coach mode sessions:

```sql
-- Migration: Add session corrections table
-- File: migrations/0005_add_session_corrections.sql

CREATE TABLE IF NOT EXISTS session_corrections (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT NOT NULL,

  -- Correction content
  original TEXT NOT NULL,
  correction TEXT NOT NULL,
  explanation TEXT,
  category TEXT CHECK (category IN ('grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation')),

  -- Learning tracking
  reviewed INTEGER DEFAULT 0,
  reviewed_at INTEGER,
  confidence_level INTEGER DEFAULT 0,  -- 0-5 scale, user self-assessment

  -- Timing
  created_at INTEGER NOT NULL,

  -- Foreign key
  FOREIGN KEY (session_id) REFERENCES usage_sessions(id)
);

CREATE INDEX IF NOT EXISTS session_corrections_session_idx ON session_corrections(session_id);
CREATE INDEX IF NOT EXISTS session_corrections_user_idx ON session_corrections(user_id);
CREATE INDEX IF NOT EXISTS session_corrections_category_idx ON session_corrections(category);
CREATE INDEX IF NOT EXISTS session_corrections_reviewed_idx ON session_corrections(reviewed);
```

### Drizzle Schema Definitions

```typescript
// packages/data-ops/src/db/schema.ts (additions)

import { sqliteTable, text, integer, index } from "drizzle-orm/sqlite-core";

/**
 * Extended usage_sessions - individual voice session logs with health tracking
 * Extends the base table from DURABLE_OBJECTS_USAGE_TRACKING.md
 */
export const usageSessions = sqliteTable("usage_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),

  // Session timing
  startedAt: integer("started_at", { mode: "timestamp" }).notNull(),
  endedAt: integer("ended_at", { mode: "timestamp" }),

  // Usage
  minutesUsed: integer("minutes_used").notNull().default(0),

  // Context (existing)
  topic: text("topic"),
  difficulty: text("difficulty", { enum: ["beginner", "intermediate", "advanced"] }),

  // End reason (existing, extended)
  endReason: text("end_reason", {
    enum: ["user_ended", "limit_reached", "timeout", "error", "stale", "disconnect", "provider_switch"]
  }),

  // Link to conversation (existing)
  conversationId: text("conversation_id"),

  // NEW: Provider tracking
  provider: text("provider", { enum: ["gemini", "openai"] }).default("gemini"),
  initialProvider: text("initial_provider", { enum: ["gemini", "openai"] }),
  providerSwitchedAt: integer("provider_switched_at", { mode: "timestamp" }),

  // NEW: Disconnect tracking
  disconnectCode: integer("disconnect_code"),
  disconnectReason: text("disconnect_reason"),

  // NEW: Session details
  mode: text("mode", { enum: ["free", "coach"] }),
  messageCount: integer("message_count").default(0),
}, (table) => ({
  userIdIdx: index("usage_sessions_user_id_idx").on(table.userId),
  startedAtIdx: index("usage_sessions_started_at_idx").on(table.startedAt),
  providerIdx: index("usage_sessions_provider_idx").on(table.provider),
  disconnectCodeIdx: index("usage_sessions_disconnect_code_idx").on(table.disconnectCode),
  modeIdx: index("usage_sessions_mode_idx").on(table.mode),
}));

/**
 * Session messages - conversation history for user review
 */
export const sessionMessages = sqliteTable("session_messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").notNull(),

  // Message content
  role: text("role", { enum: ["user", "coach"] }).notNull(),
  text: text("text").notNull(),

  // Timing
  timestamp: integer("timestamp", { mode: "timestamp" }).notNull(),
  sequenceNumber: integer("sequence_number").notNull(),
}, (table) => ({
  sessionIdx: index("session_messages_session_idx").on(table.sessionId),
  userIdx: index("session_messages_user_idx").on(table.userId),
  timestampIdx: index("session_messages_timestamp_idx").on(table.timestamp),
}));

/**
 * Session corrections - learning items from coach mode
 */
export const sessionCorrections = sqliteTable("session_corrections", {
  id: text("id").primaryKey(),
  sessionId: text("session_id").notNull(),
  userId: text("user_id").notNull(),

  // Correction content
  original: text("original").notNull(),
  correction: text("correction").notNull(),
  explanation: text("explanation"),
  category: text("category", {
    enum: ["grammar", "tone", "vocabulary", "word_order", "pronunciation"]
  }),

  // Learning tracking
  reviewed: integer("reviewed", { mode: "boolean" }).default(false),
  reviewedAt: integer("reviewed_at", { mode: "timestamp" }),
  confidenceLevel: integer("confidence_level").default(0),

  // Timing
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
}, (table) => ({
  sessionIdx: index("session_corrections_session_idx").on(table.sessionId),
  userIdx: index("session_corrections_user_idx").on(table.userId),
  categoryIdx: index("session_corrections_category_idx").on(table.category),
  reviewedIdx: index("session_corrections_reviewed_idx").on(table.reviewed),
}));

// Type exports
export type UsageSession = typeof usageSessions.$inferSelect;
export type NewUsageSession = typeof usageSessions.$inferInsert;

export type SessionMessage = typeof sessionMessages.$inferSelect;
export type NewSessionMessage = typeof sessionMessages.$inferInsert;

export type SessionCorrection = typeof sessionCorrections.$inferSelect;
export type NewSessionCorrection = typeof sessionCorrections.$inferInsert;
```

---

## Implementation Phases

### Phase 1: "Try OpenAI" Button (COMPLETED)

**Status:** Done
**Files Modified:**
- `apps/web/src/routes/(app)/practice/+page.svelte` - Added disconnect UI with provider fallback

**What was implemented:**
- Mid-session disconnect UI showing reason
- "Reconnect" button (tries Gemini again)
- "Try OpenAI" button (forces OpenAI provider)
- "End Session" button (shows summary)
- Conversation history preserved when switching providers

### Phase 2: Extended Session Tracking (With DO Implementation)

**Status:** Ready for implementation
**Dependencies:** Durable Objects deployment

**Tasks:**
1. Run schema migrations to extend `usage_sessions`
2. Update `/api/session/start` endpoint to record:
   - `provider` (initial provider)
   - `mode` (coach/free)
   - `initial_provider`
3. Update `/api/session/end` endpoint to record:
   - `disconnect_code`
   - `disconnect_reason`
   - `message_count`
   - `provider` (final provider, if switched)
   - `provider_switched_at`
4. Modify practice page to send disconnect info on session end

**Code changes to `/api/session/start`:**

```typescript
// apps/api/worker/routes/session.ts (update startSession)

const startSessionSchema = z.object({
  topic: z.string().optional().default('general'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional().default('intermediate'),
  mode: z.enum(['free', 'coach']).optional().default('coach'),
  provider: z.enum(['gemini', 'openai']).optional().default('gemini'),
});

app.post('/start', requireAuth, zValidator('json', startSessionSchema), async (c) => {
  const userId = c.get('session').userId;
  const { topic, difficulty, mode, provider } = c.req.valid('json');

  // ... existing DO credit check ...

  // Log session start to D1 with new fields
  const sessionId = result.sessionId!;
  await c.env.DB.prepare(`
    INSERT INTO usage_sessions (
      id, user_id, started_at, topic, difficulty,
      mode, provider, initial_provider
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    userId,
    Date.now(),
    topic,
    difficulty,
    mode,
    provider,
    provider
  ).run();

  // ... rest of handler ...
});
```

**Code changes to `/api/session/end`:**

```typescript
// apps/api/worker/routes/session.ts (update endSession)

const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
  conversationId: z.string().optional(),
  disconnectCode: z.number().optional(),
  disconnectReason: z.string().optional(),
  messageCount: z.number().optional(),
  provider: z.enum(['gemini', 'openai']).optional(),
  providerSwitched: z.boolean().optional(),
});

app.post('/end', requireAuth, zValidator('json', endSessionSchema), async (c) => {
  const userId = c.get('session').userId;
  const {
    sessionId,
    conversationId,
    disconnectCode,
    disconnectReason,
    messageCount,
    provider,
    providerSwitched
  } = c.req.valid('json');

  // ... existing DO endSession call ...

  // Update session record with extended fields
  await c.env.DB.prepare(`
    UPDATE usage_sessions
    SET
      ended_at = ?,
      minutes_used = ?,
      end_reason = ?,
      conversation_id = ?,
      disconnect_code = ?,
      disconnect_reason = ?,
      message_count = ?,
      provider = ?,
      provider_switched_at = CASE WHEN ? = 1 THEN ? ELSE provider_switched_at END
    WHERE id = ?
  `).bind(
    Date.now(),
    result.minutesUsed ?? 0,
    disconnectCode ? 'disconnect' : 'user_ended',
    conversationId ?? null,
    disconnectCode ?? null,
    disconnectReason ?? null,
    messageCount ?? 0,
    provider ?? 'gemini',
    providerSwitched ? 1 : 0,
    providerSwitched ? Date.now() : null,
    sessionId
  ).run();

  // ... rest of handler ...
});
```

### Phase 3: Session Messages & Corrections Storage

**Status:** Planned
**Dependencies:** Phase 2 complete

**Tasks:**
1. Run migrations for `session_messages` and `session_corrections` tables
2. Update `/api/session/end` to accept and store messages array
3. Update `/api/session/end` to accept and store corrections array
4. Remove localStorage dependency from practice page
5. Add data migration for existing localStorage corrections (optional)

**Extended `/api/session/end` payload:**

```typescript
const endSessionSchema = z.object({
  sessionId: z.string().uuid(),
  // ... existing fields ...

  // NEW: Messages array
  messages: z.array(z.object({
    role: z.enum(['user', 'coach']),
    text: z.string(),
    timestamp: z.number(),
  })).optional(),

  // NEW: Corrections array
  corrections: z.array(z.object({
    original: z.string(),
    correction: z.string(),
    explanation: z.string().optional(),
    category: z.enum(['grammar', 'tone', 'vocabulary', 'word_order', 'pronunciation']).optional(),
  })).optional(),
});

// In handler:
if (messages && messages.length > 0) {
  const messageInserts = messages.map((msg, idx) => ({
    id: crypto.randomUUID(),
    session_id: sessionId,
    user_id: userId,
    role: msg.role,
    text: msg.text,
    timestamp: msg.timestamp,
    sequence_number: idx,
  }));

  // Batch insert messages
  const stmt = c.env.DB.prepare(`
    INSERT INTO session_messages (id, session_id, user_id, role, text, timestamp, sequence_number)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  await c.env.DB.batch(
    messageInserts.map(m => stmt.bind(m.id, m.session_id, m.user_id, m.role, m.text, m.timestamp, m.sequence_number))
  );
}

if (corrections && corrections.length > 0) {
  const correctionInserts = corrections.map(c => ({
    id: crypto.randomUUID(),
    session_id: sessionId,
    user_id: userId,
    original: c.original,
    correction: c.correction,
    explanation: c.explanation,
    category: c.category,
    created_at: Date.now(),
  }));

  const stmt = c.env.DB.prepare(`
    INSERT INTO session_corrections (id, session_id, user_id, original, correction, explanation, category, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  await c.env.DB.batch(
    correctionInserts.map(c => stmt.bind(c.id, c.session_id, c.user_id, c.original, c.correction, c.explanation, c.category, c.created_at))
  );
}
```

### Phase 4: Admin Dashboard & User Learning History

**Status:** Planned
**Dependencies:** Phase 3 complete

**Tasks:**
1. Create admin session health dashboard
2. Create user learning history page
3. Add correction review functionality
4. Add spaced repetition for reviewed corrections

---

## API Endpoints

### Existing Endpoints (Extended)

| Endpoint | Changes |
|----------|---------|
| `POST /api/session/start` | Add `mode`, `provider` params |
| `POST /api/session/end` | Add `disconnectCode`, `disconnectReason`, `messages[]`, `corrections[]` |

### New Endpoints

#### GET /api/learning/history

Get user's session history with messages and corrections:

```typescript
// Response
{
  success: true,
  data: {
    sessions: [
      {
        id: "uuid",
        startedAt: 1702000000000,
        endedAt: 1702000600000,
        topic: "food",
        difficulty: "intermediate",
        mode: "coach",
        provider: "gemini",
        messageCount: 12,
        correctionCount: 3,
      }
    ],
    pagination: {
      total: 25,
      page: 1,
      limit: 10,
    }
  }
}
```

#### GET /api/learning/session/:id

Get full session details including messages and corrections:

```typescript
// Response
{
  success: true,
  data: {
    session: { /* session details */ },
    messages: [
      { role: "user", text: "Xin chào", timestamp: 1702000000000 },
      { role: "coach", text: "Chào bạn! Bạn khỏe không?", timestamp: 1702000005000 },
    ],
    corrections: [
      {
        original: "Tôi muốn ăn phở",
        correction: "Em muốn ăn phở",
        explanation: "Use 'em' when speaking to someone older",
        category: "tone",
        reviewed: false,
      }
    ]
  }
}
```

#### GET /api/learning/corrections

Get all user corrections for review:

```typescript
// Query params: ?reviewed=false&category=grammar&limit=20

// Response
{
  success: true,
  data: {
    corrections: [
      {
        id: "uuid",
        sessionId: "uuid",
        original: "...",
        correction: "...",
        explanation: "...",
        category: "grammar",
        reviewed: false,
        createdAt: 1702000000000,
      }
    ],
    stats: {
      total: 45,
      reviewed: 20,
      byCategory: {
        grammar: 15,
        tone: 12,
        vocabulary: 10,
        word_order: 5,
        pronunciation: 3,
      }
    }
  }
}
```

#### PATCH /api/learning/corrections/:id

Mark correction as reviewed:

```typescript
// Request
{
  reviewed: true,
  confidenceLevel: 4  // 0-5 scale
}

// Response
{
  success: true,
  data: { id: "uuid", reviewed: true, reviewedAt: 1702000000000 }
}
```

#### GET /api/admin/sessions

Admin endpoint for session health monitoring:

```typescript
// Query params: ?from=date&to=date&provider=gemini&hasDisconnect=true

// Response
{
  success: true,
  data: {
    sessions: [
      {
        id: "uuid",
        userId: "uuid",
        userEmail: "user@example.com",
        startedAt: 1702000000000,
        endedAt: 1702000600000,
        provider: "gemini",
        providerSwitched: true,
        disconnectCode: 1006,
        disconnectReason: "Abnormal closure",
        messageCount: 8,
        minutesUsed: 5,
      }
    ],
    stats: {
      totalSessions: 150,
      avgDuration: 8.5,
      providerBreakdown: {
        gemini: 120,
        openai: 30,
      },
      disconnectBreakdown: {
        1000: 10,  // Normal closure
        1006: 5,   // Abnormal closure
        1011: 2,   // Server error
      },
      providerSwitchRate: 0.12,  // 12% of sessions switched
    }
  }
}
```

---

## Frontend Components

### Updated Practice Page Session End

```typescript
// In apps/web/src/routes/(app)/practice/+page.svelte

async function endSession() {
  // Clear heartbeat
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  // Disconnect from voice provider
  client?.disconnect();
  client = null;

  // End session on server with extended data
  if (sessionId) {
    try {
      const res = await fetch('/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          disconnectCode: lastDisconnectCode,
          disconnectReason: disconnectReason,
          messageCount: conversationHistory.length,
          provider: activeProvider,
          providerSwitched: initialProvider !== activeProvider,
          messages: sessionTranscript.map(m => ({
            role: m.role,
            text: m.text,
            timestamp: m.timestamp,
          })),
          corrections: corrections.map(c => ({
            original: c.original,
            correction: c.correction,
            explanation: c.explanation,
            category: c.category,
          })),
        }),
      });

      const data = await res.json();

      if (data.success) {
        // Update local state with server response
        usageStatus.minutesUsed = data.data.totalMinutesUsed;
        usageStatus.minutesRemaining = data.data.minutesRemaining;
      }
    } catch (err) {
      console.error('Failed to end session:', err);
    }
  }

  // ... reset state ...
}
```

### Learning History Page (New)

```svelte
<!-- apps/web/src/routes/(app)/learning/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let sessions = [];
  let loading = true;
  let selectedSession = null;
  let sessionDetails = null;

  onMount(async () => {
    const res = await fetch('/api/learning/history');
    const data = await res.json();
    sessions = data.data.sessions;
    loading = false;
  });

  async function viewSession(id: string) {
    const res = await fetch(`/api/learning/session/${id}`);
    const data = await res.json();
    sessionDetails = data.data;
    selectedSession = id;
  }
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Learning History</h1>

  {#if loading}
    <p>Loading...</p>
  {:else}
    <div class="grid md:grid-cols-2 gap-6">
      <!-- Session List -->
      <div class="space-y-4">
        {#each sessions as session}
          <button
            class="w-full text-left p-4 rounded-lg border hover:border-primary transition-colors"
            class:border-primary={selectedSession === session.id}
            onclick={() => viewSession(session.id)}
          >
            <div class="flex justify-between items-start">
              <div>
                <p class="font-medium">{session.topic}</p>
                <p class="text-sm text-muted-foreground">
                  {new Date(session.startedAt).toLocaleDateString()}
                </p>
              </div>
              <div class="text-right">
                <span class="text-xs px-2 py-1 rounded bg-muted">
                  {session.mode}
                </span>
                {#if session.correctionCount > 0}
                  <p class="text-sm text-amber-600 mt-1">
                    {session.correctionCount} corrections
                  </p>
                {/if}
              </div>
            </div>
          </button>
        {/each}
      </div>

      <!-- Session Details -->
      {#if sessionDetails}
        <div class="border rounded-lg p-4">
          <h2 class="font-semibold mb-4">Conversation</h2>

          <div class="space-y-3 max-h-96 overflow-y-auto">
            {#each sessionDetails.messages as msg}
              <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[80%] p-3 rounded-lg {msg.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'}">
                  {msg.text}
                </div>
              </div>
            {/each}
          </div>

          {#if sessionDetails.corrections.length > 0}
            <h2 class="font-semibold mt-6 mb-4">Corrections</h2>
            <div class="space-y-3">
              {#each sessionDetails.corrections as correction}
                <div class="p-3 border rounded-lg">
                  <p class="text-red-600 line-through">{correction.original}</p>
                  <p class="text-green-600">{correction.correction}</p>
                  {#if correction.explanation}
                    <p class="text-sm text-muted-foreground mt-1">{correction.explanation}</p>
                  {/if}
                </div>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
    </div>
  {/if}
</div>
```

---

## Admin Dashboard

### Session Health Overview

```svelte
<!-- apps/web/src/routes/(app)/admin/sessions/+page.svelte -->
<script lang="ts">
  import { onMount } from 'svelte';

  let stats = null;
  let sessions = [];
  let filters = {
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    to: new Date().toISOString().split('T')[0],
    provider: '',
    hasDisconnect: false,
  };

  async function loadData() {
    const params = new URLSearchParams({
      from: filters.from,
      to: filters.to,
      ...(filters.provider && { provider: filters.provider }),
      ...(filters.hasDisconnect && { hasDisconnect: 'true' }),
    });

    const res = await fetch(`/api/admin/sessions?${params}`);
    const data = await res.json();
    stats = data.data.stats;
    sessions = data.data.sessions;
  }

  onMount(loadData);
</script>

<div class="container mx-auto px-4 py-8">
  <h1 class="text-2xl font-bold mb-6">Session Health Monitor</h1>

  {#if stats}
    <!-- Stats Overview -->
    <div class="grid grid-cols-4 gap-4 mb-8">
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-sm text-muted-foreground">Total Sessions</p>
        <p class="text-2xl font-bold">{stats.totalSessions}</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-sm text-muted-foreground">Avg Duration</p>
        <p class="text-2xl font-bold">{stats.avgDuration.toFixed(1)} min</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-sm text-muted-foreground">Provider Switch Rate</p>
        <p class="text-2xl font-bold">{(stats.providerSwitchRate * 100).toFixed(1)}%</p>
      </div>
      <div class="bg-white rounded-lg shadow p-4">
        <p class="text-sm text-muted-foreground">Gemini vs OpenAI</p>
        <p class="text-2xl font-bold">
          {stats.providerBreakdown.gemini} / {stats.providerBreakdown.openai}
        </p>
      </div>
    </div>

    <!-- Disconnect Breakdown -->
    <div class="bg-white rounded-lg shadow p-4 mb-8">
      <h2 class="font-semibold mb-4">Disconnect Codes</h2>
      <div class="grid grid-cols-5 gap-2">
        {#each Object.entries(stats.disconnectBreakdown) as [code, count]}
          <div class="text-center p-2 bg-muted rounded">
            <p class="text-sm font-mono">{code}</p>
            <p class="text-lg font-bold">{count}</p>
            <p class="text-xs text-muted-foreground">
              {getDisconnectLabel(code)}
            </p>
          </div>
        {/each}
      </div>
    </div>
  {/if}

  <!-- Filters -->
  <div class="flex gap-4 mb-4">
    <input type="date" bind:value={filters.from} onchange={loadData} />
    <input type="date" bind:value={filters.to} onchange={loadData} />
    <select bind:value={filters.provider} onchange={loadData}>
      <option value="">All Providers</option>
      <option value="gemini">Gemini</option>
      <option value="openai">OpenAI</option>
    </select>
    <label>
      <input type="checkbox" bind:checked={filters.hasDisconnect} onchange={loadData} />
      Has Disconnect
    </label>
  </div>

  <!-- Sessions Table -->
  <table class="w-full">
    <thead>
      <tr class="border-b">
        <th class="text-left p-2">User</th>
        <th class="text-left p-2">Time</th>
        <th class="text-left p-2">Duration</th>
        <th class="text-left p-2">Provider</th>
        <th class="text-left p-2">Disconnect</th>
        <th class="text-left p-2">Messages</th>
      </tr>
    </thead>
    <tbody>
      {#each sessions as session}
        <tr class="border-b hover:bg-muted/50">
          <td class="p-2">{session.userEmail}</td>
          <td class="p-2">{new Date(session.startedAt).toLocaleString()}</td>
          <td class="p-2">{session.minutesUsed} min</td>
          <td class="p-2">
            <span class="px-2 py-1 rounded text-xs {session.provider === 'gemini' ? 'bg-blue-100' : 'bg-green-100'}">
              {session.provider}
            </span>
            {#if session.providerSwitched}
              <span class="ml-1 text-amber-600">switched</span>
            {/if}
          </td>
          <td class="p-2">
            {#if session.disconnectCode}
              <span class="text-red-600">{session.disconnectCode}</span>
            {:else}
              <span class="text-green-600">Clean</span>
            {/if}
          </td>
          <td class="p-2">{session.messageCount}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>
```

---

## WebSocket Close Code Reference

Common disconnect codes to track and their meanings:

| Code | Meaning | Common Cause |
|------|---------|--------------|
| 1000 | Normal closure | User ended session properly |
| 1001 | Going away | Browser tab closed, navigation |
| 1006 | Abnormal closure | Network issue, server timeout |
| 1011 | Server error | API error on provider side |
| 1012 | Service restart | Provider redeploying |
| 1013 | Try again later | Provider rate limiting |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | Dec 2024 | Initial spec - session health tracking & learning history |

---

*This document extends the Speak Pho Real Durable Objects architecture with session health monitoring and user learning history features.*
