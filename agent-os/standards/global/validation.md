# Input Validation - Speak Phở Real

Standards for validating user input in SvelteKit.

## Server-Side Validation

Always validate on the server, never trust client input.

### API Endpoints

```typescript
// +server.ts
import { json, error } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  // Required fields
  if (!body.email || typeof body.email !== 'string') {
    throw error(400, 'Email is required');
  }

  // Format validation
  if (!isValidEmail(body.email)) {
    throw error(400, 'Invalid email format');
  }

  // Length limits
  if (body.name && body.name.length > 100) {
    throw error(400, 'Name must be 100 characters or less');
  }

  // Enum validation
  const validDifficulties = ['beginner', 'intermediate', 'advanced'];
  if (body.difficulty && !validDifficulties.includes(body.difficulty)) {
    throw error(400, 'Invalid difficulty level');
  }

  // ... process valid data
};
```

### Validation Helpers

```typescript
// src/lib/server/validation.ts

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

export function sanitizeString(input: string): string {
  return input.trim().slice(0, 1000); // Trim and limit length
}

export function parsePositiveInt(value: unknown): number | null {
  const num = parseInt(String(value), 10);
  return Number.isFinite(num) && num > 0 ? num : null;
}
```

### Schema Validation with Zod

```typescript
import { z } from 'zod';

// Define schema
const sessionStartSchema = z.object({
  topic: z.enum(['general', 'food', 'travel', 'family', 'work', 'hobbies', 'shopping', 'culture']),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  mode: z.enum(['free', 'coach']).optional().default('coach'),
});

// Use in endpoint
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();

  const result = sessionStartSchema.safeParse(body);
  if (!result.success) {
    throw error(400, result.error.issues[0].message);
  }

  const { topic, difficulty, mode } = result.data;
  // ... process valid data
};
```

## Client-Side Validation

Use for immediate feedback, but always duplicate on server.

### Form Validation

```svelte
<script lang="ts">
  let email = $state('');
  let emailError = $state('');

  function validateEmail() {
    if (!email) {
      emailError = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      emailError = 'Invalid email format';
    } else {
      emailError = '';
    }
  }

  async function handleSubmit() {
    validateEmail();
    if (emailError) return;

    // Submit to server
  }
</script>

<form onsubmit={handleSubmit}>
  <input
    type="email"
    bind:value={email}
    onblur={validateEmail}
    class="w-full px-3 py-2 border rounded-lg {emailError ? 'border-destructive' : ''}"
  />
  {#if emailError}
    <p class="text-destructive text-sm mt-1">{emailError}</p>
  {/if}
</form>
```

### HTML5 Validation

```svelte
<input
  type="email"
  required
  minlength="3"
  maxlength="100"
  pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
/>
```

## Input Sanitization

### XSS Prevention

```typescript
// Never render raw HTML from user input
// Svelte automatically escapes by default

// If you must render HTML, sanitize first:
import DOMPurify from 'dompurify';

const cleanHtml = DOMPurify.sanitize(userInput);
```

### SQL Injection Prevention

```typescript
// Always use Drizzle ORM methods (parameterized)
await db.select().from(user).where(eq(user.email, userEmail));

// Never interpolate user input into SQL
// BAD: db.run(`SELECT * FROM user WHERE email = '${userEmail}'`)
```

## File Upload Validation

```typescript
export const POST: RequestHandler = async ({ request }) => {
  const formData = await request.formData();
  const file = formData.get('avatar') as File;

  // Check file exists
  if (!file || file.size === 0) {
    throw error(400, 'No file uploaded');
  }

  // Check file size (e.g., 5MB max)
  if (file.size > 5 * 1024 * 1024) {
    throw error(400, 'File too large (max 5MB)');
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw error(400, 'Invalid file type');
  }

  // ... process file
};
```

## Query Parameter Validation

```typescript
export const GET: RequestHandler = async ({ url }) => {
  const page = parseInt(url.searchParams.get('page') || '1', 10);
  const limit = parseInt(url.searchParams.get('limit') || '10', 10);

  // Validate and constrain
  const validPage = Math.max(1, page);
  const validLimit = Math.min(Math.max(1, limit), 100); // 1-100

  // ... use validPage and validLimit
};
```

## Best Practices

- **Server-side first:** Always validate on server, client validation is UX only
- **Allowlist over blocklist:** Define what's valid, not what's invalid
- **Fail early:** Validate before processing
- **Specific errors:** Tell users exactly what's wrong
- **Trim strings:** Always trim whitespace from text input
- **Limit lengths:** Set reasonable max lengths for all strings
- **Type coercion:** Parse numbers/booleans explicitly, don't trust types
