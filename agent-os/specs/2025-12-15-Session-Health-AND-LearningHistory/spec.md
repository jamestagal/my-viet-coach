# Specification: Session Health & Conversation History

## Goal
Extend the usage tracking system to provide admin visibility into session performance and provider reliability, while giving users persistent access to their voice conversation history and corrections across devices.

## User Stories
- As an admin, I want to monitor session health metrics (disconnections, provider switches, error rates) so that I can identify and resolve system issues proactively.
- As a learner, I want to review my past conversation sessions and corrections so that I can reinforce my learning without relying on browser localStorage.

## Specific Requirements

**Prerequisite: Real-Time AI Usage Management Spec**
- This spec depends on the `usage_sessions` table created by the Real-Time AI Usage Management spec
- The base `usage_sessions` table must exist with columns: `id`, `user_id`, `started_at`, `ended_at`, `minutes_used`, `topic`, `difficulty`, `end_reason`, `conversation_id`
- Durable Objects infrastructure must be deployed for real-time credit tracking

**Extend usage_sessions Table with Health Tracking Columns**
- Add `provider` column (TEXT, enum: 'gemini', 'openai', default 'gemini') to track which voice AI provider was used
- Add `initial_provider` column (TEXT) to record starting provider before any fallback
- Add `provider_switched_at` column (INTEGER timestamp) to record when provider fallback occurred
- Add `disconnect_code` column (INTEGER) to store WebSocket close codes (1000, 1006, 1011, etc.)
- Add `disconnect_reason` column (TEXT) for human-readable disconnect explanation
- Add `mode` column (TEXT, enum: 'free', 'coach') to track practice mode
- Add `message_count` column (INTEGER, default 0) for conversation length metrics
- Create indexes on `provider`, `disconnect_code`, and `mode` columns for admin queries

**Create session_messages Table**
- Store conversation history with columns: `id` (TEXT PK), `session_id` (TEXT FK), `user_id` (TEXT), `role` (TEXT enum: 'user', 'coach'), `text` (TEXT), `timestamp` (INTEGER), `sequence_number` (INTEGER)
- Create indexes on `session_id`, `user_id`, and `timestamp` for efficient queries
- Use UUIDs for primary keys generated via `crypto.randomUUID()`
- Foreign key reference to `usage_sessions(id)` (logical only, SQLite does not enforce)

**Create session_corrections Table**
- Store learning corrections with columns: `id`, `session_id`, `user_id`, `original` (TEXT), `correction` (TEXT), `explanation` (TEXT), `category` (TEXT enum: grammar, tone, vocabulary, word_order, pronunciation)
- Add learning tracking columns: `reviewed` (INTEGER boolean, default 0), `reviewed_at` (INTEGER timestamp), `confidence_level` (INTEGER 0-5 scale)
- Include `created_at` timestamp column
- Create indexes on `session_id`, `user_id`, `category`, and `reviewed` columns

**Extend POST /api/session/start Endpoint**
- Accept new parameters: `mode` (enum: 'free', 'coach'), `provider` (enum: 'gemini', 'openai')
- Insert session record with `mode`, `provider`, and `initial_provider` columns populated
- Maintain existing Durable Objects credit check and session reservation logic
- Return `sessionId` in response for client-side tracking

**Extend POST /api/session/end Endpoint**
- Accept new parameters: `disconnectCode`, `disconnectReason`, `messageCount`, `provider`, `providerSwitched`
- Accept `messages` array with objects containing `role`, `text`, `timestamp`
- Accept `corrections` array with objects containing `original`, `correction`, `explanation`, `category`
- Batch insert messages into `session_messages` table with sequence numbers
- Batch insert corrections into `session_corrections` table with generated UUIDs
- Update `usage_sessions` with disconnect info and final provider state

**Create GET /api/conversations Endpoint**
- Require authentication via `locals.session` check
- Return paginated list of user's voice sessions with: `id`, `startedAt`, `endedAt`, `topic`, `difficulty`, `mode`, `provider`, `messageCount`, `correctionCount`
- Support pagination via `page` and `limit` query parameters
- Include aggregated `correctionCount` from joined `session_corrections` table
- Order by `startedAt` descending (most recent first)

**Create GET /api/conversations/:id Endpoint**
- Require authentication and verify session belongs to requesting user
- Return full session details including all `messages` and `corrections` arrays
- Messages ordered by `sequence_number` ascending
- Corrections include all fields for display and review functionality

