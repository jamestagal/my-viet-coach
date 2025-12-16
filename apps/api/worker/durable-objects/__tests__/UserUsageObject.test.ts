import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

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
import { UserUsageObject, PLAN_CONFIG } from '../UserUsageObject';
import type { UsageState, PlanType } from '../UserUsageObject';

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

  // Create the DO instance
  const obj = new UserUsageObject(mockCtx, mockEnv as unknown as { DB: D1Database });

  // Initialize the user
  await obj.initialize(userId, plan);

  return { obj, mockCtx, mockEnv, mockStorage };
}

// ============================================================================
// TESTS
// ============================================================================

describe('UserUsageObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-01-15T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // --------------------------------------------------------------------------
  // Test 1: initialize() creates state with correct plan limits
  // --------------------------------------------------------------------------
  describe('initialize', () => {
    it('creates state with correct plan limits for free plan', async () => {
      const { obj } = await createInitializedDO('free');

      const status = await obj.getStatus();

      expect(status.plan).toBe('free');
      expect(status.minutesLimit).toBe(PLAN_CONFIG.free.minutes);
      expect(status.minutesUsed).toBe(0);
      expect(status.minutesRemaining).toBe(10);
      expect(status.percentUsed).toBe(0);
    });

    it('creates state with correct plan limits for basic plan', async () => {
      const { obj } = await createInitializedDO('basic');

      const status = await obj.getStatus();

      expect(status.plan).toBe('basic');
      expect(status.minutesLimit).toBe(PLAN_CONFIG.basic.minutes);
      expect(status.minutesRemaining).toBe(100);
    });

    it('creates state with correct plan limits for pro plan', async () => {
      const { obj } = await createInitializedDO('pro');

      const status = await obj.getStatus();

      expect(status.plan).toBe('pro');
      expect(status.minutesLimit).toBe(PLAN_CONFIG.pro.minutes);
      expect(status.minutesRemaining).toBe(500);
    });

    it('sets correct period start and end dates', async () => {
      const { obj } = await createInitializedDO('free');

      const status = await obj.getStatus();

      // Current fake date is 2025-01-15
      expect(status.periodStart).toBe('2025-01-01');
      expect(status.periodEnd).toBe('2025-01-31');
    });
  });

  // --------------------------------------------------------------------------
  // Test 2: hasCredits() returns correct remaining minutes
  // --------------------------------------------------------------------------
  describe('hasCredits', () => {
    it('returns true and full remaining minutes for new user', async () => {
      const { obj } = await createInitializedDO('free');

      const result = await obj.hasCredits();

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(10);
      expect(result.reason).toBeUndefined();
    });

    it('returns false when credits are exhausted', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Manually set usage to limit
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 10;
      mockStorage._storage.set('state', state);

      const result = await obj.hasCredits();

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.reason).toContain('Monthly limit reached');
    });

    it('includes active session minutes in calculation', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Simulate active session with 5 minutes used
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 3;
      state.activeSession = {
        id: 'session-1',
        startTime: Date.now() - 5 * 60 * 1000,
        lastHeartbeat: Date.now(),
        minutesUsed: 5
      };
      mockStorage._storage.set('state', state);

      const result = await obj.hasCredits();

      // 3 period minutes + 5 session minutes = 8 used, 2 remaining
      expect(result.remaining).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Test 3: startSession() creates session and schedules alarm
  // --------------------------------------------------------------------------
  describe('startSession', () => {
    it('creates session and returns sessionId', async () => {
      const { obj } = await createInitializedDO('free');

      const result = await obj.startSession();

      expect(result.sessionId).toBeDefined();
      expect(result.error).toBeUndefined();
      expect(typeof result.sessionId).toBe('string');
    });

    it('schedules alarm for periodic sync', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      await obj.startSession();

      expect(mockStorage.setAlarm).toHaveBeenCalledWith(expect.any(Number));
    });

    it('creates session with correct initial state', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      const result = await obj.startSession();
      const state = mockStorage._storage.get('state') as UsageState;

      expect(state.activeSession).not.toBeNull();
      expect(state.activeSession!.id).toBe(result.sessionId);
      expect(state.activeSession!.minutesUsed).toBe(0);
    });
  });

  // --------------------------------------------------------------------------
  // Test 4: startSession() rejects when session already active
  // --------------------------------------------------------------------------
  describe('startSession - rejection cases', () => {
    it('rejects when session already active and not stale', async () => {
      const { obj } = await createInitializedDO('free');

      // Start first session
      await obj.startSession();

      // Try to start second session
      const result = await obj.startSession();

      expect(result.error).toContain('Session already active');
      expect(result.sessionId).toBeUndefined();
    });

    it('rejects when no credits available', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Exhaust credits
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 10;
      mockStorage._storage.set('state', state);

      const result = await obj.startSession();

      expect(result.error).toContain('Monthly limit reached');
    });
  });

  // --------------------------------------------------------------------------
  // Test 5: heartbeat() updates usage correctly
  // --------------------------------------------------------------------------
  describe('heartbeat', () => {
    it('updates minutes used correctly', async () => {
      const { obj } = await createInitializedDO('free');

      const { sessionId } = await obj.startSession();

      // Advance time by 3 minutes
      vi.advanceTimersByTime(3 * 60 * 1000);

      const result = await obj.heartbeat(sessionId!);

      expect('minutesUsed' in result && result.minutesUsed).toBe(3);
      expect('remaining' in result && result.remaining).toBe(7);
    });

    it('returns error for invalid session ID', async () => {
      const { obj } = await createInitializedDO('free');

      const result = await obj.heartbeat('invalid-session-id');

      expect('error' in result && result.error).toContain('No active session');
    });

    it('calculates remaining credits correctly during session', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Set 5 minutes already used this period
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 5;
      mockStorage._storage.set('state', state);

      const { sessionId } = await obj.startSession();

      // Advance time by 3 minutes
      vi.advanceTimersByTime(3 * 60 * 1000);

      const result = await obj.heartbeat(sessionId!);

      // 5 period + 3 session = 8 used, 2 remaining
      expect('remaining' in result && result.remaining).toBe(2);
    });
  });

  // --------------------------------------------------------------------------
  // Test 6: endSession() calculates final minutes and clears session
  // --------------------------------------------------------------------------
  describe('endSession', () => {
    it('calculates final minutes and clears session', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      const { sessionId } = await obj.startSession();

      // Advance time by 2.5 minutes
      vi.advanceTimersByTime(2.5 * 60 * 1000);

      const result = await obj.endSession(sessionId!);

      // Should round up to 3 minutes
      expect(result.minutesUsed).toBe(3);

      // Check state was updated
      const state = mockStorage._storage.get('state') as UsageState;
      expect(state.activeSession).toBeNull();
      expect(state.minutesUsed).toBe(3);
    });

    it('ensures minimum of 1 minute for very short sessions', async () => {
      const { obj } = await createInitializedDO('free');

      const { sessionId } = await obj.startSession();

      // Advance time by only 5 seconds
      vi.advanceTimersByTime(5 * 1000);

      const result = await obj.endSession(sessionId!);

      expect(result.minutesUsed).toBe(1);
    });

    it('returns gracefully for non-existent session', async () => {
      const { obj } = await createInitializedDO('free');

      const result = await obj.endSession('non-existent-id');

      expect(result.minutesUsed).toBe(0);
      expect(result.error).toBeUndefined();
    });

    it('triggers database sync', async () => {
      const { obj, mockEnv } = await createInitializedDO('free');

      const { sessionId } = await obj.startSession();

      vi.advanceTimersByTime(1 * 60 * 1000);

      await obj.endSession(sessionId!);

      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Test 7: upgradePlan() updates limits immediately
  // --------------------------------------------------------------------------
  describe('upgradePlan', () => {
    it('updates plan and limits immediately', async () => {
      const { obj } = await createInitializedDO('free');

      const status = await obj.upgradePlan('pro');

      expect(status.plan).toBe('pro');
      expect(status.minutesLimit).toBe(500);
    });

    it('preserves usage by default', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Use some minutes
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 5;
      mockStorage._storage.set('state', state);

      const status = await obj.upgradePlan('basic');

      // Usage should be preserved, but remaining increases due to higher limit
      expect(status.minutesUsed).toBe(5);
      expect(status.minutesRemaining).toBe(95); // 100 - 5
    });

    it('can reset usage on upgrade if requested', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Use some minutes
      const state = mockStorage._storage.get('state') as UsageState;
      state.minutesUsed = 5;
      mockStorage._storage.set('state', state);

      const status = await obj.upgradePlan('basic', true);

      expect(status.minutesUsed).toBe(0);
      expect(status.minutesRemaining).toBe(100);
    });

    it('syncs to database after plan change', async () => {
      const { obj, mockEnv } = await createInitializedDO('free');

      await obj.upgradePlan('pro');

      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });
  });

  // --------------------------------------------------------------------------
  // Test 8: stale session detection (10+ minute timeout)
  // --------------------------------------------------------------------------
  describe('stale session detection', () => {
    it('auto-ends stale session when starting new session', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Start first session
      const { sessionId: firstSessionId } = await obj.startSession();

      // Advance time past stale threshold (10+ minutes)
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Try to start new session - should auto-end the stale one
      const result = await obj.startSession();

      expect(result.sessionId).toBeDefined();
      expect(result.sessionId).not.toBe(firstSessionId);

      // Check that minutes were counted from stale session
      const state = mockStorage._storage.get('state') as UsageState;
      expect(state.minutesUsed).toBeGreaterThan(0);
    });

    it('rejects new session if existing session is not stale', async () => {
      const { obj } = await createInitializedDO('free');

      // Start first session
      await obj.startSession();

      // Advance time but NOT past stale threshold (only 5 minutes)
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Try to start new session - should be rejected
      const result = await obj.startSession();

      expect(result.error).toContain('Session already active');
    });

    it('alarm auto-ends stale session', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Start session
      await obj.startSession();

      // Advance time past stale threshold
      vi.advanceTimersByTime(11 * 60 * 1000);

      // Trigger alarm
      await obj.alarm();

      // Check that session was ended
      const state = mockStorage._storage.get('state') as UsageState;
      expect(state.activeSession).toBeNull();
      expect(state.minutesUsed).toBeGreaterThan(0);
    });

    it('alarm reschedules if session is still active and not stale', async () => {
      const { obj, mockStorage } = await createInitializedDO('free');

      // Start session
      await obj.startSession();

      // Advance time but NOT past stale threshold
      vi.advanceTimersByTime(5 * 60 * 1000);

      // Clear alarm mock calls
      mockStorage.setAlarm.mockClear();

      // Trigger alarm
      await obj.alarm();

      // Check that session is still active
      const state = mockStorage._storage.get('state') as UsageState;
      expect(state.activeSession).not.toBeNull();

      // Check that alarm was rescheduled
      expect(mockStorage.setAlarm).toHaveBeenCalled();
    });
  });
});
