# Tasks: Session Health & Conversation History

## Overview

Extend the usage tracking system to provide admin visibility into session performance and provider reliability, while giving users persistent access to their voice conversation history and corrections across devices.

**Total Tasks:** 7 Task Groups (39 sub-tasks)

**Prerequisites:**
- The `usage_sessions` table from the Real-Time AI Usage Management spec must exist
- Phase 1 (Try OpenAI button) is already completed in the practice page

---

## Task List

### Database Layer

#### Task Group 1: Schema Extensions & Migrations
**Dependencies:** None
**Assignee:** database-engineer

- [x] 1.0 Complete database schema extensions
  - [x] 1.1 Write 4-6 focused tests for schema and migration functionality
    - Test that extended `usage_sessions` columns accept valid enum values (provider, mode)
    - Test that `session_messages` table correctly stores and retrieves messages with sequence ordering
    - Test that `session_corrections` table correctly stores corrections with category enum
    - Test indexes are created and improve query performance on key columns
  - [x] 1.2 Extend `usage_sessions` table in Drizzle schema
    - Add `provider` column (TEXT, enum: 'gemini', 'openai', default 'gemini')
    - Add `initialProvider` column (TEXT)
    - Add `providerSwitchedAt` column (INTEGER timestamp)
    - Add `disconnectCode` column (INTEGER)
    - Add `disconnectReason` column (TEXT)
    - Add `mode` column (TEXT, enum: 'free', 'coach')
    - Add `messageCount` column (INTEGER, default 0)
    - File: `apps/web/src/lib/server/database/schema.ts`
  - [x] 1.3 Create `sessionMessages` table in Drizzle schema
    - Columns: id (TEXT PK), sessionId (TEXT FK), userId (TEXT), role (TEXT enum), text (TEXT), timestamp (INTEGER), sequenceNumber (INTEGER)
    - Follow existing schema patterns from `usageSessions` and `usagePeriods`
    - File: `apps/web/src/lib/server/database/schema.ts`
  - [x] 1.4 Create `sessionCorrections` table in Drizzle schema
    - Columns: id, sessionId, userId, original, correction, explanation, category (enum), reviewed (boolean), reviewedAt (timestamp), confidenceLevel (0-5), createdAt
    - File: `apps/web/src/lib/server/database/schema.ts`
  - [x] 1.5 Export TypeScript types for new tables
    - Export `SessionMessage`, `NewSessionMessage` via `$inferSelect` and `$inferInsert`
    - Export `SessionCorrection`, `NewSessionCorrection` via `$inferSelect` and `$inferInsert`
  - [x] 1.6 Generate and run database migrations
    - Run `pnpm --filter web run generate` to create migration SQL
    - Review generated migration files in `apps/web/drizzle/migrations/`
    - Run `pnpm --filter web run migrate:prod` to apply to production D1
    - Verify tables created: `pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT name FROM sqlite_master WHERE type='table';"`
  - [x] 1.7 Add indexes for admin queries
    - Index on `usage_sessions(provider)`
    - Index on `usage_sessions(disconnect_code)`
    - Index on `usage_sessions(mode)`
    - Index on `session_messages(session_id)`, `session_messages(user_id)`, `session_messages(timestamp)`
    - Index on `session_corrections(session_id)`, `session_corrections(user_id)`, `session_corrections(category)`, `session_corrections(reviewed)`
  - [x] 1.8 Ensure database layer tests pass
    - Run ONLY the 4-6 tests written in 1.1
    - Verify migrations run successfully
    - Do NOT run the entire test suite at this stage

**Acceptance Criteria:**
- The 4-6 tests written in 1.1 pass
- Schema types are exported correctly
- Migrations run without errors
- Tables and indexes are created in D1

---

### API Layer

#### Task Group 2: Extend Session API Endpoints
**Dependencies:** Task Group 1
**Assignee:** api-engineer

