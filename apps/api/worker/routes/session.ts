/**
 * Session Management API Routes
 *
 * Handles voice practice session lifecycle:
 * - GET /api/session/status - Check current usage status
 * - POST /api/session/start - Start a new voice session
 * - POST /api/session/heartbeat - Update session usage
 * - POST /api/session/end - End a voice session
 */

import type { Env } from '../trpc/context';
import type { UsageStatus, SessionResult } from '../durable-objects/UserUsageObject';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface SessionStartRequest {
  topic?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

interface SessionHeartbeatRequest {
  sessionId: string;
}

interface SessionEndRequest {
  sessionId: string;
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

// Default usage status for uninitialized users
const DEFAULT_USAGE_STATUS: UsageStatus = {
  plan: 'free',
  minutesUsed: 0,
  minutesRemaining: 10,
  minutesLimit: 10,
  periodStart: '',
  periodEnd: '',
  hasActiveSession: false,
  activeSessionMinutes: 0,
  percentUsed: 0
};

// ============================================================================
// AUTHENTICATION HELPER
// ============================================================================

/**
 * Extract and validate user ID from request headers.
 * In production, this should validate a session token via Better Auth.
 * For now, we accept X-User-Id header for testing and development.
 */
function getUserIdFromRequest(request: Request): string | null {
  // Check Authorization header (Bearer token format)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    // In production: validate token via Better Auth and extract userId
    // For now: treat the token as the userId for testing
    if (token && token.length > 0) {
      return token;
    }
  }

  // Check X-User-Id header (for testing)
  const userIdHeader = request.headers.get('X-User-Id');
  if (userIdHeader && userIdHeader.length > 0) {
    return userIdHeader;
  }

  return null;
}

// ============================================================================
// SESSION STATUS ENDPOINT
// ============================================================================

/**
 * GET /api/session/status
 * Returns current usage status for the authenticated user.
 */
export async function handleSessionStatus(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' } satisfies ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const id = env.USER_USAGE.idFromName(userId);
    const stub = env.USER_USAGE.get(id);

    const status = await stub.getStatus();

    return new Response(
      JSON.stringify({ success: true, data: status } satisfies ApiResponse<UsageStatus>),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch {
    // User not initialized - return default free plan status
    const defaultStatus: UsageStatus = {
      ...DEFAULT_USAGE_STATUS,
      periodStart: new Date().toISOString().split('T')[0],
      periodEnd: new Date().toISOString().split('T')[0]
    };

    return new Response(
      JSON.stringify({ success: true, data: defaultStatus } satisfies ApiResponse<UsageStatus>),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================================
// SESSION START ENDPOINT
// ============================================================================

/**
 * POST /api/session/start
 * Starts a new voice practice session.
 *
 * Request body (optional):
 * - topic: string (default: 'general')
 * - difficulty: 'beginner' | 'intermediate' | 'advanced' (default: 'intermediate')
 *
 * Returns sessionId on success, or error with 403 status if no credits.
 */
export async function handleSessionStart(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' } satisfies ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse optional request body
  let body: SessionStartRequest = {};
  try {
    const text = await request.text();
    if (text) {
      body = JSON.parse(text);
    }
  } catch {
    // Body parsing failed - use defaults
  }

  const topic = body.topic ?? 'general';
  const difficulty = body.difficulty ?? 'intermediate';

  // Validate difficulty enum
  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  if (!validDifficulties.includes(difficulty)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid difficulty. Must be beginner, intermediate, or advanced.'
      } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const id = env.USER_USAGE.idFromName(userId);
    const stub = env.USER_USAGE.get(id);

    // Check if user is initialized, initialize if not
    try {
      await stub.getStatus();
    } catch {
      // Initialize with free plan
      await stub.initialize(userId, 'free');
    }

    // Attempt to start session
    const result: SessionResult = await stub.startSession();

    if (result.error) {
      return new Response(
        JSON.stringify({ success: false, error: result.error } satisfies ApiResponse),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const sessionId = result.sessionId!;

    // Log session start to D1
    try {
      await env.DB.prepare(
        `INSERT INTO usage_sessions (id, user_id, started_at, topic, difficulty)
         VALUES (?, ?, ?, ?, ?)`
      )
        .bind(sessionId, userId, Date.now(), topic, difficulty)
        .run();
    } catch (dbError) {
      console.error('[Session Start] Failed to log to D1:', dbError);
      // Don't fail the request - session is started, D1 logging is secondary
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { sessionId, message: 'Session started successfully' }
      } satisfies ApiResponse<{ sessionId: string; message: string }>),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Session Start] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' } satisfies ApiResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================================
// SESSION HEARTBEAT ENDPOINT
// ============================================================================

/**
 * POST /api/session/heartbeat
 * Updates session usage and returns current minutes used/remaining.
 *
 * Request body:
 * - sessionId: string (required)
 *
 * Returns minutesUsed, minutesRemaining, and optional warning if <= 5 minutes remaining.
 */
export async function handleSessionHeartbeat(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' } satisfies ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let body: SessionHeartbeatRequest;
  try {
    body = (await request.json()) as SessionHeartbeatRequest;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON body' } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate sessionId
  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'sessionId is required' } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const id = env.USER_USAGE.idFromName(userId);
    const stub = env.USER_USAGE.get(id);

    const result = await stub.heartbeat(body.sessionId);

    if ('error' in result) {
      return new Response(
        JSON.stringify({ success: false, error: result.error } satisfies ApiResponse),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Include warning if running low on credits
    const warning =
      result.remaining <= 5 ? `Warning: Only ${result.remaining} minutes remaining` : undefined;

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          minutesUsed: result.minutesUsed,
          minutesRemaining: result.remaining,
          warning
        }
      } satisfies ApiResponse<{ minutesUsed: number; minutesRemaining: number; warning?: string }>),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Session Heartbeat] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' } satisfies ApiResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

// ============================================================================
// SESSION END ENDPOINT
// ============================================================================

/**
 * POST /api/session/end
 * Ends a voice practice session and finalizes usage.
 *
 * Request body:
 * - sessionId: string (required)
 *
 * Returns sessionMinutes, totalMinutesUsed, and minutesRemaining.
 */
export async function handleSessionEnd(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  const userId = getUserIdFromRequest(request);

  if (!userId) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' } satisfies ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let body: SessionEndRequest;
  try {
    body = (await request.json()) as SessionEndRequest;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON body' } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate sessionId
  if (!body.sessionId || typeof body.sessionId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'sessionId is required' } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const id = env.USER_USAGE.idFromName(userId);
    const stub = env.USER_USAGE.get(id);

    const result: SessionResult = await stub.endSession(body.sessionId);

    // Update session record in D1
    try {
      await env.DB.prepare(
        `UPDATE usage_sessions
         SET ended_at = ?, minutes_used = ?, end_reason = ?
         WHERE id = ?`
      )
        .bind(Date.now(), result.minutesUsed ?? 0, 'user_ended', body.sessionId)
        .run();
    } catch (dbError) {
      console.error('[Session End] Failed to update D1:', dbError);
      // Don't fail the request - session is ended, D1 update is secondary
    }

    // Get updated status
    const status = await stub.getStatus();

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          sessionMinutes: result.minutesUsed ?? 0,
          totalMinutesUsed: status.minutesUsed,
          minutesRemaining: status.minutesRemaining
        }
      } satisfies ApiResponse<{
        sessionMinutes: number;
        totalMinutesUsed: number;
        minutesRemaining: number;
      }>),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Session End] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' } satisfies ApiResponse),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
