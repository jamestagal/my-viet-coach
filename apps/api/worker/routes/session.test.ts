/**
 * Session Management API Tests
 *
 * Tests for the session management endpoints:
 * - GET /api/session/status
 * - POST /api/session/start
 * - POST /api/session/heartbeat
 * - POST /api/session/end
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSessionStatus,
  handleSessionStart,
  handleSessionHeartbeat,
  handleSessionEnd
} from './session';
import type { Env } from '../trpc/context';
import type { UsageStatus, SessionResult } from '../durable-objects/UserUsageObject';

// ============================================================================
// TYPE DEFINITIONS FOR TESTS
// ============================================================================

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

interface StatusData {
  plan: string;
  minutesUsed: number;
  minutesRemaining: number;
  minutesLimit: number;
  percentUsed: number;
  hasActiveSession: boolean;
}

interface StartData {
  sessionId: string;
  message: string;
}

interface HeartbeatData {
  minutesUsed: number;
  minutesRemaining: number;
  warning?: string;
}

interface EndData {
  sessionMinutes: number;
  totalMinutesUsed: number;
  minutesRemaining: number;
}

// ============================================================================
// MOCK SETUP
// ============================================================================

interface MockDurableObjectStub {
  getStatus: () => Promise<UsageStatus>;
  initialize: (userId: string, plan: string) => Promise<UsageStatus>;
  startSession: () => Promise<SessionResult>;
  heartbeat: (
    sessionId: string
  ) => Promise<{ minutesUsed: number; remaining: number } | { error: string }>;
  endSession: (sessionId: string) => Promise<SessionResult>;
}

function createMockStub(overrides: Partial<MockDurableObjectStub> = {}): MockDurableObjectStub {
  const defaultStatus: UsageStatus = {
    plan: 'free',
    minutesUsed: 0,
    minutesRemaining: 10,
    minutesLimit: 10,
    periodStart: '2024-01-01',
    periodEnd: '2024-01-31',
    hasActiveSession: false,
    activeSessionMinutes: 0,
    percentUsed: 0
  };

  return {
    getStatus: vi.fn().mockResolvedValue(defaultStatus),
    initialize: vi.fn().mockResolvedValue(defaultStatus),
    startSession: vi.fn().mockResolvedValue({ sessionId: 'test-session-123' }),
    heartbeat: vi.fn().mockResolvedValue({ minutesUsed: 1, remaining: 9 }),
    endSession: vi.fn().mockResolvedValue({ minutesUsed: 1 }),
    ...overrides
  };
}

function createMockD1(): D1Database {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockResolvedValue({ success: true }),
        all: vi.fn().mockResolvedValue({ results: [] }),
        first: vi.fn().mockResolvedValue(null)
      })
    }),
    batch: vi.fn(),
    exec: vi.fn(),
    dump: vi.fn()
  } as unknown as D1Database;
}

function createMockEnv(overrides: Partial<MockDurableObjectStub> = {}): Env {
  const mockStub = createMockStub(overrides);

  return {
    ANTHROPIC_API_KEY: 'test-anthropic-key',
    GOOGLE_API_KEY: 'test-google-key',
    OPENAI_API_KEY: 'test-openai-key',
    DB: createMockD1(),
    USER_USAGE: {
      idFromName: vi.fn().mockReturnValue('mock-id'),
      get: vi.fn().mockReturnValue(mockStub)
    } as unknown as Env['USER_USAGE']
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Secret, X-User-Id'
};

// ============================================================================
// TESTS
// ============================================================================

describe('Session API Endpoints', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  // ==========================================================================
  // GET /api/session/status
  // ==========================================================================

  describe('GET /api/session/status', () => {
    it('returns usage data for authenticated user', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/status', {
        method: 'GET',
        headers: { 'X-User-Id': 'user-123' }
      });

      const response = await handleSessionStatus(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse<StatusData>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toHaveProperty('plan');
      expect(data.data).toHaveProperty('minutesUsed');
      expect(data.data).toHaveProperty('minutesRemaining');
      expect(data.data).toHaveProperty('minutesLimit');
      expect(data.data).toHaveProperty('percentUsed');
      expect(data.data).toHaveProperty('hasActiveSession');
    });

    it('returns 401 when not authenticated', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/status', {
        method: 'GET'
        // No auth header
      });

      const response = await handleSessionStatus(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('returns default free plan status for uninitialized user', async () => {
      const env = createMockEnv({
        getStatus: vi.fn().mockRejectedValue(new Error('User not initialized'))
      });
      const request = new Request('http://localhost/api/session/status', {
        method: 'GET',
        headers: { 'X-User-Id': 'new-user' }
      });

      const response = await handleSessionStatus(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse<StatusData>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.plan).toBe('free');
      expect(data.data?.minutesLimit).toBe(10);
    });
  });

  // ==========================================================================
  // POST /api/session/start
  // ==========================================================================

  describe('POST /api/session/start', () => {
    it('creates session and returns sessionId', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/start', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic: 'food', difficulty: 'intermediate' })
      });

      const response = await handleSessionStart(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse<StartData>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.sessionId).toBe('test-session-123');
      expect(data.data?.message).toBe('Session started successfully');
    });

    it('rejects when no credits available', async () => {
      const env = createMockEnv({
        startSession: vi.fn().mockResolvedValue({
          error: 'Monthly limit reached (10 minutes on free plan)'
        })
      });
      const request = new Request('http://localhost/api/session/start', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const response = await handleSessionStart(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Monthly limit reached');
    });

    it('returns 401 when not authenticated', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });

      const response = await handleSessionStart(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });

    it('inserts session record in D1 on success', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/start', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ topic: 'travel', difficulty: 'beginner' })
      });

      await handleSessionStart(request, env, corsHeaders);

      // Verify D1 was called
      expect(env.DB.prepare).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO usage_sessions')
      );
    });
  });

  // ==========================================================================
  // POST /api/session/heartbeat
  // ==========================================================================

  describe('POST /api/session/heartbeat', () => {
    it('updates usage and returns minutesUsed/remaining', async () => {
      const env = createMockEnv({
        heartbeat: vi.fn().mockResolvedValue({ minutesUsed: 5, remaining: 5 })
      });
      const request = new Request('http://localhost/api/session/heartbeat', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: 'test-session-123' })
      });

      const response = await handleSessionHeartbeat(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse<HeartbeatData>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.minutesUsed).toBe(5);
      expect(data.data?.minutesRemaining).toBe(5);
    });

    it('includes warning when remaining <= 5 minutes', async () => {
      const env = createMockEnv({
        heartbeat: vi.fn().mockResolvedValue({ minutesUsed: 8, remaining: 2 })
      });
      const request = new Request('http://localhost/api/session/heartbeat', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: 'test-session-123' })
      });

      const response = await handleSessionHeartbeat(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse<HeartbeatData>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.warning).toContain('Only 2 minutes remaining');
    });

    it('returns error for invalid session', async () => {
      const env = createMockEnv({
        heartbeat: vi.fn().mockResolvedValue({ error: 'No active session with this ID' })
      });
      const request = new Request('http://localhost/api/session/heartbeat', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: 'invalid-session' })
      });

      const response = await handleSessionHeartbeat(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No active session');
    });

    it('returns 400 when sessionId is missing', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/heartbeat', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });

      const response = await handleSessionHeartbeat(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBe('sessionId is required');
    });
  });

  // ==========================================================================
  // POST /api/session/end
  // ==========================================================================

  describe('POST /api/session/end', () => {
    it('finalizes session and returns usage summary', async () => {
      const statusAfterEnd: UsageStatus = {
        plan: 'free',
        minutesUsed: 5,
        minutesRemaining: 5,
        minutesLimit: 10,
        periodStart: '2024-01-01',
        periodEnd: '2024-01-31',
        hasActiveSession: false,
        activeSessionMinutes: 0,
        percentUsed: 50
      };

      const env = createMockEnv({
        endSession: vi.fn().mockResolvedValue({ minutesUsed: 5 }),
        getStatus: vi.fn().mockResolvedValue(statusAfterEnd)
      });
      const request = new Request('http://localhost/api/session/end', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: 'test-session-123' })
      });

      const response = await handleSessionEnd(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse<EndData>;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data?.sessionMinutes).toBe(5);
      expect(data.data?.totalMinutesUsed).toBe(5);
      expect(data.data?.minutesRemaining).toBe(5);
    });

    it('updates D1 record on session end', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/end', {
        method: 'POST',
        headers: {
          'X-User-Id': 'user-123',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionId: 'test-session-123' })
      });

      await handleSessionEnd(request, env, corsHeaders);

      // Verify D1 was called with UPDATE
      expect(env.DB.prepare).toHaveBeenCalledWith(expect.stringContaining('UPDATE usage_sessions'));
    });

    it('returns 401 when not authenticated', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/end', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: 'test-session-123' })
      });

      const response = await handleSessionEnd(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(401);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Unauthorized');
    });
  });

  // ==========================================================================
  // Authentication Tests
  // ==========================================================================

  describe('Authentication', () => {
    it('accepts Bearer token for authentication', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/status', {
        method: 'GET',
        headers: { Authorization: 'Bearer user-token-123' }
      });

      const response = await handleSessionStatus(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('accepts X-User-Id header for authentication', async () => {
      const env = createMockEnv();
      const request = new Request('http://localhost/api/session/status', {
        method: 'GET',
        headers: { 'X-User-Id': 'user-123' }
      });

      const response = await handleSessionStatus(request, env, corsHeaders);
      const data = (await response.json()) as ApiResponse;

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
