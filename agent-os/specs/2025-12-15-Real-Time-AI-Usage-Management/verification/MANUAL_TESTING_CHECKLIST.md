# Manual Testing Checklist: Real-Time AI Usage Management

## Overview

This checklist covers manual verification of the Real-Time AI Usage Management feature after deployment. Use this to verify end-to-end functionality in a staging or production environment.

## Pre-Deployment Checklist

### Environment Setup

- [ ] D1 migration has been applied:
  ```bash
  pnpm wrangler d1 execute noi-hay-db --remote --file=./drizzle/xxxx_add_usage_tracking.sql
  ```
- [ ] Verify tables exist:
  ```bash
  pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"
  ```
- [ ] Verify `usage_periods` table schema:
  ```bash
  pnpm wrangler d1 execute noi-hay-db --remote --command "PRAGMA table_info(usage_periods);"
  ```
- [ ] Verify `usage_sessions` table schema:
  ```bash
  pnpm wrangler d1 execute noi-hay-db --remote --command "PRAGMA table_info(usage_sessions);"
  ```

### API Worker Deployment

- [ ] Deploy API Worker with Durable Object:
  ```bash
  cd apps/api && pnpm wrangler deploy
  ```
- [ ] Verify Durable Object binding is active in Cloudflare dashboard
- [ ] Environment variables set:
  - [ ] `INTERNAL_API_SECRET` configured in API Worker
  - [ ] `OPENAI_API_KEY` configured

### Web App Deployment

- [ ] Deploy web app:
  ```bash
  pnpm --filter web run deploy:pages
  ```
- [ ] Environment variables set in Cloudflare Pages:
  - [ ] `API_URL` pointing to API Worker
  - [ ] `INTERNAL_API_SECRET` (same as API Worker)

---

## API Endpoint Tests

### GET /api/session/status

- [ ] Returns 200 for authenticated user
- [ ] Returns correct plan info (`free`, `basic`, or `pro`)
- [ ] Returns `minutesUsed`, `minutesRemaining`, `minutesLimit`
- [ ] Returns `hasActiveSession: false` when no session
- [ ] Returns 401 for unauthenticated requests

### POST /api/session/start

- [ ] Returns 200 with `sessionId` when user has credits
- [ ] Returns 403 when user has no credits remaining
- [ ] Returns 401 for unauthenticated requests
- [ ] Creates record in `usage_sessions` D1 table
- [ ] Verify D1 record:
  ```bash
  pnpm wrangler d1 execute noi-hay-db --remote --command "SELECT * FROM usage_sessions ORDER BY started_at DESC LIMIT 5;"
  ```

### POST /api/session/heartbeat

- [ ] Returns 200 with `minutesUsed` and `minutesRemaining`
- [ ] Returns warning when `minutesRemaining <= 5`
- [ ] Returns 400 for invalid `sessionId`
- [ ] Returns 401 for unauthenticated requests

### POST /api/session/end

- [ ] Returns 200 with `sessionMinutes`, `totalMinutesUsed`, `minutesRemaining`
- [ ] Updates `ended_at` and `minutes_used` in D1
- [ ] Sets `end_reason` to `user_ended`
- [ ] Triggers sync to `usage_periods` table

---

## Polar Webhook Tests

### Subscription Created

- [ ] Send test webhook from Polar dashboard (sandbox mode)
- [ ] Verify user plan is updated in Durable Object
- [ ] Verify `subscription` table is updated in D1
- [ ] Check Cloudflare Worker logs for confirmation:
  ```bash
  pnpm wrangler pages deployment tail <deployment-id> --project-name speakphoreal
  ```

### Subscription Canceled

- [ ] Cancel test subscription in Polar sandbox
- [ ] Verify user plan downgrades to `free`
- [ ] Verify user can still access existing credits until period end

---

## Voice Session Integration

### Full Session Flow

1. [ ] Log in to application
2. [ ] Navigate to practice page
3. [ ] Verify UsageBar shows correct plan and usage
4. [ ] Click "Start Practice" button
5. [ ] Verify session starts (green indicator)
6. [ ] Speak for 1-2 minutes
7. [ ] Verify heartbeat updates usage display
8. [ ] Click "End Session"
9. [ ] Verify session ends cleanly
10. [ ] Verify usage is updated in UsageBar

### Credit Exhaustion

1. [ ] Create/use a free plan user
2. [ ] Use most of 10-minute allocation
3. [ ] Verify warning appears when <= 5 minutes remaining
4. [ ] Use remaining credits
5. [ ] Verify "No credits remaining" message appears
6. [ ] Verify "Start Practice" button is disabled
7. [ ] Verify "Upgrade Plan" link is visible

