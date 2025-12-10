# Nói Hay - Vietnamese Language Coach Architecture

## Overview

A real-time voice-based Vietnamese language coaching app for intermediate-to-upper-intermediate learners. Users have conversational practice with an AI tutor that provides grammar corrections and tone feedback.

**Project Name:** Nói Hay  
**Target:** Personal use, ~$15-25/month budget

---

## Voice Architecture Options

### ⭐ Option 1: OpenAI Realtime API (RECOMMENDED)

**Native speech-to-speech** — audio in, audio out, no intermediate text step.

```
┌─────────────────────────────────────────────────────────────┐
│                    Browser (SvelteKit)                       │
│  ┌─────────────┐         ┌──────────────────────────────┐  │
│  │ Microphone  │────────▶│      WebRTC / WebSocket      │  │
│  │   Input     │         │   to OpenAI Realtime API     │  │
│  └─────────────┘         └──────────────┬───────────────┘  │
│         ▲                               │                   │
│         │ Audio playback                │ PCM Audio         │
│         │                               ▼                   │
│  ┌──────┴──────┐         ┌──────────────────────────────┐  │
│  │   Speaker   │◀────────│   gpt-realtime model         │  │
│  │   Output    │         │   (Native S2S processing)    │  │
│  └─────────────┘         └──────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

#### Why This Approach?

| Benefit | Details |
|---------|---------|
| **Simplest architecture** | One API handles everything — no STT/LLM/TTS orchestration |
| **Vietnamese officially supported** | <50% WER, listed in supported languages |
| **Preserves emotion & tone** | Model hears your pronunciation, not just text |
| **Natural interruptions** | You can cut off the AI mid-sentence |
| **Low latency** | ~300-500ms response time |
| **Used by Speak app** | Production-proven for language learning |

#### Language Support Confirmation

From OpenAI documentation, Vietnamese is officially supported with good quality (<50% WER):

```
Supported languages for gpt-realtime and gpt-realtime-mini:
- Vietnamese ✅
- Chinese, Japanese, Korean ✅
- Thai, Indonesian, Malay ✅
- All major European languages ✅
- 57+ languages total
```

#### Trade-offs

| Consideration | Notes |
|---------------|-------|
| Voice accent | OpenAI voices have English-like pronunciation, but speak Vietnamese correctly |
| Cost | ~$0.30/min total (higher than pipeline approach) |
| Less control | Can't swap individual STT/TTS providers |

---

### Option 2: Chained Pipeline (STT → LLM → TTS)

Use this if **native Vietnamese voice pronunciation** is critical.

```
Your speech → Deepgram STT (vi) → Claude → Azure TTS (vi-VN-HoaiMyNeural)
```

| Benefit | Trade-off |
|---------|-----------|
| Native Vietnamese TTS voice | Higher latency (~800-1200ms) |
| Lower cost (~$0.08/min) | More complex architecture |
| More control over each step | Loses emotional context |

**Recommendation:** Start with Option 1. Add Option 2 later if native voice is essential.

---

## OpenAI Realtime API Implementation

### Transport Methods

| Method | Use Case |
|--------|----------|
| **WebRTC** | Client-side apps (browser) — lowest latency |
| **WebSocket** | Server-side apps, phone integration |

For a SvelteKit browser app, **WebRTC** is recommended.

### Session Configuration

```typescript
// Configure for Vietnamese language coaching
const sessionConfig = {
  model: 'gpt-realtime',  // or 'gpt-realtime-mini' for lower cost
  modalities: ['audio', 'text'],
  voice: 'coral',  // Options: alloy, ash, ballad, coral, echo, sage, shimmer, verse, cedar, marin
  instructions: `
# Role
You are a friendly Vietnamese language coach helping an intermediate learner practice conversation.

# Language
- Conduct the conversation primarily in Vietnamese
- The learner will speak Vietnamese; respond in Vietnamese
- When correcting, briefly explain in English, then continue in Vietnamese

# Personality & Tone
- Warm, encouraging, patient
- Use natural conversational particles (à, nhé, nhỉ, ạ)
- Match the learner's pace and complexity level

# Corrections
- Gently correct grammar and tone errors
- Don't interrupt flow for minor mistakes
- Group corrections at natural pause points
- Format: "Ah, một chút sửa nhé: [correct form]. [Brief English explanation]"

# Topics
- Daily life, family, work, hobbies, travel
- Vietnamese culture and customs
- Current events (keep it light)

# Turn Length
- Keep responses to 2-4 sentences
- Ask follow-up questions to maintain conversation
`.trim(),
  input_audio_transcription: {
    model: 'whisper-1',  // Get text transcript alongside audio
    language: 'vi',       // Language hint for better transcription
  },
  turn_detection: {
    type: 'server_vad',   // Voice Activity Detection
    threshold: 0.5,
    prefix_padding_ms: 300,
    silence_duration_ms: 500,
  },
};
```

### Basic Implementation (Browser with WebRTC)

```typescript
// lib/voice/RealtimeClient.ts

