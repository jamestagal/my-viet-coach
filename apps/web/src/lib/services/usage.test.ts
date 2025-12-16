/**
 * Usage Service & UI Component Tests
 *
 * Tests for the usage service functions and associated utility functions.
 * These tests cover the client-side usage tracking functionality.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getUsageStatus,
  startSession,
  sendHeartbeat,
  endSession,
  getUsageColorClass,
  isLowOnCredits,
  hasNoCredits,
  formatPlanName,
  type UsageStatus
} from './usage';

// ============================================================================
// MOCK SETUP
// ============================================================================

const mockFetch = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  globalThis.fetch = mockFetch;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper to create a successful API response
function createSuccessResponse<T>(data: T): Response {
  return new Response(JSON.stringify({ success: true, data }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

// Helper to create an error API response
function createErrorResponse(error: string, status: number = 400): Response {
  return new Response(JSON.stringify({ success: false, error }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

// ============================================================================
// USAGE COLOR CLASS TESTS
// ============================================================================

describe('getUsageColorClass', () => {
  it('returns green class when percentUsed < 75', () => {
    expect(getUsageColorClass(0)).toBe('bg-emerald-500');
    expect(getUsageColorClass(50)).toBe('bg-emerald-500');
    expect(getUsageColorClass(74)).toBe('bg-emerald-500');
  });

  it('returns amber class when percentUsed is 75-90', () => {
    expect(getUsageColorClass(75)).toBe('bg-amber-500');
    expect(getUsageColorClass(80)).toBe('bg-amber-500');
    expect(getUsageColorClass(90)).toBe('bg-amber-500');
  });

  it('returns red class when percentUsed > 90', () => {
    expect(getUsageColorClass(91)).toBe('bg-red-500');
    expect(getUsageColorClass(95)).toBe('bg-red-500');
    expect(getUsageColorClass(100)).toBe('bg-red-500');
  });
});

// ============================================================================
// LOW CREDIT WARNING TESTS
// ============================================================================

describe('isLowOnCredits', () => {
  it('returns true when minutesRemaining <= 5', () => {
    expect(isLowOnCredits(0)).toBe(true);
    expect(isLowOnCredits(1)).toBe(true);
    expect(isLowOnCredits(5)).toBe(true);
  });

  it('returns false when minutesRemaining > 5', () => {
    expect(isLowOnCredits(6)).toBe(false);
    expect(isLowOnCredits(10)).toBe(false);
    expect(isLowOnCredits(100)).toBe(false);
  });
});

describe('hasNoCredits', () => {
  it('returns true when minutesRemaining <= 0', () => {
    expect(hasNoCredits(0)).toBe(true);
    expect(hasNoCredits(-1)).toBe(true);
  });

  it('returns false when minutesRemaining > 0', () => {
    expect(hasNoCredits(1)).toBe(false);
    expect(hasNoCredits(5)).toBe(false);
    expect(hasNoCredits(100)).toBe(false);
  });
});

// ============================================================================
// PLAN NAME FORMATTING TESTS
// ============================================================================

describe('formatPlanName', () => {
  it('formats plan names correctly', () => {
    expect(formatPlanName('free')).toBe('Free');
    expect(formatPlanName('basic')).toBe('Basic');
    expect(formatPlanName('pro')).toBe('Pro');
  });
});

// ============================================================================
// API SERVICE FUNCTION TESTS
// ============================================================================

describe('getUsageStatus', () => {
  const mockStatus: UsageStatus = {
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

  it('fetches and returns usage status', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockStatus));

    const result = await getUsageStatus();

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/status',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include'
      })
    );
    expect(result).toEqual(mockStatus);
  });

  it('throws error when not authenticated', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse('Unauthorized', 401));

    await expect(getUsageStatus()).rejects.toThrow('Not authenticated');
  });
});

describe('startSession', () => {
  const mockStartResult = {
    sessionId: 'session-123',
    message: 'Session started successfully'
  };

  it('starts session and returns sessionId', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockStartResult));

    const result = await startSession({ topic: 'food', difficulty: 'intermediate' });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/start',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ topic: 'food', difficulty: 'intermediate' })
      })
    );
    expect(result.sessionId).toBe('session-123');
  });

  it('throws error when no credits available', async () => {
    mockFetch.mockResolvedValueOnce(
      createErrorResponse('Monthly limit reached (10 minutes on free plan)', 403)
    );

    await expect(startSession()).rejects.toThrow('Monthly limit reached');
  });

  it('throws error when not authenticated', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse('Unauthorized', 401));

    await expect(startSession()).rejects.toThrow('Not authenticated');
  });
});

describe('sendHeartbeat', () => {
  const mockHeartbeatResult = {
    minutesUsed: 5,
    minutesRemaining: 5
  };

  it('sends heartbeat and returns updated usage', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockHeartbeatResult));

    const result = await sendHeartbeat('session-123');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/heartbeat',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ sessionId: 'session-123' })
      })
    );
    expect(result.minutesUsed).toBe(5);
    expect(result.minutesRemaining).toBe(5);
  });

  it('includes warning when remaining <= 5', async () => {
    const resultWithWarning = {
      ...mockHeartbeatResult,
      minutesRemaining: 3,
      warning: 'Warning: Only 3 minutes remaining'
    };
    mockFetch.mockResolvedValueOnce(createSuccessResponse(resultWithWarning));

    const result = await sendHeartbeat('session-123');

    expect(result.warning).toContain('Only 3 minutes remaining');
  });
});

describe('endSession', () => {
  const mockEndResult = {
    sessionMinutes: 5,
    totalMinutesUsed: 10,
    minutesRemaining: 0
  };

  it('ends session and returns final usage', async () => {
    mockFetch.mockResolvedValueOnce(createSuccessResponse(mockEndResult));

    const result = await endSession('session-123');

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/session/end',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({ sessionId: 'session-123' })
      })
    );
    expect(result.sessionMinutes).toBe(5);
    expect(result.totalMinutesUsed).toBe(10);
    expect(result.minutesRemaining).toBe(0);
  });

  it('throws error when not authenticated', async () => {
    mockFetch.mockResolvedValueOnce(createErrorResponse('Unauthorized', 401));

    await expect(endSession('session-123')).rejects.toThrow('Not authenticated');
  });
});
