/**
 * Internal API Routes
 *
 * These endpoints are for cross-worker communication only.
 * They are protected by the INTERNAL_API_SECRET header.
 *
 * Endpoints:
 * - POST /api/internal/update-plan - Update user plan in Durable Object
 */

import type { Env } from '../trpc/context';
import type { PlanType } from '../durable-objects/UserUsageObject';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface UpdatePlanRequest {
  userId: string;
  plan: PlanType;
  action: 'upgrade' | 'downgrade' | 'cancel';
}

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  note?: string;
}

// ============================================================================
// INTERNAL AUTHENTICATION
// ============================================================================

/**
 * Verify the internal API secret for cross-worker communication.
 * Returns true if the request is authorized.
 */
function verifyInternalSecret(request: Request, env: Env): boolean {
  const secret = request.headers.get('X-Internal-Secret');
  const expectedSecret = env.INTERNAL_API_SECRET;

  // If no secret is configured, reject all requests
  if (!expectedSecret) {
    console.error('[Internal API] INTERNAL_API_SECRET not configured');
    return false;
  }

  return secret === expectedSecret;
}

// ============================================================================
// UPDATE PLAN ENDPOINT
// ============================================================================

/**
 * POST /api/internal/update-plan
 *
 * Updates the user's plan in the Durable Object.
 * Called by the SvelteKit web app when Polar webhooks fire.
 *
 * Headers:
 * - X-Internal-Secret: string (required)
 *
 * Request body:
 * - userId: string (required)
 * - plan: 'free' | 'basic' | 'pro' (required)
 * - action: 'upgrade' | 'downgrade' | 'cancel' (required)
 *
 * Response:
 * - success: boolean
 * - note?: string (if user not initialized)
 */
export async function handleUpdatePlan(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  // Verify internal secret
  if (!verifyInternalSecret(request, env)) {
    return new Response(
      JSON.stringify({ success: false, error: 'Unauthorized' } satisfies ApiResponse),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Parse request body
  let body: UpdatePlanRequest;
  try {
    body = (await request.json()) as UpdatePlanRequest;
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON body' } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Validate required fields
  if (!body.userId || typeof body.userId !== 'string') {
    return new Response(
      JSON.stringify({ success: false, error: 'userId is required' } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.plan || !['free', 'basic', 'pro'].includes(body.plan)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'plan must be free, basic, or pro'
      } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  if (!body.action || !['upgrade', 'downgrade', 'cancel'].includes(body.action)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'action must be upgrade, downgrade, or cancel'
      } satisfies ApiResponse),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const id = env.USER_USAGE.idFromName(body.userId);
    const stub = env.USER_USAGE.get(id);

    if (body.action === 'upgrade') {
      await stub.upgradePlan(body.plan);
      console.log(`[Internal API] Upgraded user ${body.userId} to ${body.plan} plan`);
    } else {
      // downgrade or cancel - set to free plan
      await stub.downgradePlan('free');
      console.log(`[Internal API] Downgraded user ${body.userId} to free plan`);
    }

    return new Response(
      JSON.stringify({ success: true } satisfies ApiResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // User might not be initialized yet - this is OK
    // The DO will be initialized with the correct plan on first use
    console.log(
      `[Internal API] User ${body.userId} not initialized, plan will be set on first use`
    );

    return new Response(
      JSON.stringify({
        success: true,
        note: 'User will be initialized on first use'
      } satisfies ApiResponse),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}