export class RealtimeClient {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;
  
  // Event callbacks
  onUserTranscript: ((text: string) => void) | null = null;
  onCoachResponse: ((text: string, isFinal: boolean) => void) | null = null;
  onError: ((error: Error) => void) | null = null;
  
  async connect() {
    // 1. Get ephemeral token from your backend (don't expose API key to client)
    const tokenResponse = await fetch('/api/realtime-token', { method: 'POST' });
    const { token } = await tokenResponse.json();
    
    // 2. Create peer connection
    this.pc = new RTCPeerConnection();
    
    // 3. Set up audio playback
    this.audioEl = document.createElement('audio');
    this.audioEl.autoplay = true;
    this.pc.ontrack = (e) => {
      this.audioEl!.srcObject = e.streams[0];
    };
    
    // 4. Add microphone track
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.pc.addTrack(stream.getTracks()[0]);
    
    // 5. Set up data channel for events
    this.dc = this.pc.createDataChannel('oai-events');
    this.dc.onmessage = (e) => this.handleEvent(JSON.parse(e.data));
    
    // 6. Create and set local description
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    
    // 7. Connect to OpenAI
    const baseUrl = 'https://api.openai.com/v1/realtime';
    const model = 'gpt-realtime';
    
    const response = await fetch(`${baseUrl}?model=${model}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });
    
    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });
    
    // 8. Configure session for Vietnamese coaching
    this.sendEvent({
      type: 'session.update',
      session: sessionConfig,
    });
  }
  
  private handleEvent(event: any) {
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        // User's speech transcribed
        this.onUserTranscript?.(event.transcript);
        break;
        
      case 'response.audio_transcript.delta':
        // Coach's response text (streaming)
        this.onCoachResponse?.(event.delta, false);
        break;
        
      case 'response.audio_transcript.done':
        // Coach finished speaking
        this.onCoachResponse?.(event.transcript, true);
        break;
        
      case 'error':
        this.onError?.(new Error(event.error.message));
        break;
    }
  }
  
  sendEvent(event: any) {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(event));
    }
  }
  
  // Send a text message to the coach
  sendTextMessage(text: string) {
    this.sendEvent({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text }],
      },
    });
    this.sendEvent({ type: 'response.create' });
  }
  
  disconnect() {
    this.pc?.close();
    this.pc = null;
    this.dc = null;
  }
}
```

### Backend Token Endpoint

```typescript
// apps/api/src/routes/realtime-token.ts
// Never expose your API key to the client!

import { Hono } from 'hono';

const app = new Hono();

app.post('/api/realtime-token', async (c) => {
  // Verify user is authenticated
  const session = await getSession(c);
  if (!session.userId) {
    return c.json({ error: 'Unauthorized' }, 401);
  }
  
  // Create ephemeral token (valid for 1 minute)
  const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-realtime',
      voice: 'coral',
    }),
  });
  
  const { client_secret } = await response.json();
  
  return c.json({ token: client_secret.value });
});

export default app;
```

### Using OpenAI Agents SDK (Alternative)

For more structured voice agents with handoffs:

```typescript
// Using @openai/agents SDK
import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';

// Tool for detailed corrections
const provideCorrectionTool = tool({
  name: 'provideDetailedCorrection',
  description: 'Provide a detailed grammar correction with explanation',
  parameters: z.object({
    original: z.string().describe('What the user said'),
    corrected: z.string().describe('Corrected Vietnamese'),
    explanation: z.string().describe('Explanation in English'),
    grammarPoint: z.string().describe('Grammar concept involved'),
  }),
  execute: async (params) => {
    // Could save to database for spaced repetition review
    console.log('Correction:', params);
    return `Correction noted: ${params.corrected}`;
  },
});

const vietnameseCoach = new RealtimeAgent({
  name: 'Vietnamese Coach',
  instructions: `You are a friendly Vietnamese language coach...`,
  tools: [provideCorrectionTool],
});

// The SDK handles WebRTC/WebSocket automatically
```

---

## Monorepo Structure (Simplified)

With OpenAI Realtime API, the architecture is much simpler — no need for separate STT/TTS providers or Durable Objects for session management.

```
my-viet-coach/
├── apps/
│   ├── api/                      # Backend Worker (Hono + tRPC)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── realtime-token.ts  # Token endpoint for OpenAI
│   │   │   │   └── conversations.ts   # Save conversation history
│   │   │   ├── db/
│   │   │   │   └── schema.ts
│   │   │   └── index.ts
│   │   └── wrangler.toml
│   │
│   └── web/                      # SvelteKit frontend
│       ├── src/
│       │   ├── lib/
│       │   │   ├── voice/
│       │   │   │   └── RealtimeClient.ts
│       │   │   └── stores/
│       │   │       └── session.ts
│       │   └── routes/
│       │       ├── +page.svelte
│       │       └── practice/
│       │           └── +page.svelte
│       └── svelte.config.js
│
├── packages/
│   └── shared/                   # Shared types
│       └── src/
│           └── types.ts
│
├── pnpm-workspace.yaml
└── package.json
```

**Note:** No separate `voice/` worker needed! The Realtime API handles all voice processing. Your backend just needs to:
1. Provide ephemeral tokens
2. Save conversation history (optional)
3. Track learning progress (optional)

---

## SvelteKit Practice Page

```svelte
<!-- apps/web/src/routes/practice/+page.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { RealtimeClient } from '$lib/voice/RealtimeClient';
  
  let client: RealtimeClient | null = null;
  let isConnected = false;
  let userTranscript = '';
  let coachTranscript = '';
  let error = '';
  
  // Settings
  let difficulty = 'intermediate';
  let topic = 'daily_life';
  
  const topics = [
    { value: 'daily_life', label: 'Daily Life (Cuộc sống hàng ngày)' },
    { value: 'food', label: 'Food & Dining (Ẩm thực)' },
    { value: 'travel', label: 'Travel (Du lịch)' },
    { value: 'work', label: 'Work (Công việc)' },
    { value: 'culture', label: 'Culture (Văn hóa)' },
  ];
  
  async function connect() {
    try {
      client = new RealtimeClient();
      
      // Set up event handlers
      client.onUserTranscript = (text) => {
        userTranscript = text;
      };
      
      client.onCoachResponse = (text, isFinal) => {
        coachTranscript = isFinal ? text : coachTranscript + text;
      };
      
      client.onError = (err) => {
        error = err.message;
      };
      
      await client.connect();
      
      // Send initial context to start conversation
      client.sendTextMessage(
        `Topic: ${topic}, Difficulty: ${difficulty}. Please greet me and start a conversation in Vietnamese.`
      );
      
      isConnected = true;
    } catch (err: any) {
      error = err.message;
    }
  }
  
  function disconnect() {
    client?.disconnect();
    client = null;
    isConnected = false;
    userTranscript = '';
    coachTranscript = '';
  }
  
  onDestroy(() => {
    disconnect();
  });
</script>

<div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white py-8">
  <div class="max-w-2xl mx-auto px-4">
    
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-3xl font-bold text-emerald-800">Nói Hay</h1>
      <p class="text-gray-600">Practice Vietnamese conversation</p>
    </div>
    
    {#if !isConnected}
      <!-- Setup Screen -->
      <div class="bg-white rounded-2xl shadow-lg p-6">
        <h2 class="text-xl font-semibold text-gray-800 mb-4">Start a Session</h2>
        
        <div class="space-y-4">
          <div>
            <label for="topic" class="block text-sm font-medium text-gray-700 mb-1">
              Topic
            </label>
            <select
              id="topic"
              bind:value={topic}
              class="w-full rounded-lg border-gray-300 shadow-sm"
            >
              {#each topics as t}
                <option value={t.value}>{t.label}</option>
              {/each}
            </select>
          </div>
          
          <div>
            <label for="difficulty" class="block text-sm font-medium text-gray-700 mb-1">
              Your Level
            </label>
            <select
              id="difficulty"
              bind:value={difficulty}
              class="w-full rounded-lg border-gray-300 shadow-sm"
            >
              <option value="beginner">Beginner (Người mới)</option>
              <option value="intermediate">Intermediate (Trung cấp)</option>
              <option value="advanced">Advanced (Nâng cao)</option>
            </select>
          </div>
        </div>
        
        <button
          on:click={connect}
          class="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          🎤 Start Practice Session
        </button>
      </div>
      
    {:else}
      <!-- Active Session -->
      <div class="bg-white rounded-2xl shadow-lg p-6 space-y-6">
        
        <!-- Status -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <div class="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
            <span class="text-sm text-gray-600">Connected — speak in Vietnamese!</span>
          </div>
          <span class="text-sm text-emerald-600">{topics.find(t => t.value === topic)?.label}</span>
        </div>
        
        <!-- Your Speech -->
        <div>
          <h3 class="text-sm font-medium text-gray-500 mb-2">You said:</h3>
          <div class="bg-gray-50 rounded-xl p-4 min-h-[60px]">
            <p class="text-gray-800">{userTranscript || 'Listening...'}</p>
          </div>
        </div>
        
        <!-- Coach Response -->
        <div>
          <h3 class="text-sm font-medium text-gray-500 mb-2">Coach says:</h3>
          <div class="bg-emerald-50 rounded-xl p-4 min-h-[80px]">
            <p class="text-emerald-800">{coachTranscript || 'Waiting...'}</p>
          </div>
        </div>
        
        <!-- End Session -->
        <button
          on:click={disconnect}
          class="w-full py-3 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
        >
          End Session
        </button>
      </div>
    {/if}
    
    <!-- Error -->
    {#if error}
      <div class="mt-4 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error}
      </div>
    {/if}
    
  </div>
</div>
```

---

## Database Schema

```typescript
// packages/shared/src/schema.ts

import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

// Track conversation sessions
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  topic: text('topic').notNull(),
  difficulty: text('difficulty').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  durationMinutes: integer('duration_minutes'),
});

// Store transcripts for review
export const conversationMessages = sqliteTable('conversation_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull(),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
});

// Track learning progress
export const learningProgress = sqliteTable('learning_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  minutesPracticed: integer('minutes_practiced').default(0),
  sessionsCompleted: integer('sessions_completed').default(0),
  topicsPracticed: text('topics_practiced'), // JSON array
});
```

---

## Cost Estimation

### OpenAI Realtime API (Recommended)

Based on 100 conversations/month, ~5 minutes each (500 minutes total):

| Item | Calculation | Cost |
|------|-------------|------|
| Audio Input | 500 min × $0.06/min | $30 |
| Audio Output | 500 min × $0.24/min | $120 |
| **Subtotal** | | $150 |
| **With caching (~50%)** | | **~$75** |

**Realistic cost with typical patterns:** ~$15-40/month

OpenAI offers:
- Cached input tokens at $0.40/1M (vs $32/1M regular)
- `gpt-realtime-mini` for lower-cost option

### Comparison: Pipeline Approach (Option 2)

| Service | Cost |
|---------|------|
| Deepgram STT | ~$4 |
| Claude API | ~$2 |
| Azure TTS | Free tier |
| **Total** | **~$6-8/month** |

**Trade-off:** Pipeline is cheaper but adds ~500ms latency and loses emotional context.

---

## API Keys Required

| Service | Purpose | Where to get |
|---------|---------|--------------|
| **OpenAI** | Realtime API | platform.openai.com |
| (Optional) Anthropic | Claude for text-based testing | console.anthropic.com |

---

## Implementation Phases

### Phase 1: Text-Based MVP (1 week)
- Set up monorepo structure  
- Integrate SvelteKit with JustShip auth
- Build simple chat interface with Claude (text-only)
- Test Vietnamese coaching prompts

### Phase 2: Voice Integration (1-2 weeks)
- Add OpenAI Realtime API token endpoint
- Implement RealtimeClient in browser (WebRTC)
- Build practice page UI
- Test end-to-end voice flow

### Phase 3: Polish (ongoing)
- Save conversation transcripts to D1
- Add progress tracking dashboard
- Implement spaced review of corrections
- Add multiple topic categories
- Consider adding native Vietnamese TTS (Option 2) for comparison

---

## Resources

- [OpenAI Realtime API Docs](https://platform.openai.com/docs/guides/realtime)
- [OpenAI Voice Agents Guide](https://platform.openai.com/docs/guides/voice-agents)
- [Realtime Prompting Guide](https://cookbook.openai.com/examples/realtime_prompting_guide)
- [OpenAI Agents SDK (TypeScript)](https://github.com/openai/openai-agents-js)
- [WebRTC Basics](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [Speak App](https://speak.com/) - Language learning app using same technology
