# Gemini Voice Implementation - Changelog

> **Date:** December 14, 2024  
> **Purpose:** Add Gemini 2.5 Flash Native Audio as primary voice provider with OpenAI fallback

---

## Summary of Changes

This implementation adds Gemini Live API support for ~50-70% cost savings while maintaining OpenAI Realtime API as a reliable fallback.

---

## Files Modified

### 1. `apps/web/src/routes/api/private/realtime-token/+server.ts`

**Purpose:** Updated to support both Gemini and OpenAI token generation

**Before:**
```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ locals, request }) => {
  // Only supported OpenAI
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, voice: 'coral' })
  });
  // ...
};
```

**After:**
```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { OPENAI_API_KEY, GOOGLE_API_KEY } from '$env/static/private';

export const POST: RequestHandler = async ({ locals, request }) => {
  const body = await request.json().catch(() => ({}));
  const provider = body.provider || 'gemini';  // Default to Gemini

  if (provider === 'gemini') {
    // Return Google API key for Gemini Live API
    return json({
      token: GOOGLE_API_KEY,
      provider: 'gemini',
      expiresIn: 900, // 15 minutes
    });
  } else if (provider === 'openai') {
    // Create ephemeral OpenAI session token
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', ...);
    return json({
      token: data.client_secret?.value,
      provider: 'openai',
      expiresIn: 60,
    });
  }
};
```

**Key Changes:**
- Added `GOOGLE_API_KEY` import
- Added `provider` parameter to request body
- Returns different tokens based on provider
- Gemini returns API key directly (no ephemeral token API yet)
- Added `expiresIn` to response for session management

---

### 2. `apps/web/src/lib/voice/VoiceClient.ts`

**Purpose:** New provider abstraction layer with automatic fallback

**This is a NEW file** that provides:
- `BaseVoiceProvider` - Abstract base class
- `GeminiVoiceProvider` - Gemini Live API implementation (WebSocket)
- `OpenAIVoiceProvider` - OpenAI Realtime API implementation (WebRTC)
- `VoiceClient` - Unified client with automatic fallback

**Key Features:**
```typescript
// Automatic fallback when primary fails
const client = new VoiceClient(
  config,
  events,
  'gemini',  // Primary provider
  'openai'   // Fallback provider
);

// Events for UI updates
events: {
  onConnected: (provider) => { /* Update UI badge */ },
  onProviderFallback: (from, to, reason) => { /* Show fallback notice */ },
  onSessionTimeWarning: (remainingSeconds) => { /* Show warning */ },
}

// Session management for Gemini 15-min limit
client.reconnect();  // Extend session
client.getActiveProvider();  // 'gemini' | 'openai'
```

**Minor Edit Made:**
Changed API endpoint from `/api/voice-token` to `/api/private/realtime-token` to match your existing route structure.

---

### 3. `apps/web/wrangler.toml`

**Purpose:** Added documentation for new environment variable

**Before:**
```toml
# Environment variables that need to be set in Cloudflare dashboard:
# - OPENAI_API_KEY
# - GOOGLE_CLIENT_ID
```

**After:**
```toml
# Environment variables that need to be set in Cloudflare dashboard:
# - OPENAI_API_KEY (for OpenAI Realtime API fallback)
# - GOOGLE_API_KEY (for Gemini Live API - primary voice provider)
# - GOOGLE_CLIENT_ID
```

---

## Files Created (Documentation Only)

These files in `docs/gemini-implementation/` are reference copies, not part of the running app:

| File | Purpose |
|------|---------|
| `IMPLEMENTATION_GUIDE.md` | Setup and usage guide |
| `VoiceClient.ts` | Reference copy of the voice client |
| `PracticePage.svelte` | Example UI implementation |
| `voice-token-endpoint.ts` | Alternative endpoint (not used) |

---

## Files Created (Can Be Deleted)

These were created before I discovered your SvelteKit route structure. They're **not needed**:

| File | Status |
|------|--------|
| `apps/api/worker/trpc/routers/voice.ts` | ❌ Delete - not needed |
| `apps/api/worker/index.ts` (REST endpoint section) | ❌ Can revert changes |
| `apps/api/worker/trpc/context.ts` (env vars) | ⚠️ Keep if using tRPC elsewhere |
| `apps/api/worker/trpc/router.ts` (voice import) | ⚠️ Remove voice import if deleting |

