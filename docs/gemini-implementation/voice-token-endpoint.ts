/**
 * Voice Token Endpoint for Cloudflare Workers
 * Provides ephemeral tokens for both Gemini and OpenAI
 * 
 * Deploy to: apps/api/src/routes/voice-token.ts
 */

import { Hono } from 'hono';

type Bindings = {
  GOOGLE_API_KEY: string;
  OPENAI_API_KEY: string;
};

const app = new Hono<{ Bindings: Bindings }>();

// Types
interface TokenRequest {
  provider: 'gemini' | 'openai';
}

interface TokenResponse {
  token: string;
  provider: 'gemini' | 'openai';
  expiresIn: number; // seconds
}

/**
 * POST /api/voice-token
 * 
 * Returns an ephemeral token for the requested voice provider.
 * Tokens are short-lived to minimize exposure risk.
 */
app.post('/api/voice-token', async (c) => {
  // 1. Verify user is authenticated
  // (Add your auth check here - e.g., better-auth session validation)
  // const session = await getSession(c);
  // if (!session.userId) {
  //   return c.json({ error: 'Unauthorized' }, 401);
  // }

  // 2. Parse request
  const body = await c.req.json<TokenRequest>();
  const { provider } = body;

  if (!provider || !['gemini', 'openai'].includes(provider)) {
    return c.json({ error: 'Invalid provider. Must be "gemini" or "openai"' }, 400);
  }

  try {
    let tokenResponse: TokenResponse;

    if (provider === 'gemini') {
      // Gemini: Return API key directly (they don't have ephemeral tokens yet)
      // In production, consider creating a proxy or using a scoped key
      tokenResponse = {
        token: c.env.GOOGLE_API_KEY,
        provider: 'gemini',
        expiresIn: 900, // 15 minutes (Gemini session limit)
      };
    } else {
      // OpenAI: Create ephemeral session token
      const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o-realtime-preview',
          voice: 'coral',
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('OpenAI session creation failed:', error);
        return c.json({ error: 'Failed to create OpenAI session' }, 500);
      }

      const { client_secret } = await response.json();
      
      tokenResponse = {
        token: client_secret.value,
        provider: 'openai',
        expiresIn: 60, // OpenAI ephemeral tokens last 1 minute
      };
    }

    return c.json(tokenResponse);

  } catch (error) {
    console.error('Token generation error:', error);
    return c.json({ error: 'Internal server error' }, 500);
  }
});

export default app;
