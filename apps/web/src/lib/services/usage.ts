/**
 * Usage Service
 *
 * Client-side functions for managing voice session usage.
 * Communicates with the API worker session management endpoints.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface UsageStatus {
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

export interface SessionStartOptions {
  topic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

export interface SessionStartResult {
  sessionId: string;
  message: string;
}

export interface HeartbeatResult {
  minutesUsed: number;
  minutesRemaining: number;
  warning?: string;
}

export interface SessionEndResult {
  sessionMinutes: number;
  totalMinutesUsed: number;
  minutesRemaining: number;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/**
 * Get the base API URL.
 * In production, this should point to the API worker.
 * In development, we can use a local proxy or direct URL.
 */
function getApiBaseUrl(): string {
  // Check for environment variable (set in SvelteKit config)
  if (typeof window !== 'undefined') {
    // Client-side: use relative path which will be proxied
    return '';
  }
  // Server-side: use configured URL or default
  return import.meta.env.VITE_API_URL ?? '';
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Get current usage status for the authenticated user.
 *
 * @returns UsageStatus object with plan details and remaining minutes
 * @throws Error if request fails or user is not authenticated
 */
export async function getUsageStatus(): Promise<UsageStatus> {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/session/status`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    throw new Error(`Failed to get usage status: ${response.statusText}`);
  }

  const result = (await response.json()) as ApiResponse<UsageStatus>;

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to get usage status');
  }

  return result.data!;
}

/**
 * Start a new voice practice session.
 *
 * @param options - Optional topic and difficulty settings
 * @returns Session result with sessionId
 * @throws Error if no credits available or session already active
 */
export async function startSession(
  options: SessionStartOptions = {}
): Promise<SessionStartResult> {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/session/start`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(options)
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    if (response.status === 403) {
      const result = (await response.json()) as ApiResponse;
      throw new Error(result.error ?? 'No credits available');
    }
    throw new Error(`Failed to start session: ${response.statusText}`);
  }

  const result = (await response.json()) as ApiResponse<SessionStartResult>;

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to start session');
  }

  return result.data!;
}

/**
 * Send a heartbeat to update session usage.
 * Should be called every 30 seconds during an active session.
 *
 * @param sessionId - The active session ID
 * @returns Heartbeat result with updated usage stats
 * @throws Error if session is invalid or not active
 */
export async function sendHeartbeat(sessionId: string): Promise<HeartbeatResult> {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/session/heartbeat`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    throw new Error(`Failed to send heartbeat: ${response.statusText}`);
  }

  const result = (await response.json()) as ApiResponse<HeartbeatResult>;

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to send heartbeat');
  }

  return result.data!;
}

/**
 * End an active voice practice session.
 *
 * @param sessionId - The session ID to end
 * @returns Session end result with final usage stats
 * @throws Error if session is invalid
 */
export async function endSession(sessionId: string): Promise<SessionEndResult> {
  const baseUrl = getApiBaseUrl();

  const response = await fetch(`${baseUrl}/api/session/end`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sessionId })
  });

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Not authenticated');
    }
    throw new Error(`Failed to end session: ${response.statusText}`);
  }

  const result = (await response.json()) as ApiResponse<SessionEndResult>;

  if (!result.success) {
    throw new Error(result.error ?? 'Failed to end session');
  }

  return result.data!;
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate the color class for a progress bar based on percentage used.
 * - Green: < 75%
 * - Amber: 75-90% (inclusive)
 * - Red: > 90%
 *
 * @param percentUsed - Percentage of credits used (0-100)
 * @returns Tailwind color class
 */
export function getUsageColorClass(percentUsed: number): string {
  if (percentUsed > 90) {
    return 'bg-red-500';
  }
  if (percentUsed >= 75) {
    return 'bg-amber-500';
  }
  return 'bg-emerald-500';
}

/**
 * Check if remaining credits are low (5 minutes or less).
 *
 * @param minutesRemaining - Minutes remaining in the billing period
 * @returns True if credits are low
 */
export function isLowOnCredits(minutesRemaining: number): boolean {
  return minutesRemaining <= 5;
}

/**
 * Check if credits are exhausted.
 *
 * @param minutesRemaining - Minutes remaining in the billing period
 * @returns True if no credits remaining
 */
export function hasNoCredits(minutesRemaining: number): boolean {
  return minutesRemaining <= 0;
}

/**
 * Format plan name for display.
 *
 * @param plan - Plan type
 * @returns Formatted plan name
 */
export function formatPlanName(plan: 'free' | 'basic' | 'pro'): string {
  const names: Record<typeof plan, string> = {
    free: 'Free',
    basic: 'Basic',
    pro: 'Pro'
  };
  return names[plan];
}