- [x] 2.0 Extend session start and end API endpoints
  - [x] 2.1 Write 4-6 focused tests for extended session API
    - Test POST /api/session/start accepts and stores `mode` and `provider` params
    - Test POST /api/session/end accepts and stores disconnect info (code, reason, messageCount)
    - Test POST /api/session/end correctly batch inserts messages array
    - Test POST /api/session/end correctly batch inserts corrections array
  - [x] 2.2 Update usage service types for extended parameters
    - Add `mode` and `provider` to `SessionStartOptions` interface
    - Add `disconnectCode`, `disconnectReason`, `messageCount`, `provider`, `providerSwitched`, `messages`, `corrections` to end session options
    - File: `apps/web/src/lib/services/usage.ts`
  - [x] 2.3 Extend POST /api/session/start proxy endpoint
    - Accept new parameters: `mode` (enum: 'free', 'coach'), `provider` (enum: 'gemini', 'openai')
    - Pass these to API worker in request body
    - File: `apps/web/src/routes/api/session/start/+server.ts`
  - [x] 2.4 Extend POST /api/session/end proxy endpoint
    - Accept new parameters: `disconnectCode`, `disconnectReason`, `messageCount`, `provider`, `providerSwitched`
    - Accept `messages[]` array with objects containing `role`, `text`, `timestamp`
    - Accept `corrections[]` array with objects containing `original`, `correction`, `explanation`, `category`
    - Pass all data to API worker in request body
    - File: `apps/web/src/routes/api/session/end/+server.ts`
  - [x] 2.5 Update API worker session handlers (if applicable)
    - Ensure API worker stores extended fields in `usage_sessions` table
    - Implement batch insert for `session_messages` with sequence numbers
    - Implement batch insert for `session_corrections` with generated UUIDs
    - Files: `apps/api/worker/routes/session.ts`
  - [x] 2.6 Ensure extended API tests pass
    - Run ONLY the 4-6 tests written in 2.1
    - Verify session start records mode and provider
    - Verify session end records disconnect info and stores messages/corrections

**Acceptance Criteria:**
- The 4-6 tests written in 2.1 pass
- Session start accepts and stores mode/provider
- Session end accepts and stores all extended data
- Messages and corrections are batch inserted correctly

---

#### Task Group 3: Create New API Endpoints
**Dependencies:** Task Group 2
**Assignee:** api-engineer

- [x] 3.0 Create conversation and corrections API endpoints
  - [x] 3.1 Write 4-6 focused tests for new API endpoints
    - Test GET /api/conversations returns paginated user sessions with correction counts
    - Test GET /api/conversations/:id returns full session with messages and corrections
    - Test GET /api/review/corrections returns filtered corrections with stats
    - Test PATCH /api/review/corrections/:id updates reviewed status
  - [x] 3.2 Create GET /api/conversations endpoint
    - Require authentication via `locals.user` check
    - Return paginated list with: id, startedAt, endedAt, topic, difficulty, mode, provider, messageCount, correctionCount
    - Support `page` and `limit` query parameters (default: page=1, limit=10)
    - Include aggregated correctionCount from joined session_corrections
    - Order by startedAt descending
    - File: `apps/web/src/routes/api/conversations/+server.ts`
  - [x] 3.3 Create GET /api/conversations/[id] endpoint
    - Require authentication and verify session belongs to requesting user
    - Return full session details including all messages and corrections arrays
    - Messages ordered by sequenceNumber ascending
    - Corrections include all fields for display
    - File: `apps/web/src/routes/api/conversations/[id]/+server.ts`
  - [x] 3.4 Create GET /api/review/corrections endpoint
    - Return all user corrections with filtering: `reviewed`, `category`, `limit` query params
    - Include stats: total, reviewed count, byCategory breakdown
    - Support pagination
    - Order by createdAt descending
    - File: `apps/web/src/routes/api/review/corrections/+server.ts`
  - [x] 3.5 Create PATCH /api/review/corrections/[id] endpoint
    - Accept `reviewed` (boolean) and `confidenceLevel` (0-5) in request body
    - Update correction record with reviewed, reviewedAt timestamp, confidenceLevel
    - Verify correction belongs to authenticated user before updating
    - Return updated correction with new reviewedAt timestamp
    - File: `apps/web/src/routes/api/review/corrections/[id]/+server.ts`
  - [x] 3.6 Create GET /api/admin/sessions endpoint
    - Restrict to admin users via role check (`locals.user.role === 'admin'`)
    - Support date range filtering via `from` and `to` query params
    - Support filtering by `provider` and `hasDisconnect` boolean
    - Return session list with user email joined from user table
    - Calculate aggregate stats: totalSessions, avgDuration, providerBreakdown, disconnectBreakdown, providerSwitchRate
    - File: `apps/web/src/routes/api/admin/sessions/+server.ts`
  - [x] 3.7 Ensure new API endpoint tests pass
    - Run ONLY the 4-6 tests written in 3.1
    - Verify all endpoints return correct data format
    - Verify authentication and authorization work correctly

