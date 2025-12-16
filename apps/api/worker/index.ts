import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { appRouter } from './trpc/router';
import { createContext, type Env } from './trpc/context';
import {
  handleSessionStatus,
  handleSessionStart,
  handleSessionHeartbeat,
  handleSessionEnd
} from './routes/session';
import { handleUpdatePlan } from './routes/internal';

// Export Durable Object class for Cloudflare Workers runtime
export { UserUsageObject } from './durable-objects/UserUsageObject';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // CORS headers for cross-origin requests from SvelteKit frontend
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Internal-Secret, X-User-Id'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // tRPC routes
    if (url.pathname.startsWith('/trpc')) {
      return fetchRequestHandler({
        endpoint: '/trpc',
        req: request,
        router: appRouter,
        createContext: () => createContext({ req: request, env: env, workerCtx: ctx }),
        responseMeta: () => ({ headers: corsHeaders })
      });
    }

    // ========================================================================
    // Internal API Routes (Cross-Worker Communication)
    // ========================================================================

    // POST /api/internal/update-plan - Update user plan in DO (called by Polar webhooks)
    if (url.pathname === '/api/internal/update-plan' && request.method === 'POST') {
      return handleUpdatePlan(request, env, corsHeaders);
    }

    // ========================================================================
    // Session Management API Routes
    // ========================================================================

    // GET /api/session/status - Check usage status
    if (url.pathname === '/api/session/status' && request.method === 'GET') {
      return handleSessionStatus(request, env, corsHeaders);
    }

    // POST /api/session/start - Start a voice session
    if (url.pathname === '/api/session/start' && request.method === 'POST') {
      return handleSessionStart(request, env, corsHeaders);
    }

    // POST /api/session/heartbeat - Update session usage
    if (url.pathname === '/api/session/heartbeat' && request.method === 'POST') {
      return handleSessionHeartbeat(request, env, corsHeaders);
    }

    // POST /api/session/end - End a voice session
    if (url.pathname === '/api/session/end' && request.method === 'POST') {
      return handleSessionEnd(request, env, corsHeaders);
    }

    // ========================================================================
    // Existing Routes
    // ========================================================================

    // Voice token endpoint (REST - used by VoiceClient)
    if (url.pathname === '/api/voice-token' && request.method === 'POST') {
      return handleVoiceToken(request, env, corsHeaders);
    }

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response('OK', { headers: corsHeaders });
    }

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  }
} satisfies ExportedHandler<Env>;

/**
 * Handle voice token requests
 * Returns ephemeral tokens for Gemini or OpenAI voice APIs
 */
async function handleVoiceToken(
  request: Request,
  env: Env,
  corsHeaders: Record<string, string>
): Promise<Response> {
  try {
    const body = (await request.json()) as { provider: 'gemini' | 'openai' };
    const { provider } = body;

    if (!provider || !['gemini', 'openai'].includes(provider)) {
      return new Response(
        JSON.stringify({ error: 'Invalid provider. Must be "gemini" or "openai"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (provider === 'gemini') {
      // Gemini: Return API key directly
      const apiKey = env.GOOGLE_API_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'GOOGLE_API_KEY not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      return new Response(
        JSON.stringify({
          token: apiKey,
          provider: 'gemini',
          expiresIn: 900 // 15 minutes
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // OpenAI: Create ephemeral session token
      const apiKey = env.OPENAI_API_KEY;

      if (!apiKey) {
        return new Response(JSON.stringify({ error: 'OPENAI_API_KEY not configured' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'coral'
        })
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI session creation failed:', error);
        return new Response(JSON.stringify({ error: 'Failed to create OpenAI session' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

      const data = (await response.json()) as { client_secret: { value: string } };

      return new Response(
        JSON.stringify({
          token: data.client_secret.value,
          provider: 'openai',
          expiresIn: 60 // 1 minute
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Voice token error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