---

## Environment Variables Required

Add to `.dev.vars` for local development:
```
GOOGLE_API_KEY=your_google_api_key_here
```

Add to Cloudflare Dashboard for production:
- Go to Workers & Pages → Settings → Variables
- Add `GOOGLE_API_KEY` as encrypted variable

---


## UI Changes Required for Practice Page

The current `+page.svelte` uses `RealtimeClient` (OpenAI only). To use the new `VoiceClient` with Gemini + fallback, make these changes:

### 1. Update Imports

```svelte
<script lang="ts">
  // BEFORE
  import {
    RealtimeClient,
    createFreeConversationConfig,
    createCoachModeConfig,
    // ...
  } from '$lib/voice/RealtimeClient';

  // AFTER
  import {
    VoiceClient,
    type VoiceProvider,
    type VoiceClientEvents,
  } from '$lib/voice/VoiceClient';
  import {
    createFreeConversationConfig,
    createCoachModeConfig,
  } from '$lib/voice/RealtimeClient';  // Keep config helpers
</script>
```

### 2. Add New State Variables

```svelte
<script lang="ts">
  // Existing state...
  
  // ADD: Provider tracking
  let activeProvider = $state<VoiceProvider | null>(null);
  let showFallbackNotice = $state(false);
  let fallbackReason = $state('');
  let showSessionWarning = $state(false);
  let sessionWarningSeconds = $state(0);
</script>
```

### 3. Update Client Type

```svelte
<script lang="ts">
  // BEFORE
  let client: RealtimeClient | null = null;

  // AFTER  
  let client: VoiceClient | null = null;
</script>
```

### 4. Update `startSession()` Function

```svelte
<script lang="ts">
  async function startSession() {
    connectionState = 'connecting';
    errorMessage = '';
    // Reset provider state
    activeProvider = null;
    showFallbackNotice = false;
    fallbackReason = '';
    showSessionWarning = false;

    try {
      const config = getConfigForMode(selectedMode);

      // Create VoiceClient with Gemini as primary, OpenAI as fallback
      client = new VoiceClient(
        {
          systemPrompt: config.instructions,
          voice: selectedMode === 'coach' ? 'Kore' : 'Puck',  // Gemini voices
          language: 'vi',
        },
        {
          onConnected: (provider) => {
            activeProvider = provider;
            connectionState = 'connected';
          },
          onDisconnected: (reason) => {
            connectionState = 'disconnected';
          },
          onUserTranscript: (text) => {
            if (text.trim()) {
              conversationHistory = [...conversationHistory, {
                role: 'user',
                text: text.trim(),
                timestamp: Date.now()
              }];
              sessionTranscript = [...sessionTranscript, {
                role: 'user',
                text: text.trim(),
                timestamp: Date.now()
              }];
              scrollToBottom();
            }
          },
          onCoachResponse: (text, isFinal) => {
            if (isFinal) {
              const finalText = text.length >= streamingCoachText.length ? text : streamingCoachText;
              if (finalText.trim()) {
                conversationHistory = [...conversationHistory, {
                  role: 'coach',
                  text: finalText.trim(),
                  timestamp: Date.now()
                }];
                sessionTranscript = [...sessionTranscript, {
                  role: 'coach',
                  text: finalText.trim(),
                  timestamp: Date.now()
                }];
              }
              streamingCoachText = '';
            } else {
              streamingCoachText = text;
            }
            scrollToBottom();
          },
          onCoachAudio: (audioData) => {
            // Handle audio if needed (WebRTC handles playback for OpenAI)
          },
          onError: (error, provider) => {
            errorMessage = `${provider}: ${error.message}`;
            connectionState = 'error';
          },
          onProviderFallback: (from, to, reason) => {
            showFallbackNotice = true;
            fallbackReason = reason;
            console.warn(`Switched from ${from} to ${to}: ${reason}`);
          },
          onSessionTimeWarning: (remainingSeconds) => {
            showSessionWarning = true;
            sessionWarningSeconds = remainingSeconds;
          },
        },
        'gemini',  // Primary provider
        'openai'   // Fallback provider
      );

      await client.connect();
    } catch (err) {
      errorMessage = err instanceof Error ? err.message : 'Failed to connect';
      connectionState = 'error';
    }
  }
</script>
```

