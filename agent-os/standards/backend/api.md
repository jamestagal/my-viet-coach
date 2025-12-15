# API Endpoints - Speak Phở Real

Standards for SvelteKit API routes and endpoint design.

## Endpoint Structure

SvelteKit uses file-based routing for API endpoints:

```
src/routes/api/
  private/                    # Authenticated endpoints
    session/+server.ts        # /api/private/session
    extract-corrections/+server.ts
  public/                     # Public endpoints
    health/+server.ts         # /api/public/health
  polar/
    webhooks/+server.ts       # /api/polar/webhooks
    checkout/+server.ts       # /api/polar/checkout
  auth/                       # Better Auth handlers
    [...all]/+server.ts       # /api/auth/*
```

## Endpoint Pattern

```typescript
// src/routes/api/private/example/+server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals, platform }) => {
  // 1. Check authentication
  const session = locals.session;
  if (!session) {
    throw error(401, 'Unauthorized');
  }

  // 2. Parse and validate request body
  const body = await request.json();
  if (!body.requiredField) {
    throw error(400, 'Missing required field');
  }

  // 3. Access runtime environment (Cloudflare Workers)
  const apiKey = platform?.env?.GOOGLE_API_KEY;

  // 4. Process request
  try {
    const result = await processData(body);
    return json({ success: true, data: result });
  } catch (err) {
    console.error('[API] Error:', err);
    throw error(500, 'Internal server error');
  }
};

export const GET: RequestHandler = async ({ url, locals }) => {
  // Query parameters
  const page = url.searchParams.get('page') || '1';
  const limit = url.searchParams.get('limit') || '10';

  return json({ success: true, data: [] });
};
```

## Response Format

Always return consistent JSON structure:

```typescript
// Success response
return json({
  success: true,
  data: {
    // ... response data
  }
});

// Success with pagination
return json({
  success: true,
  data: items,
  pagination: {
    page: 1,
    limit: 10,
    total: 100
  }
});

// Error response (via throw error())
throw error(400, 'Validation failed');
// Results in: { "message": "Validation failed" }
```

## HTTP Methods

| Method | Purpose | Example |
|--------|---------|---------|
| GET | Retrieve data | Get user profile, list sessions |
| POST | Create resource or action | Start session, process corrections |
| PATCH | Partial update | Update settings |
| DELETE | Remove resource | Delete account |

## Authentication

Check `locals.session` for authenticated endpoints:

```typescript
export const POST: RequestHandler = async ({ locals }) => {
  const session = locals.session;
  if (!session) {
    throw error(401, 'Unauthorized');
  }

  const userId = session.user.id;
  // ... use userId
};
```

## Environment Variables

Access runtime secrets via `platform.env`:

```typescript
export const POST: RequestHandler = async ({ platform }) => {
  // Runtime secrets (Cloudflare Workers)
  const googleApiKey = platform?.env?.GOOGLE_API_KEY;
  const openaiKey = platform?.env?.OPENAI_API_KEY;

  if (!googleApiKey) {
    throw error(500, 'Missing API configuration');
  }
};
```

## External API Calls

```typescript
// Call external service
const response = await fetch('https://api.example.com/endpoint', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${apiKey}`
  },
  body: JSON.stringify(payload)
});

if (!response.ok) {
  console.error('[API] External service error:', response.status);
  throw error(502, 'External service unavailable');
}

const data = await response.json();
```

## Webhooks

```typescript
// src/routes/api/polar/webhooks/+server.ts
export const POST: RequestHandler = async ({ request }) => {
  // 1. Verify webhook signature
  const signature = request.headers.get('x-webhook-signature');
  const body = await request.text();

  if (!verifySignature(body, signature, webhookSecret)) {
    throw error(401, 'Invalid signature');
  }

  // 2. Parse payload
  const payload = JSON.parse(body);

  // 3. Handle event
  switch (payload.type) {
    case 'subscription.created':
      await handleSubscriptionCreated(payload.data);
      break;
    // ... other events
  }

  return json({ received: true });
};
```

## Best Practices

- **Auth first:** Check authentication before any processing
- **Validate input:** Always validate request body and query params
- **Typed responses:** Use TypeScript interfaces for request/response
- **Error handling:** Use `throw error()` for consistent error responses
- **Logging:** Log errors with context for debugging
- **No secrets in responses:** Never expose API keys or internal errors