**Acceptance Criteria:**
- The 4-6 tests written in 3.1 pass
- All new endpoints follow existing API patterns (json response, error handling)
- Pagination works correctly
- Admin endpoint restricted to admin role

---

### Frontend - User Pages

#### Task Group 4: User Conversation History & Review Pages
**Dependencies:** Task Group 3
**Assignee:** ui-designer

- [x] 4.0 Create user-facing conversation and corrections review pages
  - [x] 4.1 Write 3-5 focused tests for frontend components
    - Test conversations page loads and displays session list
    - Test session detail panel displays messages in correct order
    - Test corrections review page filters work correctly
    - Test marking correction as reviewed updates UI
  - [x] 4.2 Create /conversations page route
    - Add route at `apps/web/src/routes/(app)/conversations/+page.svelte`
    - Create corresponding `+page.server.ts` for authentication check
    - Display paginated session list in left column
    - Show topic, date, mode badge, and correction count for each session
    - File: `apps/web/src/routes/(app)/conversations/+page.svelte`
  - [x] 4.3 Implement session detail panel
    - Show selected session details in right panel
    - Display full conversation transcript with user/coach styling
    - Reuse existing `.transcript-card`, `.viet-text` CSS classes from practice page
    - Display corrections below transcript with original/corrected text, explanation, and category badge
  - [x] 4.4 Create /review/corrections page route
    - Add route at `apps/web/src/routes/(app)/review/corrections/+page.svelte`
    - Display filterable list of all corrections across sessions
    - Include category filter tabs (grammar, tone, vocabulary, word_order, pronunciation)
    - Show reviewed/unreviewed toggle filter
    - File: `apps/web/src/routes/(app)/review/corrections/+page.svelte`
  - [x] 4.5 Implement correction review functionality
    - Allow marking corrections as reviewed with confidence level (0-5)
    - Show correction stats at top of page
    - Use existing card styling patterns from admin dashboard
    - Display correction category badge with appropriate colors
  - [x] 4.6 Add navigation links to new pages
    - Add "Conversations" and "Review" links to app navigation
    - Update any relevant layout files
  - [x] 4.7 Ensure frontend tests pass
    - Run ONLY the 3-5 tests written in 4.1
    - Verify pages load correctly
    - Verify interactions work as expected

**Acceptance Criteria:**
- The 3-5 tests written in 4.1 pass
- Conversations page displays session history correctly
- Review page allows filtering and marking corrections
- UI follows existing design patterns (Tailwind, bits-ui)

---

### Frontend - Admin Dashboard

#### Task Group 5: Admin Session Health Dashboard
**Dependencies:** Task Group 3
**Assignee:** ui-designer