### 5. Add `extendSession()` Function

```svelte
<script lang="ts">
  // Handle Gemini 15-minute session limit
  async function extendSession() {
    if (!client) return;
    showSessionWarning = false;
    
    try {
      await client.reconnect();
    } catch (err) {
      errorMessage = 'Failed to extend session';
    }
  }
</script>
```

### 6. Add Provider Badge UI (in Session Header)

```svelte
<!-- In the session header section, add provider badge -->
<div class="flex items-center justify-between px-4 py-3 border-b border-border/50">
  <div class="flex items-center gap-3">
    <!-- Existing mode badge -->
    <span class="mode-badge {selectedMode}">
      <!-- ... -->
    </span>
    
    <!-- ADD: Provider badge -->
    {#if activeProvider}
      <span class="provider-badge {activeProvider}">
        {#if activeProvider === 'gemini'}
          🔵 Gemini
        {:else}
          🟢 OpenAI
        {/if}
        {#if showFallbackNotice}
          <span class="text-xs opacity-70">(fallback)</span>
        {/if}
      </span>
    {/if}
  </div>
  <!-- ... rest of header -->
</div>
```

### 7. Add Fallback Notice Banner

```svelte
<!-- Add after session header, before voice interface -->
{#if showFallbackNotice}
  <div class="fallback-notice">
    <span class="text-amber-600">⚠️</span>
    <span>Using OpenAI as fallback. Reason: {fallbackReason}</span>
    <button 
      onclick={() => showFallbackNotice = false}
      class="ml-auto text-amber-600 hover:text-amber-800"
    >
      ✕
    </button>
  </div>
{/if}
```

### 8. Add Session Warning Banner

```svelte
<!-- Add near the fallback notice -->
{#if showSessionWarning}
  <div class="session-warning">
    <span>⏱️</span>
    <span>Session ending in {sessionWarningSeconds}s</span>
    <button 
      onclick={extendSession}
      class="btn-small"
    >
      Extend Session
    </button>
  </div>
{/if}
```

### 9. Add New CSS Styles

```svelte
<style>
  /* Provider Badge */
  .provider-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .provider-badge.gemini {
    background: hsl(217 91% 60% / 0.15);
    color: hsl(217 91% 50%);
  }

  .provider-badge.openai {
    background: hsl(142 71% 45% / 0.15);
    color: hsl(142 71% 35%);
  }

  /* Fallback Notice */
  .fallback-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: hsl(45 93% 47% / 0.1);
    border-bottom: 1px solid hsl(45 93% 47% / 0.2);
    font-size: 0.875rem;
    color: hsl(45 93% 30%);
  }

  /* Session Warning */
  .session-warning {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: hsl(25 95% 53% / 0.1);
    border-bottom: 1px solid hsl(25 95% 53% / 0.2);
    font-size: 0.875rem;
    color: hsl(25 95% 35%);
  }

  .btn-small {
    padding: 0.25rem 0.75rem;
    background: hsl(var(--primary));
    color: white;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .btn-small:hover {
    background: hsl(var(--primary) / 0.9);
  }
</style>
```

---

## Testing Checklist

- [ ] Install Gemini SDK: `pnpm add @google/genai`
- [ ] Add `GOOGLE_API_KEY` to `.dev.vars`
- [ ] Update practice page with new imports and state
- [ ] Test Gemini connection (should show 🔵 badge)
- [ ] Test fallback (remove GOOGLE_API_KEY temporarily, should show 🟢 + fallback notice)
- [ ] Test session warning (wait 14 minutes with Gemini)
- [ ] Test extend session button
- [ ] Verify Vietnamese audio quality on both providers

---

## Quick Reference

| Provider | Badge | Cost | Session Limit | Transport |
|----------|-------|------|---------------|-----------|
| Gemini | 🔵 | ~$0.075/min | 15 min | WebSocket |
| OpenAI | 🟢 | ~$0.30/min | ~30 min | WebRTC |

---

## Rollback Instructions

If you need to revert to OpenAI-only:

1. In `+page.svelte`, change import back to `RealtimeClient`
2. Remove provider state variables
3. Remove provider badge and notice UI
4. The `realtime-token` endpoint will still work (just pass `provider: 'openai'`)
