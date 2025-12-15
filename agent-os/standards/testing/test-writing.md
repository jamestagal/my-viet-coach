# Testing Standards - Speak Phở Real

Guidelines for writing tests in the SvelteKit application.

## Philosophy

Focus on testing critical paths. Don't write tests for every function.

## When to Write Tests

### DO Test

- **Critical user flows:** Authentication, payment, session start/end
- **Business logic:** Credit calculation, subscription validation
- **API endpoints:** Input validation, error handling
- **Complex utilities:** Data transformations, parsing

### DON'T Test (Yet)

- UI components (until design stabilizes)
- Simple CRUD operations
- Third-party library wrappers
- Edge cases (defer to later phases)

## Test Structure

```typescript
// src/lib/utils/credits.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateCreditsUsed, hasEnoughCredits } from './credits';

describe('credits', () => {
  describe('calculateCreditsUsed', () => {
    it('calculates minutes from session duration', () => {
      const startTime = Date.now() - 5 * 60 * 1000; // 5 minutes ago
      const result = calculateCreditsUsed(startTime);
      expect(result).toBe(5);
    });

    it('rounds up partial minutes', () => {
      const startTime = Date.now() - 5.5 * 60 * 1000;
      const result = calculateCreditsUsed(startTime);
      expect(result).toBe(6);
    });
  });

  describe('hasEnoughCredits', () => {
    it('returns true when user has remaining credits', () => {
      expect(hasEnoughCredits({ minutesUsed: 5, minutesLimit: 10 })).toBe(true);
    });

    it('returns false when credits exhausted', () => {
      expect(hasEnoughCredits({ minutesUsed: 10, minutesLimit: 10 })).toBe(false);
    });
  });
});
```

## API Endpoint Tests

```typescript
// src/routes/api/private/session/start.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('POST /api/private/session/start', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const response = await fetch('/api/private/session/start', {
      method: 'POST',
      body: JSON.stringify({ topic: 'general' }),
    });

    expect(response.status).toBe(401);
  });

  it('returns 400 when topic is missing', async () => {
    const response = await authenticatedFetch('/api/private/session/start', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.message).toContain('topic');
  });

  it('creates session when valid request', async () => {
    const response = await authenticatedFetch('/api/private/session/start', {
      method: 'POST',
      body: JSON.stringify({
        topic: 'food',
        difficulty: 'intermediate',
      }),
    });

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.sessionId).toBeDefined();
  });
});
```

## Mocking

### Mock External Services

```typescript
import { vi } from 'vitest';

// Mock Gemini API
vi.mock('$lib/voice/GeminiClient', () => ({
  GeminiClient: vi.fn().mockImplementation(() => ({
    connect: vi.fn().mockResolvedValue(true),
    disconnect: vi.fn(),
    sendAudio: vi.fn(),
  })),
}));

// Mock database
vi.mock('$lib/server/database/db', () => ({
  getDb: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }]),
  })),
}));
```

### Mock Environment Variables

```typescript
beforeEach(() => {
  vi.stubEnv('GOOGLE_API_KEY', 'test-key');
  vi.stubEnv('OPENAI_API_KEY', 'test-key');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

## Test Naming

Use descriptive names that explain the scenario:

```typescript
// Good
it('returns error when user exceeds monthly credit limit', () => {});
it('falls back to OpenAI when Gemini connection fails', () => {});
it('preserves conversation history after provider switch', () => {});

// Avoid
it('works', () => {});
it('test credit check', () => {});
it('should handle error', () => {});
```

## Running Tests

```bash
# Run all tests
pnpm --filter web test

# Run tests in watch mode
pnpm --filter web test:watch

# Run specific test file
pnpm --filter web test src/lib/utils/credits.test.ts

# Run with coverage
pnpm --filter web test:coverage
```

## Test Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';
import { sveltekit } from '@sveltejs/kit/vite';

export default defineConfig({
  plugins: [sveltekit()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
```

## Best Practices

- **Test behavior, not implementation:** Focus on inputs/outputs
- **One assertion per concept:** Keep tests focused
- **Descriptive names:** Explain the scenario being tested
- **Mock external dependencies:** Isolate the unit under test
- **Fast execution:** Tests should run in milliseconds
- **No test interdependence:** Each test should be independent

## Priority Testing Areas

1. **Authentication flow:** Login, logout, session validation
2. **Payment processing:** Subscription creation, webhook handling
3. **Credit management:** Usage tracking, limit enforcement
4. **API validation:** Input sanitization, error responses