- [x] 5.0 Create admin session health monitoring dashboard
  - [x] 5.1 Write 2-4 focused tests for admin dashboard
    - Test admin page loads with stats cards
    - Test filtering by date range works
    - Test sessions table displays correct data
  - [x] 5.2 Create /admin/sessions page route
    - Add route at `apps/web/src/routes/(app)/admin/sessions/+page.svelte`
    - Create corresponding `+page.server.ts` with admin role check
    - Redirect non-admin users to appropriate page
    - File: `apps/web/src/routes/(app)/admin/sessions/+page.svelte`
  - [x] 5.3 Implement stats cards grid
    - Display: Total Sessions, Avg Duration, Provider Switch Rate, Gemini/OpenAI breakdown
    - Reuse `.stat-card` CSS patterns from existing admin dashboard
    - Use appropriate icons from lucide-svelte
  - [x] 5.4 Implement disconnect codes breakdown
    - Show disconnect codes with counts and human-readable labels
    - Labels: 1000=Normal, 1001=Going Away, 1006=Abnormal, 1011=Server Error, 1012=Service Restart, 1013=Try Again Later
    - Use visual indicators for severity
  - [x] 5.5 Implement filter controls
    - Date range filter inputs (from/to)
    - Provider dropdown filter (All, Gemini, OpenAI)
    - Has Disconnect checkbox filter
  - [x] 5.6 Implement sessions table
    - Columns: User (email), Time, Duration, Provider (with switch indicator), Disconnect Code, Messages
    - Sortable by time
    - Show provider switch indicator where applicable
    - Color-code disconnect codes (green for clean, red for errors)
  - [x] 5.7 Ensure admin dashboard tests pass
    - Run ONLY the 2-4 tests written in 5.1
    - Verify stats display correctly
    - Verify filtering works

**Acceptance Criteria:**
- The 2-4 tests written in 5.1 pass
- Admin dashboard shows session health metrics
- Filtering and table display work correctly
- Non-admin users cannot access the page

---

### Practice Page Updates

#### Task Group 6: Update Practice Page Session Flow
**Dependencies:** Task Groups 2, 3
**Assignee:** frontend-engineer

- [x] 6.0 Update practice page to send extended session data
  - [x] 6.1 Write 2-3 focused tests for practice page updates
    - Test endSession sends messages array in correct format
    - Test endSession sends corrections array in correct format
    - Test endSession sends disconnect info (code, reason, provider)
  - [x] 6.2 Add provider tracking state
    - Track `initialProvider` state variable
    - Set `initialProvider` when session starts
    - Track if provider switched during session
    - File: `apps/web/src/routes/(app)/practice/+page.svelte`
  - [x] 6.3 Update startSession function
    - Pass `mode` and `provider` parameters to API
    - Store `initialProvider` for comparison at session end
    - Update `startUsageSession` call with new parameters
  - [x] 6.4 Update endSession function
    - Include `messages` array from `sessionTranscript` state
    - Include `corrections` array from extracted corrections
    - Include `disconnectCode` and `disconnectReason` values
    - Include `provider` (current) and calculate `providerSwitched`
    - Include `messageCount` from conversation history length
    - Update `endUsageSession` call with new payload
  - [x] 6.5 Remove localStorage dependency
    - Remove localStorage save from `saveCorrections()` function
    - Data now persisted server-side via session end API
    - Update `closeSummary()` to not call saveCorrections
  - [x] 6.6 Update usage service function signatures
    - Update `startSession` to accept mode/provider
    - Update `endSession` to accept extended payload
    - File: `apps/web/src/lib/services/usage.ts`
  - [x] 6.7 Ensure practice page tests pass
    - Run ONLY the 2-3 tests written in 6.1
    - Verify session data is sent correctly

**Acceptance Criteria:**
- The 2-3 tests written in 6.1 pass
- Practice page sends complete session data on end
- localStorage dependency removed
- Provider tracking works correctly

---

### Testing & Verification

#### Task Group 7: Test Review & Gap Analysis
**Dependencies:** Task Groups 1-6
**Assignee:** qa-engineer