### Session Recovery

1. [ ] Start a practice session
2. [ ] Close browser tab (simulating crash)
3. [ ] Wait 10+ minutes
4. [ ] Re-open application
5. [ ] Verify stale session was auto-ended
6. [ ] Verify minutes were properly counted
7. [ ] Verify can start new session

---

## UI Component Verification

### UsageBar Component

- [ ] Displays plan name correctly (Free/Basic/Pro)
- [ ] Displays "X/Y minutes" format
- [ ] Progress bar width matches percentage
- [ ] Green color when < 75% used
- [ ] Amber/yellow color when 75-90% used
- [ ] Red color when > 90% used
- [ ] Shows "X minutes remaining" when <= 5 minutes
- [ ] Shows "No credits remaining" when 0 minutes

### UsageWarning Component

- [ ] Appears when minutes remaining <= 5
- [ ] Shows correct remaining minutes
- [ ] "Upgrade Plan" link navigates to /pricing
- [ ] Does not appear when credits are sufficient

---

## D1 Data Verification

### After Session End

```bash
# Check usage_periods table
pnpm wrangler d1 execute noi-hay-db --remote --command "
  SELECT user_id, period_start, period_end, plan, minutes_used, minutes_limit, synced_at
  FROM usage_periods
  ORDER BY synced_at DESC
  LIMIT 5;"

# Check usage_sessions table
pnpm wrangler d1 execute noi-hay-db --remote --command "
  SELECT id, user_id, started_at, ended_at, minutes_used, topic, difficulty, end_reason
  FROM usage_sessions
  ORDER BY started_at DESC
  LIMIT 5;"
```

- [ ] `usage_periods` has correct `minutes_used` value
- [ ] `usage_periods` has recent `synced_at` timestamp
- [ ] `usage_sessions` has `ended_at` set
- [ ] `usage_sessions` has correct `minutes_used`
- [ ] `usage_sessions` has `end_reason` set

---

## Cloudflare Dashboard Verification

### Durable Objects

- [ ] Navigate to Workers & Pages > API Worker > Metrics
- [ ] Verify Durable Object requests are being logged
- [ ] Check for any errors in Durable Object logs

### D1 Database

- [ ] Navigate to D1 > noi-hay-db
- [ ] Verify query activity is visible
- [ ] Check for any failed queries

### Worker Logs

- [ ] Use `wrangler tail` to monitor real-time logs:
  ```bash
  cd apps/api && pnpm wrangler tail
  ```
- [ ] Verify `[Sync]` messages appear after session end
- [ ] Verify `[Alarm]` messages appear during active sessions
- [ ] Check for any `[Error]` messages

---

## Performance Verification

### Credit Check Latency

- [ ] Use browser DevTools Network tab
- [ ] Observe `/api/session/status` response time
- [ ] Should complete in < 50ms (target: in-memory DO access < 10ms + network)

### Session Start Latency

- [ ] Measure time from button click to session active
- [ ] Should complete in < 200ms (target: DO operation < 100ms + network)

### Heartbeat Impact

- [ ] During active session, monitor voice quality
- [ ] Heartbeat (every 30 seconds) should not cause audio glitches
- [ ] Network tab should show heartbeat requests completing quickly

---

## Edge Cases

### Period Boundary

- [ ] Test near end of month if possible
- [ ] Verify usage resets when new period starts
- [ ] Verify archived flag is set on old period record

### Plan Change Mid-Session

- [ ] Start session on free plan
- [ ] Simulate plan upgrade (via Polar sandbox or direct DO call)
- [ ] Verify increased credits reflect immediately
- [ ] Verify session continues without interruption

### Multiple Devices

- [ ] Start session on Device A
- [ ] Attempt to start session on Device B
- [ ] Verify Device B receives "Session already active" error
- [ ] End session on Device A
- [ ] Verify Device B can now start session

---

## Rollback Plan

If issues are found:

1. [ ] Note the specific failure scenario
2. [ ] Check Cloudflare logs for errors
3. [ ] If data corruption suspected:
   ```bash
   # Query specific user's data
   pnpm wrangler d1 execute noi-hay-db --remote --command "
     SELECT * FROM usage_periods WHERE user_id = '<user-id>';"
   ```
4. [ ] If critical, disable feature flag (if implemented)
5. [ ] Roll back to previous deployment:
   ```bash
   pnpm wrangler pages deployment rollback --project-name speakphoreal
   ```

---

## Sign-Off

| Tester | Date | Environment | Result |
|--------|------|-------------|--------|
|        |      | Staging     |        |
|        |      | Production  |        |

## Notes

(Add any issues, observations, or follow-up items here)
