# Error Handling - Speak Phở Real

Standards for handling errors in SvelteKit and Cloudflare Workers.

## SvelteKit Error Handling

### API Endpoints

```typescript
// +server.ts
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  // Auth errors
  if (!locals.session) {
    throw error(401, 'Unauthorized');
  }

  // Validation errors
  const body = await request.json();
  if (!body.email) {
    throw error(400, 'Email is required');
  }

  // Business logic errors
  try {
    const result = await processRequest(body);
    return json({ success: true, data: result });
  } catch (err) {
    // Log for debugging
    console.error('[API] Processing error:', err);

    // Return user-friendly message
    if (err instanceof ValidationError) {
      throw error(400, err.message);
    }
    if (err instanceof NotFoundError) {
      throw error(404, 'Resource not found');
    }

    // Generic server error (hide internal details)
    throw error(500, 'An error occurred. Please try again.');
  }
};
```

### Page Load Errors

```typescript
// +page.server.ts
import { error, redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  if (!locals.session) {
    throw redirect(302, '/login');
  }

  const user = await getUser(locals.session.user.id);
  if (!user) {
    throw error(404, 'User not found');
  }

  return { user };
};
```

### Client-Side Error Handling

```svelte
<script lang="ts">
  let error = $state('');
  let isLoading = $state(false);

  async function handleSubmit() {
    error = '';
    isLoading = true;

    try {
      const res = await fetch('/api/private/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || 'Request failed');
      }

      const result = await res.json();
      // Handle success
    } catch (err) {
      error = err instanceof Error ? err.message : 'An error occurred';
    } finally {
      isLoading = false;
    }
  }
</script>

{#if error}
  <div class="text-destructive text-sm">{error}</div>
{/if}
```

## Voice Client Error Handling

```typescript
// VoiceClient error callback
onError: (error, provider) => {
  console.error(`[${provider}] Error:`, error);

  // Map to user-friendly messages
  let message = 'Connection error';
  if (error.message.includes('microphone')) {
    message = 'Microphone access denied';
  } else if (error.message.includes('network')) {
    message = 'Network connection lost';
  } else if (error.message.includes('rate limit')) {
    message = 'Too many requests. Please wait.';
  }

  errorMessage = message;
  connectionState = 'error';
},
```

## External Service Errors

```typescript
async function callExternalAPI(data: unknown) {
  try {
    const response = await fetch('https://api.external.com/endpoint', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      // Log full error for debugging
      console.error('[External API] Error:', {
        status: response.status,
        statusText: response.statusText,
        body: await response.text()
      });

      // Return appropriate error based on status
      if (response.status === 429) {
        throw error(429, 'Rate limited. Please try again later.');
      }
      if (response.status >= 500) {
        throw error(502, 'External service unavailable');
      }
      throw error(400, 'Request failed');
    }

    return response.json();
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw error(408, 'Request timeout');
    }
    throw err;
  }
}
```

## Error Page

```svelte
<!-- +error.svelte -->
<script lang="ts">
  import { page } from '$app/stores';
</script>

<div class="min-h-screen flex items-center justify-center">
  <div class="text-center">
    <h1 class="text-4xl font-bold text-foreground">
      {$page.status}
    </h1>
    <p class="text-muted-foreground mt-2">
      {$page.error?.message || 'Something went wrong'}
    </p>
    <a href="/" class="mt-4 inline-block text-primary hover:underline">
      Go home
    </a>
  </div>
</div>
```

## Best Practices

- **Never expose internal errors:** Hide stack traces and implementation details
- **Log before throwing:** Always console.error before throwing to capture context
- **Use specific status codes:** 400 for client errors, 500 for server errors
- **Provide actionable messages:** Tell users what they can do to fix the issue
- **Handle async errors:** Always try/catch async operations
- **Graceful degradation:** Fallback to alternatives when non-critical services fail

## HTTP Status Codes

| Code | Use For |
|------|---------|
| 200 | Success |
| 201 | Created |
| 302 | Redirect |
| 400 | Validation error, bad request |
| 401 | Not authenticated |
| 403 | Not authorized |
| 404 | Not found |
| 408 | Timeout |
| 429 | Rate limited |
| 500 | Internal server error |
| 502 | External service error |