- [x] 7.0 Review existing tests and fill critical gaps only
  - [x] 7.1 Review tests from Task Groups 1-6
    - Review the 4-6 tests written by database-engineer (Task 1.1) - Found 15 tests
    - Review the 4-6 tests written for extended API (Task 2.1) - Found 6 tests
    - Review the 4-6 tests written for new API endpoints (Task 3.1) - Found 9 tests
    - Review the 3-5 tests written for user pages (Task 4.1) - Found 5 tests
    - Review the 2-4 tests written for admin dashboard (Task 5.1) - Found 4 tests
    - Review the 2-3 tests written for practice page (Task 6.1) - Found 4 tests
    - Total existing tests: 43 tests (plus 18 usage service utility tests)
  - [x] 7.2 Analyze test coverage gaps for THIS feature only
    - Identified critical user workflows that lacked test coverage
    - Focused on gaps related to this spec's feature requirements
    - Prioritized end-to-end workflows over unit test gaps
  - [x] 7.3 Write up to 8 additional strategic tests maximum
    - Added 7 new integration tests to fill identified critical gaps
    - Priority areas covered:
      - End-to-end: User completes session and data appears in conversations page (2 tests)
      - End-to-end: Admin views session health with provider switch data (2 tests)
      - Integration: Correction review workflow updates database correctly (2 tests)
      - Integration: Session detail with full transcript (1 test)
    - File: `apps/web/src/test/integration/session-health-feature.test.ts`
  - [x] 7.4 Run feature-specific tests only
    - Ran tests related to this spec's feature
    - Final total: 68 tests (62 web + 6 API)
    - All tests passed
    - Command: `pnpm exec vitest run src/lib/server/database/usage.test.ts src/routes/api/conversations/conversations.test.ts src/routes/(app)/conversations/conversations-page.test.ts src/routes/(app)/admin/sessions/admin-sessions.test.ts src/routes/(app)/practice/practice-session.test.ts src/lib/services/usage.test.ts src/test/integration/session-health-feature.test.ts`

**Acceptance Criteria:**
- [x] All feature-specific tests pass (68 tests total)
- [x] Critical user workflows for this feature are covered
- [x] Only 7 additional tests added (under the 8 maximum)
- [x] Testing focused exclusively on this spec's feature requirements

---

## Execution Order

Recommended implementation sequence:

1. **Database Layer (Task Group 1)** - Schema and migrations must be in place first
2. **API Layer - Extensions (Task Group 2)** - Extend existing session endpoints
3. **API Layer - New Endpoints (Task Group 3)** - Create new API endpoints
4. **Practice Page Updates (Task Group 6)** - Can start after API extensions done
5. **Frontend - User Pages (Task Group 4)** - Depends on new API endpoints
6. **Frontend - Admin Dashboard (Task Group 5)** - Can run parallel with Task Group 4
7. **Testing & Verification (Task Group 7)** - Final validation

```
Task Group 1 (Database)
       |
       v
Task Group 2 (API Extensions)
       |
       +-----------------+
       |                 |
       v                 v
Task Group 3        Task Group 6
(New APIs)          (Practice Page)
       |
       +-----------------+
       |                 |
       v                 v
Task Group 4        Task Group 5
(User Pages)        (Admin Dashboard)
       |                 |
       +-----------------+
                |
                v
        Task Group 7 (Testing)
```

---

## File Reference

### Files to Create
- `apps/web/src/routes/api/conversations/+server.ts`
- `apps/web/src/routes/api/conversations/[id]/+server.ts`
- `apps/web/src/routes/api/review/corrections/+server.ts`
- `apps/web/src/routes/api/review/corrections/[id]/+server.ts`
- `apps/web/src/routes/api/admin/sessions/+server.ts`
- `apps/web/src/routes/(app)/conversations/+page.svelte`
- `apps/web/src/routes/(app)/conversations/+page.server.ts`
- `apps/web/src/routes/(app)/review/corrections/+page.svelte`
- `apps/web/src/routes/(app)/review/corrections/+page.server.ts`
- `apps/web/src/routes/(app)/admin/sessions/+page.svelte`
- `apps/web/src/routes/(app)/admin/sessions/+page.server.ts`

### Files to Modify
- `apps/web/src/lib/server/database/schema.ts` - Add new tables and extend usageSessions
- `apps/web/src/lib/services/usage.ts` - Update types and function signatures
- `apps/web/src/routes/api/session/start/+server.ts` - Extend with new params
- `apps/web/src/routes/api/session/end/+server.ts` - Extend with new params
- `apps/web/src/routes/(app)/practice/+page.svelte` - Update session flow

### Migrations
- Migration to extend `usage_sessions` table
- Migration to create `session_messages` table
- Migration to create `session_corrections` table

---

## Notes

- **Out of Scope:** Spaced repetition, export functionality, audio playback, ML analysis, third-party integrations, bulk delete, push notifications, offline access
- **Phase 1 (Try OpenAI Button):** Already completed - disconnect UI with provider fallback exists
- **Testing Philosophy:** Focus on critical paths per project standards; 2-8 tests per task group