**Create GET /api/review/corrections Endpoint**
- Return all user corrections with filtering support via query params: `reviewed`, `category`, `limit`
- Include aggregated statistics: `total`, `reviewed` count, `byCategory` breakdown
- Support pagination for large correction lists
- Order by `created_at` descending for review workflow

**Create PATCH /api/review/corrections/:id Endpoint**
- Accept `reviewed` (boolean) and `confidenceLevel` (0-5) in request body
- Update correction record with `reviewed`, `reviewed_at` timestamp, and `confidence_level`
- Verify correction belongs to authenticated user before updating
- Return updated correction with new `reviewed_at` timestamp

**Create GET /api/admin/sessions Endpoint**
- Restrict to admin users via role check (`user.role === 'admin'`)
- Support date range filtering via `from` and `to` query params
- Support filtering by `provider` and `hasDisconnect` boolean
- Return session list with user email joined from `user` table
- Calculate aggregate stats: `totalSessions`, `avgDuration`, `providerBreakdown`, `disconnectBreakdown`, `providerSwitchRate`

**Create User Conversation History Page**
- Create route at `/conversations` within authenticated `(app)` route group
- Display paginated session list in left column with topic, date, mode badge, correction count
- Show selected session details in right panel with full conversation transcript
- Display corrections below transcript with original/corrected text, explanation, and category badge
- Use existing transcript card styling from practice page (`.transcript-card`, `.viet-text` classes)

**Create Corrections Review Page**
- Create route at `/review/corrections` within authenticated `(app)` route group
- Display filterable list of all corrections across sessions for dedicated review workflow
- Include category filter tabs (grammar, tone, vocabulary, word_order, pronunciation)
- Show reviewed/unreviewed toggle filter
- Allow marking corrections as reviewed with confidence level (0-5)

**Create Admin Session Health Dashboard**
- Create route at `/admin/sessions` within admin route group
- Display stats cards grid: Total Sessions, Avg Duration, Provider Switch Rate, Gemini/OpenAI breakdown
- Show disconnect codes breakdown with counts and human-readable labels (1000=Normal, 1006=Abnormal, 1011=Server Error)
- Include date range filter inputs and provider/disconnect filter dropdowns
- Display sessions table with columns: User, Time, Duration, Provider (with switch indicator), Disconnect Code, Messages

**Update Practice Page Session End Flow**
- Modify `endSession()` function to include new data in POST body
- Send `messages` array from `sessionTranscript` state
- Send `corrections` array from extracted corrections
- Include `disconnectCode`, `disconnectReason`, `provider`, and `providerSwitched` values
- Remove localStorage save from `saveCorrections()` function (replaced by server storage)

## Existing Code to Leverage

**`apps/web/src/lib/server/database/schema.ts`**
- Contains existing Drizzle table definitions for `user`, `session`, `account`, `verification`, `product`, `subscription`
- Follow same patterns: `sqliteTable`, `text().primaryKey()`, `integer({ mode: 'timestamp' })`, `references()`
- Export TypeScript types via `$inferSelect` and `$inferInsert`

**`apps/web/src/routes/(app)/practice/+page.svelte`**
- Contains `sessionTranscript` state array with `TranscriptMessage[]` type for messages
- Contains `corrections` state array with `CorrectionRecord[]` type for corrections
- Contains `endSession()` function that currently calls `/api/private/extract-corrections`
- Has styling for `.transcript-card`, `.correction-card`, `.viet-text` CSS classes to reuse

**`apps/web/src/routes/api/private/extract-corrections/+server.ts`**
- Shows pattern for authenticated POST endpoints with JSON body parsing
- Uses Gemini API for correction extraction - keep this for real-time extraction
- Response includes `corrections` array and `sessionSummary` object

**`apps/web/src/routes/(app)/admin/dashboard/+page.svelte`**
- Provides admin dashboard layout pattern with stats grid, charts, and activity list
- Uses `.stat-card`, `.chart-card`, `.activity-list` CSS component patterns
- Shows admin-specific data fetching and display patterns

**`apps/web/src/routes/(app)/+layout.server.ts`**
- Shows authentication check pattern with `locals.user` and `locals.session`
- Demonstrates redirect to `/login` for unauthenticated users
- Pattern for returning user data to authenticated layouts

## Out of Scope
- Spaced repetition algorithm for correction review scheduling
- Export/download functionality for conversation history
- Audio playback of recorded session conversations
- Real-time collaborative correction review between users
- Machine learning analysis of correction patterns
- Integration with third-party flashcard apps (Anki, etc.)
- Bulk delete or archive functionality for old sessions
- Correction sharing or social features
- Push notifications for review reminders
- Offline access to conversation history
