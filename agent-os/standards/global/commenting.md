# Code Comments - Speak Phở Real

Standards for writing helpful, minimal comments.

## Philosophy

Code should be self-documenting. Comments explain *why*, not *what*.

## When to Comment

### DO Comment

```typescript
// Gemini API requires specific audio format for Vietnamese language support
const audioConfig = {
  sampleRate: 16000,
  encoding: 'LINEAR16',
};

// Better Auth requires lazy initialization because D1 bindings
// are only available at request time on Cloudflare Workers
let authInstance: ReturnType<typeof betterAuth> | null = null;

// Debounce to aggregate fragmented transcription chunks
// Gemini sends partial results every 100-200ms
const DEBOUNCE_MS = 500;
```

### DO NOT Comment

```typescript
// Bad: Explains what the code does (obvious from reading)
// Get the user from the database
const user = await db.select().from(users).where(eq(users.id, userId));

// Bad: Comments about recent changes
// Fixed bug where email wasn't validated - John 12/15
if (!isValidEmail(email)) { ... }

// Bad: Commented-out code
// const oldImplementation = () => { ... }

// Bad: TODO without context
// TODO: fix this
```

## Comment Styles

### File Headers

Only for files with non-obvious purpose:

```typescript
/**
 * VoiceClient - Unified interface for voice AI providers
 *
 * Abstracts Gemini Live API and OpenAI Realtime API behind a common
 * interface with automatic fallback when primary provider fails.
 */
```

### Function Documentation

For exported utilities and complex logic:

```typescript
/**
 * Maps WebSocket close codes to human-readable disconnect reasons.
 * @param code - WebSocket close code (1000, 1001, 1006, etc.)
 * @returns User-friendly disconnect message
 */
export function getDisconnectReason(code: number): string {
  // ...
}
```

### Inline Comments

Short, explain non-obvious decisions:

```typescript
async function startSession() {
  // Check credits before connecting to avoid wasted API calls
  const hasCredits = await checkUserCredits();
  if (!hasCredits) return;

  // Gemini first, OpenAI as fallback for reliability
  const providers = ['gemini', 'openai'];
}
```

### Section Comments

For long files with distinct sections:

```typescript
// ════════════════════════════════════════════════════════════════
// STATE
// ════════════════════════════════════════════════════════════════

let connectionState = $state<'disconnected' | 'connecting' | 'connected'>('disconnected');
let conversationHistory = $state<Message[]>([]);

// ════════════════════════════════════════════════════════════════
// VOICE SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════════

async function startSession() { ... }
async function endSession() { ... }
```

## Best Practices

- **Self-documenting code first:** Good naming > comments
- **Evergreen comments:** Write for future readers, not recent changes
- **No commented-out code:** Delete it; Git has history
- **Update or delete:** Outdated comments are worse than none
- **Keep it short:** One line when possible
