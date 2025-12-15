# Gemini 2.5 Flash Native Audio Implementation Guide

## Overview

This guide covers the implementation of Gemini 2.5 Flash Native Audio for the Speak Phở Real Vietnamese language coaching app, with automatic fallback to OpenAI Realtime API.

## Why Gemini?

| Aspect | Gemini 2.5 Flash | OpenAI Realtime |
|--------|------------------|-----------------|
| **Cost** | ~$0.05-0.10/min | ~$0.30/min |
| **Monthly (500 min)** | $25-50 | $75-150 |
| **Vietnamese Support** | ✅ vi-VN official | ✅ Supported |
| **Voices** | 30 HD voices | 10 voices |
| **Free Tier** | ✅ Yes | ❌ No |
| **Affective Dialog** | ✅ Emotion-aware | ❌ No |
| **Session Limit** | 15 minutes | ~30 minutes |
| **Status** | Preview | Stable |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     Browser (SvelteKit)                          │
│  ┌─────────────┐         ┌────────────────────────────────────┐ │
│  │ Microphone  │────────▶│         VoiceClient                │ │
│  │   Input     │         │  (Provider Abstraction Layer)      │ │
│  └─────────────┘         └──────────────┬─────────────────────┘ │
│         ▲                               │                        │
│         │ Audio playback                │ Automatic Fallback     │
│         │                               ▼                        │
│  ┌──────┴──────┐         ┌────────────────────────────────────┐ │
│  │   Speaker   │◀────────│  Primary: Gemini Live API          │ │
│  │   Output    │         │  Fallback: OpenAI Realtime         │ │
│  └─────────────┘         └────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
                    ┌───────────────────────────────────────┐
                    │   SvelteKit Server Route              │
                    │   /api/private/realtime-token         │
                    │   (Token generation - auth protected) │
                    └───────────────────────────────────────┘
```

## Files Modified/Created

| File | Changes |
|------|---------|
| `apps/web/src/lib/voice/VoiceClient.ts` | New provider abstraction with Gemini + OpenAI + fallback |
| `apps/web/src/routes/api/private/realtime-token/+server.ts` | Updated to support both Gemini and OpenAI |
| `apps/web/wrangler.toml` | Added GOOGLE_API_KEY comment |
| `apps/api/worker/trpc/routers/voice.ts` | New tRPC router (alternative approach) |
| `apps/api/worker/trpc/context.ts` | Added new env vars |
| `apps/api/worker/trpc/router.ts` | Added voice router |
| `apps/api/worker/index.ts` | Added REST endpoint (alternative approach) |


## Implementation Steps

### Step 1: Install Gemini SDK

```bash
pnpm add @google/genai
```

### Step 2: Add Environment Variable

Add `GOOGLE_API_KEY` to your environment:

**Local development (.dev.vars):**
```
GOOGLE_API_KEY=your_api_key_here
```

**Production (Cloudflare Dashboard):**
1. Go to Workers & Pages → your project → Settings → Variables
2. Add `GOOGLE_API_KEY` as an encrypted variable

### Step 3: The Implementation is Ready!

The files have been updated:
- `VoiceClient.ts` - Now supports both Gemini and OpenAI with automatic fallback
- `realtime-token/+server.ts` - Now returns tokens for both providers

## How the Fallback Works

```
User clicks "Start Session"
         │
         ▼
    Connect to Gemini (primary)
         │
    ┌────┴────┐
    │ Success │────────▶ Use Gemini (show 🔵 badge)
    └────┬────┘
         │ Failure
         ▼
    Connect to OpenAI (fallback)
         │
    ┌────┴────┐
    │ Success │────────▶ Use OpenAI (show 🟢 badge + "fallback" label)
    └────┬────┘          + Fire onProviderFallback callback
         │ Failure
         ▼
    Show error to user
```

## Usage in Svelte Component

```svelte
<script lang="ts">
  import { VoiceClient, type VoiceProvider } from '$lib/voice/VoiceClient';
  
  let client: VoiceClient | null = null;
  let activeProvider: VoiceProvider | null = null;
  let showFallbackNotice = false;
  
  async function connect() {
    client = new VoiceClient(
      { systemPrompt: '...', voice: 'Kore' },
      {
        onConnected: (provider) => {
          activeProvider = provider;
        },
        onProviderFallback: (from, to, reason) => {
          showFallbackNotice = true;
          console.warn(`Fallback: ${from} → ${to} (${reason})`);
        },
        onSessionTimeWarning: (seconds) => {
          // Gemini 15-min limit approaching
        },
        // ... other callbacks
      },
      'gemini',  // Primary
      'openai'   // Fallback
    );
    
    await client.connect();
  }
</script>

<!-- Provider badge -->
{#if activeProvider}
  <div class="badge">
    {activeProvider === 'gemini' ? '🔵 Gemini' : '🟢 OpenAI'}
    {#if showFallbackNotice}(fallback){/if}
  </div>
{/if}
```


## Handling the 15-Minute Session Limit

Gemini has a 15-minute session limit. The VoiceClient handles this automatically:

1. **Warning** - `onSessionTimeWarning(60)` fires at 14 minutes
2. **Extend** - Call `client.reconnect()` to start a new session
3. **Context** - Conversation context can be preserved by storing transcripts

```typescript
// In your component
onSessionTimeWarning: (remainingSeconds) => {
  // Option 1: Show warning to user
  showTimeWarning = true;
  
  // Option 2: Auto-reconnect silently
  await client.reconnect();
}
```

## Testing Checklist

- [ ] Add `GOOGLE_API_KEY` to `.dev.vars`
- [ ] Install `@google/genai` package
- [ ] Test Gemini connection (primary)
- [ ] Test fallback by temporarily removing GOOGLE_API_KEY
- [ ] Verify provider badge shows correctly
- [ ] Test Vietnamese pronunciation quality
- [ ] Test session time warning at 14 minutes

## Vietnamese Test Phrases

Test these to verify tonal accuracy:

```typescript
const testPhrases = [
  // 6 tones of "ma"
  "ma, má, mà, mả, mã, mạ",
  
  // Corrections
  "Ah, một chút sửa nhé: 'đã ăn' không phải 'đã ăn rồi rồi'",
  
  // Conversational particles
  "Đi ăn nhé!",
  "Anh ơi, cho tôi xem thực đơn",
  
  // Food ordering
  "Cho tôi một tô phở bò",
];
```

## Cost Tracking

Add provider tracking to your usage metrics:

```typescript
// When session ends
const metrics = {
  provider: client.getActiveProvider(), // 'gemini' | 'openai'
  durationMs: client.getState().sessionDurationMs,
  estimatedCost: calculateCost(provider, durationMs),
};

function calculateCost(provider: string, durationMs: number): number {
  const minutes = durationMs / 60000;
  return provider === 'gemini' 
    ? minutes * 0.075  // ~$0.075/min
    : minutes * 0.30;  // ~$0.30/min
}
```

## Resources

- [Gemini Live API Docs](https://ai.google.dev/gemini-api/docs/live)
- [Gemini Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Google AI Studio](https://aistudio.google.com/) - Free testing
- [OpenAI Realtime Docs](https://platform.openai.com/docs/guides/realtime)
