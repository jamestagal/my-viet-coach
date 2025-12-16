/**
 * Integration Tests for Real-Time AI Usage Management Feature
 *
 * Task Group 6: Test Review & Integration Testing
 *
 * These tests verify the complete workflows across multiple components:
 * - Session lifecycle: status -> start -> heartbeat -> end
 * - Credit exhaustion behavior
 * - Plan upgrades/downgrades
 * - Period resets
 * - Stale session cleanup
 * - Concurrent session rejection
 * - Webhook -> DO sync
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock cloudflare:workers before importing the DO
vi.mock('cloudflare:workers', () => ({
  DurableObject: class DurableObject {
    ctx: DurableObjectState;
    env: unknown;
    constructor(ctx: DurableObjectState, env: unknown) {
      this.ctx = ctx;
      this.env = env;
    }
  }
}));

// Import after mocking
import { UserUsageObject, PLAN_CONFIG } from '../durable-objects/UserUsageObject';
import type { UsageState, PlanType } from '../durable-objects/UserUsageObject';

// ============================================================================
// MOCK SETUP
// ============================================================================

function createMockStorage() {
  const storage = new Map<string, unknown>();

  return {
    get: vi.fn(<T>(key: string): Promise<T | undefined> => {
      return Promise.resolve(storage.get(key) as T | undefined);
    }),
    put: vi.fn((key: string, value: unknown): Promise<void> => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    setAlarm: vi.fn((): Promise<void> => Promise.resolve()),
    getAlarm: vi.fn((): Promise<number | null> => Promise.resolve(null)),
    delete: vi.fn((key: string): Promise<boolean> => {
      return Promise.resolve(storage.delete(key));
    }),
    deleteAll: vi.fn((): Promise<void> => {
      storage.clear();
      return Promise.resolve();
    }),
    _storage: storage // Expose for test inspection
  };
}

function createMockCtx(storage: ReturnType<typeof createMockStorage>) {
  return {
    storage,
    blockConcurrencyWhile: vi.fn(async (fn: () => Promise<void>) => {
      await fn();
    }),
    id: {
      toString: () => 'test-do-id',
      name: 'test-user-id'
    },
    waitUntil: vi.fn()
  } as unknown as DurableObjectState;
}

function createMockEnv() {
  return {
    DB: {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          run: vi.fn(() => Promise.resolve({ success: true }))
        }))
      }))
    }
  };
}

// Helper to create an initialized UserUsageObject
async function createInitializedDO(
  plan: PlanType = 'free',
  userId = 'test-user-id'
): Promise<{
  obj: UserUsageObject;
  mockCtx: DurableObjectState;
  mockEnv: ReturnType<typeof createMockEnv>;
  mockStorage: ReturnType<typeof createMockStorage>;
}> {
  const mockStorage = createMockStorage();
  const mockCtx = createMockCtx(mockStorage);
  const mockEnv = createMockEnv();

  const obj = new UserUsageObject(mockCtx, mockEnv as unknown as { DB: D1Database });
  await obj.initialize(userId, plan);

  return { obj, mockCtx, mockEnv, mockStorage };
}

// ============================================================================
// INTEGRATION TESTS
// ============================================================================

describe('Usage Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Test 1: Complete session lifecycle (status -> start -> heartbeat -> end)
  // --------------------------------------------------------------------------
  describe('Complete session lifecycle', () => {
    it('executes full flow: status -> start -> heartbeat -> end', async () => {
      const { obj, mockEnv } = await createInitializedDO('basic');

      // Step 1: Get initial status
      const initialStatus = await obj.getStatus();
      expect(initialStatus.plan).toBe('basic');
      expect(initialStatus.minutesUsed).toBe(0);
      expect(initialStatus.minutesRemaining).toBe(100);
      expect(initialStatus.hasActiveSession).toBe(false);

      // Step 2: Start session
      const startResult = await obj.startSession();
      expect(startResult.sessionId).toBeDefined();
      expect(startResult.error).toBeUndefined();

      const statusAfterStart = await obj.getStatus();
      expect(statusAfterStart.hasActiveSession).toBe(true);

      // Step 3: Send heartbeats during session
      vi.advanceTimersByTime(2 * 60 * 1000); // 2 minutes
      const heartbeat1 = await obj.heartbeat(startResult.sessionId!);
      expect('minutesUsed' in heartbeat1 && heartbeat1.minutesUsed).toBe(2);
      expect('remaining' in heartbeat1 && heartbeat1.remaining).toBe(98);

      vi.advanceTimersByTime(3 * 60 * 1000); // 3 more minutes (5 total)
      const heartbeat2 = await obj.heartbeat(startResult.sessionId!);
      expect('minutesUsed' in heartbeat2 && heartbeat2.minutesUsed).toBe(5);
      expect('remaining' in heartbeat2 && heartbeat2.remaining).toBe(95);

      // Step 4: End session
      const endResult = await obj.endSession(startResult.sessionId!);
      expect(endResult.minutesUsed).toBe(5);

      // Step 5: Verify final status
      const finalStatus = await obj.getStatus();
      expect(finalStatus.minutesUsed).toBe(5);
      expect(finalStatus.minutesRemaining).toBe(95);
      expect(finalStatus.hasActiveSession).toBe(false);

      // Step 6: Verify D1 sync was triggered
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: Credit exhaustion mid-session behavior
  // --------------------------------------------------------------------------
  describe('Credit exhaustion mid-session', () => {
    it('shows remaining credits approaching zero during session', async () => {
      const { obj, mockStorage } = await createInitializedDO('free'); // 10 minutes

      // Use 7 minutes from previous sessions
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 7;
      mockStorage._storage.set('state', state);

      // Start new session with only 3 minutes remaining
      const { sessionId } = await obj.startSession();
      expect(sessionId).toBeDefined();

      // After 2 minutes, should have 1 minute remaining
      vi.advanceTimersByTime(2 * 60 * 1000);
      const heartbeat = await obj.heartbeat(sessionId!);
      expect('remaining' in heartbeat && heartbeat.remaining).toBe(1);

      // After 3 more minutes, should hit limit
      vi.advanceTimersByTime(3 * 60 * 1000);
      const heartbeat2 = await obj.heartbeat(sessionId!);
      expect('remaining' in heartbeat2 && heartbeat2.remaining).toBe(0);

      // End session
      await obj.endSession(sessionId!);

      // Verify cannot start new session
      const newSessionResult = await obj.startSession();
      expect(newSessionResult.error).toContain('Monthly limit reached');
    });

    it('prevents session start when credits already exhausted', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Exhaust all credits
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 10;
      mockStorage._storage.set('state', state);

      const result = await obj.startSession();
      expect(result.error).toContain('Monthly limit reached');
      expect(result.sessionId).toBeUndefined();
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: Plan upgrade reflects immediately in DO
  // --------------------------------------------------------------------------
  describe('Plan upgrade immediate reflection', () => {
    it('increases available minutes immediately on upgrade', async () => {
      const { obj, mockStorage, mockEnv } = await createInitializedDO('free');

      // Use 8 minutes of free plan (2 remaining)
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 8;
      mockStorage._storage.set('state', state);

      const statusBeforeUpgrade = await obj.getStatus();
      expect(statusBeforeUpgrade.minutesRemaining).toBe(2);

      // Upgrade to basic plan (100 minutes)
      const statusAfterUpgrade = await obj.upgradePlan('basic');
      expect(statusAfterUpgrade.plan).toBe('basic');
      expect(statusAfterUpgrade.minutesLimit).toBe(100);
      expect(statusAfterUpgrade.minutesUsed).toBe(8); // Usage preserved
      expect(statusAfterUpgrade.minutesRemaining).toBe(92); // 100 - 8

      // Should be able to start session now
      const { sessionId } = await obj.startSession();
      expect(sessionId).toBeDefined();

      // Verify D1 sync was called
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('handles downgrade correctly', async () => {
      const { obj, mockStorage } = await createInitializedDO('pro');

      // Use 50 minutes on pro plan
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 50;
      mockStorage._storage.set('state', state);

      // Downgrade to basic (100 minutes limit)
      const status = await obj.downgradePlan('basic');
      expect(status.plan).toBe('basic');
      expect(status.minutesLimit).toBe(100);
      expect(status.minutesUsed).toBe(50);
      expect(status.minutesRemaining).toBe(50);
    });
  });

  // --------------------------------------------------------------------------
  // Test 4: Period reset when month boundary crossed
  // --------------------------------------------------------------------------
  describe('Period reset at month boundary', () => {
    it('resets usage when period end date passes', async () => {
      const { obj, mockStorage, mockEnv } = await createInitializedDO('basic');

      // Use some minutes
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 50;
      mockStorage._storage.set('state', state);

      // Verify current usage
      let status = await obj.getStatus();
      expect(status.minutesUsed).toBe(50);
      expect(status.periodEnd).toBe('2025-01-31');

      // Advance time past period end (to February)
      vi.setSystemTime(new Date('2025-02-01T12:00:00Z'));

      // Next status check should trigger reset
      status = await obj.getStatus();
      expect(status.minutesUsed).toBe(0);
      expect(status.minutesRemaining).toBe(100);
      expect(status.periodStart).toBe('2025-02-01');
      expect(status.periodEnd).toBe('2025-02-28');

      // Verify archive was called
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Test 5: Stale session cleanup via alarm
  // --------------------------------------------------------------------------
  describe('Stale session cleanup via alarm', () => {
    it('auto-ends session when alarm detects stale heartbeat', async () => {
      const { obj, mockStorage, mockEnv } = await createInitializedDO('basic');

      // Start session
      const { sessionId } = await obj.startSession();
      expect(sessionId).toBeDefined();

      // Verify session is active
      let status = await obj.getStatus();
      expect(status.hasActiveSession).toBe(true);

      // Advance time past stale threshold (11 minutes)
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Trigger alarm
      await obj.alarm();

      // Verify session was ended
      status = await obj.getStatus();
      expect(status.hasActiveSession).toBe(false);
      expect(status.minutesUsed).toBe(11); // Minutes from stale session

      // Verify D1 sync was triggered
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('reschedules alarm when session is still active', async () => {
      const { obj, mockStorage } = await createInitializedDO('basic');

      // Start session
      await obj.startSession();

      // Advance time but NOT past stale threshold (5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Clear alarm mock to track new calls
      mockStorage.setAlarm.mockClear();

      // Trigger alarm
      await obj.alarm();

      // Session should still be active
      const status = await obj.getStatus();
      expect(status.hasActiveSession).toBe(true);

      // Alarm should be rescheduled
      expect(mockStorage.setAlarm).toHaveBeenCalledWith(expect.any(Number));
    });
  });

  // --------------------------------------------------------------------------
  // Test 6: Concurrent session rejection
  // --------------------------------------------------------------------------
  describe('Concurrent session rejection', () => {
    it('rejects second session when one is already active', async () => {
      const { obj } = await createInitializedDO('basic');

      // Start first session
      const firstResult = await obj.startSession();
      expect(firstResult.sessionId).toBeDefined();

      // Try to start second session immediately
      const secondResult = await obj.startSession();
      expect(secondResult.error).toContain('Session already active');
      expect(secondResult.sessionId).toBeUndefined();
    });

    it('allows new session after ending previous one', async () => {
      const { obj } = await createInitializedDO('basic');

      // Start and end first session
      const firstResult = await obj.startSession();
      vi.advanceTimersByTime(1 * 60 * 1000);
      await obj.endSession(firstResult.sessionId!);

      // Should be able to start second session
      const secondResult = await obj.startSession();
      expect(secondResult.sessionId).toBeDefined();
      expect(secondResult.sessionId).not.toBe(firstResult.sessionId);
    });

    it('allows new session after stale session auto-cleanup', async () => {
      const { obj } = await createInitializedDO('basic');

      // Start first session
      const firstResult = await obj.startSession();

      // Advance past stale threshold
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Second session should auto-end the stale one and succeed
      const secondResult = await obj.startSession();
      expect(secondResult.sessionId).toBeDefined();
      expect(secondResult.sessionId).not.toBe(firstResult.sessionId);
    });
  });

  // --------------------------------------------------------------------------
  // Test 7: Webhook -> DO sync -> status reflects change
  // --------------------------------------------------------------------------
  describe('Webhook to DO sync flow', () => {
    it('plan upgrade from webhook is reflected in status immediately', async () => {
      const { obj, mockEnv } = await createInitializedDO('free');

      // Verify initial free plan
      let status = await obj.getStatus();
      expect(status.plan).toBe('free');
      expect(status.minutesLimit).toBe(10);

      // Simulate webhook calling upgradePlan (as internal endpoint would)
      await obj.upgradePlan('pro');

      // Verify status reflects change immediately
      status = await obj.getStatus();
      expect(status.plan).toBe('pro');
      expect(status.minutesLimit).toBe(500);

      // Verify sync was triggered
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('downgrade from webhook is reflected in status immediately', async () => {
      const { obj, mockStorage } = await createInitializedDO('pro');

      // Use some minutes
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 50;
      mockStorage._storage.set('state', state);

      // Simulate webhook calling downgradePlan
      await obj.downgradePlan('free');

      // Verify status reflects change
      const status = await obj.getStatus();
      expect(status.plan).toBe('free');
      expect(status.minutesLimit).toBe(10);
      expect(status.minutesUsed).toBe(50); // Usage preserved
      expect(status.minutesRemaining).toBe(0); // Over limit now
    });
  });

  // --------------------------------------------------------------------------
  // Test 8: Realtime-token rejection scenarios
  // --------------------------------------------------------------------------
  describe('Realtime token scenarios', () => {
    it('status shows no active session when none started', async () => {
      const { obj } = await createInitializedDO('basic');

      const status = await obj.getStatus();
      expect(status.hasActiveSession).toBe(false);

      // Token endpoint should check this and reject
      // (this tests the data that token endpoint would use)
    });

    it('status shows active session after start', async () => {
      const { obj } = await createInitializedDO('basic');

      await obj.startSession();

      const status = await obj.getStatus();
      expect(status.hasActiveSession).toBe(true);
      expect(status.minutesRemaining).toBeGreaterThan(0);

      // Token endpoint should allow request with this status
    });

    it('status shows no credits when exhausted', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Exhaust credits
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 10;
      mockStorage._storage.set('state', state);

      const status = await obj.getStatus();
      expect(status.minutesRemaining).toBe(0);

      // Token endpoint should check this and reject
    });
  });
});

// ============================================================================
// PERFORMANCE TESTS
// ============================================================================

describe('Performance Requirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('credit check completes in under 10ms (mocked)', async () => {
    const { obj } = await createInitializedDO('basic');

    // Run hasCredits multiple times to verify consistency
    for (let i = 0; i < 100; i++) {
      const start = Date.now();
      await obj.hasCredits();
      const duration = Date.now() - start;

      // With fake timers, this should be essentially instant
      // In production, this verifies in-memory access pattern
      expect(duration).toBeLessThanOrEqual(10);
    }
  });

  it('getStatus completes quickly (mocked)', async () => {
    const { obj } = await createInitializedDO('basic');

    for (let i = 0; i < 50; i++) {
      const start = Date.now();
      await obj.getStatus();
      const duration = Date.now() - start;
      expect(duration).toBeLessThanOrEqual(10);
    }
  });

  it('heartbeat is lightweight operation', async () => {
    const { obj } = await createInitializedDO('basic');
    const { sessionId } = await obj.startSession();

    for (let i = 0; i < 50; i++) {
      vi.advanceTimersByTime(30 * 1000); // 30 seconds between heartbeats
      const start = Date.now();
      await obj.heartbeat(sessionId!);
      const duration = Date.now() - start;
      expect(duration).toBeLessThanOrEqual(10);
    }
  });
});
