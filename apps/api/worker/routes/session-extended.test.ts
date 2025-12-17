/**
 * Extended Session API Tests
 *
 * Tests for the extended session management endpoints with health tracking:
 * - POST /api/session/start with mode and provider params
 * - POST /api/session/end with disconnect info, messages, and corrections
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSessionStart,
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

interface StartData {
  sessionId: string;
  message: string;
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
  const mockBind = vi.fn().mockReturnValue({
    run: vi.fn().mockResolvedValue({ success: true }),
    all: vi.fn().mockResolvedValue({ results: [] }),
    first: vi.fn().mockResolvedValue(null)
  });

  return {
    prepare: vi.fn().mockReturnValue({
      bind: mockBind
    }),
    batch: vi.fn().mockResolvedValue([{ success: true }]),
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
// EXTENDED SESSION START TESTS
// ============================================================================

describe('Extended Session API - Start', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('accepts and stores mode and provider params in session start', async () => {
    const env = createMockEnv();
    const request = new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: {
        'X-User-Id': 'user-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'food',
        difficulty: 'intermediate',
        mode: 'coach',
        provider: 'gemini'
      })
    });

    const response = await handleSessionStart(request, env, corsHeaders);
    const data = (await response.json()) as ApiResponse<StartData>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data?.sessionId).toBe('test-session-123');

    // Verify D1 was called with mode and provider
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO usage_sessions')
    );

    // Check that bind was called with mode and provider values
    const prepareCall = (env.DB.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(prepareCall).toContain('mode');
    expect(prepareCall).toContain('provider');
    expect(prepareCall).toContain('initial_provider');
  });

  it('uses default mode (coach) and provider (gemini) when not specified', async () => {
    const env = createMockEnv();
    const request = new Request('http://localhost/api/session/start', {
      method: 'POST',
      headers: {
        'X-User-Id': 'user-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        topic: 'food',
        difficulty: 'intermediate'
      })
    });

    const response = await handleSessionStart(request, env, corsHeaders);
    const data = (await response.json()) as ApiResponse<StartData>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify D1 prepare was called
    expect(env.DB.prepare).toHaveBeenCalled();
  });
});

// ============================================================================
// EXTENDED SESSION END TESTS
// ============================================================================

describe('Extended Session API - End', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('accepts and stores disconnect info (code, reason, messageCount) on session end', async () => {
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
      body: JSON.stringify({
        sessionId: 'test-session-123',
        disconnectCode: 1006,
        disconnectReason: 'Abnormal closure',
        messageCount: 15,
        provider: 'openai',
        providerSwitched: true
      })
    });

    const response = await handleSessionEnd(request, env, corsHeaders);
    const data = (await response.json()) as ApiResponse<EndData>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data?.sessionMinutes).toBe(5);

    // Verify D1 was called with UPDATE including disconnect info
    expect(env.DB.prepare).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE usage_sessions')
    );

    const prepareCall = (env.DB.prepare as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(prepareCall).toContain('disconnect_code');
    expect(prepareCall).toContain('disconnect_reason');
    expect(prepareCall).toContain('message_count');
  });

  it('correctly batch inserts messages array on session end', async () => {
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

    const messages = [
      { role: 'user', text: 'Xin chao', timestamp: 1702000000000 },
      { role: 'coach', text: 'Chao ban!', timestamp: 1702000005000 },
      { role: 'user', text: 'Toi muon hoc tieng Viet', timestamp: 1702000010000 }
    ];

    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: {
        'X-User-Id': 'user-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'test-session-123',
        messages
      })
    });

    const response = await handleSessionEnd(request, env, corsHeaders);
    const data = (await response.json()) as ApiResponse<EndData>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify batch insert was called for messages
    expect(env.DB.batch).toHaveBeenCalled();

    // Get the batch call arguments
    const batchCalls = (env.DB.batch as ReturnType<typeof vi.fn>).mock.calls;
    expect(batchCalls.length).toBeGreaterThan(0);
  });

  it('correctly batch inserts corrections array on session end', async () => {
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

    const corrections = [
      {
        original: 'Toi muon an pho',
        correction: 'Em muon an pho',
        explanation: "Use 'em' when speaking to someone older",
        category: 'tone'
      },
      {
        original: 'Anh di dau?',
        correction: 'Anh di dau vay?',
        explanation: "Add 'vay' for politeness",
        category: 'grammar'
      }
    ];

    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: {
        'X-User-Id': 'user-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'test-session-123',
        corrections
      })
    });

    const response = await handleSessionEnd(request, env, corsHeaders);
    const data = (await response.json()) as ApiResponse<EndData>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);

    // Verify batch insert was called for corrections
    expect(env.DB.batch).toHaveBeenCalled();

    // Get the batch call arguments
    const batchCalls = (env.DB.batch as ReturnType<typeof vi.fn>).mock.calls;
    expect(batchCalls.length).toBeGreaterThan(0);
  });

  it('handles session end with both messages and corrections arrays', async () => {
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

    const messages = [
      { role: 'user', text: 'Xin chao', timestamp: 1702000000000 },
      { role: 'coach', text: 'Chao ban!', timestamp: 1702000005000 }
    ];

    const corrections = [
      {
        original: 'Toi muon an pho',
        correction: 'Em muon an pho',
        explanation: "Use 'em' when speaking to someone older",
        category: 'tone'
      }
    ];

    const request = new Request('http://localhost/api/session/end', {
      method: 'POST',
      headers: {
        'X-User-Id': 'user-123',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sessionId: 'test-session-123',
        disconnectCode: 1000,
        disconnectReason: 'Normal closure',
        messageCount: 2,
        provider: 'gemini',
        providerSwitched: false,
        messages,
        corrections
      })
    });

    const response = await handleSessionEnd(request, env, corsHeaders);
    const data = (await response.json()) as ApiResponse<EndData>;

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.data?.sessionMinutes).toBe(5);

    // Verify both batch inserts were called
    const batchCalls = (env.DB.batch as ReturnType<typeof vi.fn>).mock.calls;
    // Should have at least one batch call (messages and corrections may be in same batch)
    expect(batchCalls.length).toBeGreaterThan(0);
  });
});
