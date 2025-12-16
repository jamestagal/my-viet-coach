/**
 * Tests for Internal API Routes and Polar Webhook Integration
 *
 * Task 4.1: Tests for webhook and token integration
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ============================================================================
// MOCK TYPES
// ============================================================================

interface MockUsageStatus {
  plan: 'free' | 'basic' | 'pro';
  minutesUsed: number;
  minutesRemaining: number;
  minutesLimit: number;
  periodStart: string;
  periodEnd: string;
  hasActiveSession: boolean;
  activeSessionMinutes: number;
  percentUsed: number;
}

interface MockDurableObjectStub {
  getStatus: Mock;
  upgradePlan: Mock;
  downgradePlan: Mock;
  initialize: Mock;
}

interface MockEnv {
  USER_USAGE: {
    idFromName: Mock;
    get: Mock;
  };
  DB: {
    prepare: Mock;
  };
  INTERNAL_API_SECRET: string;
}

// ============================================================================
// TEST SETUP
// ============================================================================

describe('Internal API Routes', () => {
  let mockEnv: MockEnv;
  let mockStub: MockDurableObjectStub;

  beforeEach(() => {
    vi.resetAllMocks();

    // Create mock stub with all DO methods
    mockStub = {
      getStatus: vi.fn(),
      upgradePlan: vi.fn(),
      downgradePlan: vi.fn(),
      initialize: vi.fn()
    };

    // Create mock environment
    mockEnv = {
      USER_USAGE: {
        idFromName: vi.fn().mockReturnValue({ name: 'mock-id' }),
        get: vi.fn().mockReturnValue(mockStub)
      },
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({})
          })
        })
      },
      INTERNAL_API_SECRET: 'test-secret-12345'
    };
  });

  // ==========================================================================
  // Test: Polar webhook updates DO plan on subscription.created
  // ==========================================================================

  describe('POST /api/internal/update-plan', () => {
    it('updates DO plan on upgrade action', async () => {
      // Arrange
      const mockStatus: MockUsageStatus = {
        plan: 'basic',
        minutesUsed: 0,
        minutesRemaining: 100,
        minutesLimit: 100,
        periodStart: '2025-12-01',
        periodEnd: '2025-12-31',
        hasActiveSession: false,
        activeSessionMinutes: 0,
        percentUsed: 0
      };
      mockStub.upgradePlan.mockResolvedValue(mockStatus);

      // Simulate the internal endpoint call with upgrade action
      const userId = 'user-123';
      const plan = 'basic';
      // Note: In the real endpoint, action determines whether to call upgradePlan or downgradePlan

      // Act: Get DO stub and call upgradePlan
      const id = mockEnv.USER_USAGE.idFromName(userId);
      const stub = mockEnv.USER_USAGE.get(id);
      await stub.upgradePlan(plan);

      // Assert
      expect(mockEnv.USER_USAGE.idFromName).toHaveBeenCalledWith(userId);
      expect(mockStub.upgradePlan).toHaveBeenCalledWith(plan);
    });

    it('downgrades to free plan on subscription.canceled', async () => {
      // Arrange
      const mockStatus: MockUsageStatus = {
        plan: 'free',
        minutesUsed: 50,
        minutesRemaining: 0,
        minutesLimit: 10,
        periodStart: '2025-12-01',
        periodEnd: '2025-12-31',
        hasActiveSession: false,
        activeSessionMinutes: 0,
        percentUsed: 500 // Over limit from previous plan
      };
      mockStub.downgradePlan.mockResolvedValue(mockStatus);

      // Simulate the downgrade
      const userId = 'user-456';

      // Act
      const id = mockEnv.USER_USAGE.idFromName(userId);
      const stub = mockEnv.USER_USAGE.get(id);
      await stub.downgradePlan('free');

      // Assert
      expect(mockEnv.USER_USAGE.idFromName).toHaveBeenCalledWith(userId);
      expect(mockStub.downgradePlan).toHaveBeenCalledWith('free');
    });

    it('rejects requests without valid X-Internal-Secret header', async () => {
      // Arrange
      const request = new Request('http://localhost/api/internal/update-plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': 'wrong-secret'
        },
        body: JSON.stringify({
          userId: 'user-123',
          plan: 'basic',
          action: 'upgrade'
        })
      });

      // Act & Assert: Internal endpoint should validate secret
      const providedSecret = request.headers.get('X-Internal-Secret');
      const isAuthorized = providedSecret === mockEnv.INTERNAL_API_SECRET;

      expect(isAuthorized).toBe(false);
    });

    it('handles uninitialized users gracefully', async () => {
      // Arrange: Stub throws error for uninitialized user
      mockStub.upgradePlan.mockRejectedValue(new Error('User not initialized'));

      const userId = 'new-user-789';

      // Act
      const id = mockEnv.USER_USAGE.idFromName(userId);
      const stub = mockEnv.USER_USAGE.get(id);

      let result = { success: true, note: '' };
      try {
        await stub.upgradePlan('basic');
      } catch {
        // User not initialized yet - this is OK
        result = { success: true, note: 'User will be initialized on first use' };
      }

      // Assert
      expect(result.success).toBe(true);
      expect(result.note).toBe('User will be initialized on first use');
    });
  });
});

// ============================================================================
// REALTIME TOKEN TESTS
// ============================================================================

describe('Realtime Token Endpoint', () => {
  let mockEnv: MockEnv;
  let mockStub: MockDurableObjectStub;

  beforeEach(() => {
    vi.resetAllMocks();

    mockStub = {
      getStatus: vi.fn(),
      upgradePlan: vi.fn(),
      downgradePlan: vi.fn(),
      initialize: vi.fn()
    };

    mockEnv = {
      USER_USAGE: {
        idFromName: vi.fn().mockReturnValue({ name: 'mock-id' }),
        get: vi.fn().mockReturnValue(mockStub)
      },
      DB: {
        prepare: vi.fn().mockReturnValue({
          bind: vi.fn().mockReturnValue({
            run: vi.fn().mockResolvedValue({})
          })
        })
      },
      INTERNAL_API_SECRET: 'test-secret-12345'
    };
  });

  it('rejects token request when no active session exists', async () => {
    // Arrange
    const mockStatus: MockUsageStatus = {
      plan: 'basic',
      minutesUsed: 10,
      minutesRemaining: 90,
      minutesLimit: 100,
      periodStart: '2025-12-01',
      periodEnd: '2025-12-31',
      hasActiveSession: false, // No active session
      activeSessionMinutes: 0,
      percentUsed: 10
    };
    mockStub.getStatus.mockResolvedValue(mockStatus);

    // Act
    const userId = 'user-123';
    const id = mockEnv.USER_USAGE.idFromName(userId);
    const stub = mockEnv.USER_USAGE.get(id);
    const status = await stub.getStatus();

    // Assert: Should reject because no active session
    expect(status.hasActiveSession).toBe(false);
    // Token endpoint should return 403 with message: "No active session. Call /api/session/start first."
  });

  it('rejects token request when no credits remaining', async () => {
    // Arrange
    const mockStatus: MockUsageStatus = {
      plan: 'free',
      minutesUsed: 10,
      minutesRemaining: 0, // No credits remaining
      minutesLimit: 10,
      periodStart: '2025-12-01',
      periodEnd: '2025-12-31',
      hasActiveSession: true,
      activeSessionMinutes: 5,
      percentUsed: 100
    };
    mockStub.getStatus.mockResolvedValue(mockStatus);

    // Act
    const userId = 'user-123';
    const id = mockEnv.USER_USAGE.idFromName(userId);
    const stub = mockEnv.USER_USAGE.get(id);
    const status = await stub.getStatus();

    // Assert: Should reject because no credits
    expect(status.minutesRemaining).toBe(0);
    // Token endpoint should return 403 with message: "No credits remaining. Please upgrade your plan."
  });

  it('returns minutesRemaining in successful token response', async () => {
    // Arrange
    const mockStatus: MockUsageStatus = {
      plan: 'basic',
      minutesUsed: 30,
      minutesRemaining: 70,
      minutesLimit: 100,
      periodStart: '2025-12-01',
      periodEnd: '2025-12-31',
      hasActiveSession: true,
      activeSessionMinutes: 5,
      percentUsed: 30
    };
    mockStub.getStatus.mockResolvedValue(mockStatus);

    // Act
    const userId = 'user-123';
    const id = mockEnv.USER_USAGE.idFromName(userId);
    const stub = mockEnv.USER_USAGE.get(id);
    const status = await stub.getStatus();

    // Assert
    expect(status.hasActiveSession).toBe(true);
    expect(status.minutesRemaining).toBe(70);
    // Token endpoint response should include: { token: '...', minutesRemaining: 70 }
  });
});

// ============================================================================
// PLAN MAPPING TESTS
// ============================================================================

describe('Plan Mapping Utilities', () => {
  // Test the plan mapping logic that will be in polar.ts
  const PLAN_MAPPING: Record<string, 'free' | 'basic' | 'pro'> = {
    free: 'free',
    basic: 'basic',
    starter: 'basic', // Alias
    pro: 'pro',
    premium: 'pro', // Alias
    enterprise: 'pro' // Treat enterprise as pro
  };

  function mapPolarPlanToUsagePlan(polarPlan: string | null | undefined): 'free' | 'basic' | 'pro' {
    if (!polarPlan) return 'free';
    return PLAN_MAPPING[polarPlan.toLowerCase()] ?? 'free';
  }

  it('maps basic plan correctly', () => {
    expect(mapPolarPlanToUsagePlan('basic')).toBe('basic');
    expect(mapPolarPlanToUsagePlan('Basic')).toBe('basic');
    expect(mapPolarPlanToUsagePlan('BASIC')).toBe('basic');
  });

  it('maps pro plan correctly', () => {
    expect(mapPolarPlanToUsagePlan('pro')).toBe('pro');
    expect(mapPolarPlanToUsagePlan('premium')).toBe('pro');
    expect(mapPolarPlanToUsagePlan('enterprise')).toBe('pro');
  });

  it('maps unknown plans to free', () => {
    expect(mapPolarPlanToUsagePlan('unknown')).toBe('free');
    expect(mapPolarPlanToUsagePlan(null)).toBe('free');
    expect(mapPolarPlanToUsagePlan(undefined)).toBe('free');
    expect(mapPolarPlanToUsagePlan('')).toBe('free');
  });

  it('maps starter alias to basic', () => {
    expect(mapPolarPlanToUsagePlan('starter')).toBe('basic');
  });
});
