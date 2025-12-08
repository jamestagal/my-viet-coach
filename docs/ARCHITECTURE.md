# Vietnamese Language Coach - Voice Worker Architecture

## Overview

This document sketches out the real-time voice architecture that integrates with the Backpine monorepo starter. The voice functionality runs as a separate Cloudflare Worker with Durable Objects for WebSocket session management.

## Monorepo Structure

```
vietnamese-coach/
├── apps/
│   ├── api/                    # From Backpine starter (Hono + tRPC)
│   │   ├── src/
│   │   │   ├── routes/         # tRPC routes for non-voice features
│   │   │   ├── db/             # Drizzle schema
│   │   │   └── index.ts        # Hono app entry
│   │   └── wrangler.toml
│   │
│   ├── voice/                  # NEW: Voice Worker with Durable Objects
│   │   ├── src/
│   │   │   ├── index.ts        # Worker entry, routes to DO
│   │   │   ├── VoiceSession.ts # Durable Object class
│   │   │   ├── providers/
│   │   │   │   ├── deepgram.ts # STT streaming
│   │   │   │   ├── claude.ts   # LLM streaming
│   │   │   │   └── azure-tts.ts# TTS streaming
│   │   │   └── utils/
│   │   │       └── audio.ts    # Audio format conversion
│   │   └── wrangler.toml
│   │
│   └── web/                    # SvelteKit frontend (replaces React)
│       ├── src/
│       │   ├── lib/
│       │   │   ├── trpc.ts     # tRPC client
│       │   │   ├── voice/
│       │   │   │   ├── VoiceClient.ts
│       │   │   │   └── AudioWorklet.ts
│       │   │   └── stores/
│       │   │       └── voiceSession.ts
│       │   └── routes/
│       │       ├── +layout.svelte
│       │       ├── +page.svelte
│       │       └── practice/
│       │           └── +page.svelte
│       ├── static/
│       │   └── worklets/
│       │       └── pcm-processor.js
│       └── svelte.config.js
│
├── packages/
│   ├── data-ops/               # From Backpine starter
│   │   └── src/
│   │       ├── schema.ts       # Extended with conversation tables
│   │       └── queries/
│   │           ├── users.ts
│   │           └── conversations.ts  # NEW
│   │
│   └── voice-types/            # NEW: Shared types
│       └── src/
│           ├── messages.ts     # WebSocket message types
│           └── audio.ts        # Audio format types
│
├── pnpm-workspace.yaml
└── package.json
```

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Browser (SvelteKit)                         │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐ │
│  │ AudioWorklet│───▶│ VoiceClient │───▶│ WebSocket Connection    │ │
│  │ (PCM capture)│    │ (manages)   │    │ to voice.yourapp.com    │ │
│  └─────────────┘    └─────────────┘    └───────────┬─────────────┘ │
│         ▲                                          │                │
│         │ Audio playback                           │ PCM Int16      │
│         │                                          ▼                │
└─────────┼──────────────────────────────────────────┼────────────────┘
          │                                          │
          │                                          │
┌─────────┼──────────────────────────────────────────┼────────────────┐
│         │        Cloudflare Voice Worker           │                │
│         │                                          ▼                │
│  ┌──────┴──────────────────────────────────────────────────────┐   │
│  │                    Durable Object: VoiceSession              │   │
│  │  ┌─────────────────────────────────────────────────────────┐ │   │
│  │  │ State:                                                   │ │   │
│  │  │  - conversationHistory: Message[]                        │ │   │
│  │  │  - sttBuffer: Uint8Array[]                              │ │   │
│  │  │  - isProcessing: boolean                                 │ │   │
│  │  └─────────────────────────────────────────────────────────┘ │   │
│  │                           │                                   │   │
│  │           ┌───────────────┼───────────────┐                  │   │
│  │           ▼               ▼               ▼                  │   │
│  │    ┌───────────┐   ┌───────────┐   ┌───────────┐            │   │
│  │    │ Deepgram  │   │  Claude   │   │ Azure TTS │            │   │
│  │    │ STT API   │──▶│ Streaming │──▶│ Streaming │───┐        │   │
│  │    │ (vi-VN)   │   │   API     │   │ (vi-VN)   │   │        │   │
│  │    └───────────┘   └───────────┘   └───────────┘   │        │   │
│  │                                                     │        │   │
│  │         Audio chunks back to browser  ◀────────────┘        │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## WebSocket Message Protocol

```typescript
// packages/voice-types/src/messages.ts

// Client -> Server messages
export type ClientMessage =
  | { type: 'audio_chunk'; data: ArrayBuffer }      // Raw PCM Int16 @ 16kHz
  | { type: 'end_turn' }                            // User finished speaking
  | { type: 'set_topic'; topic: string }            // Set conversation topic
  | { type: 'set_difficulty'; level: 'beginner' | 'intermediate' | 'advanced' }
  | { type: 'request_correction' }                  // Ask for grammar review
  | { type: 'ping' };

// Server -> Client messages
export type ServerMessage =
  | { type: 'transcript'; text: string; isFinal: boolean }  // STT result
  | { type: 'coach_text'; text: string; isFinal: boolean }  // Coach response text
  | { type: 'audio_chunk'; data: ArrayBuffer }              // TTS audio PCM
  | { type: 'audio_end' }                                   // TTS finished
  | { type: 'correction'; original: string; corrected: string; explanation: string }
  | { type: 'error'; message: string }
  | { type: 'pong' };
```

## Voice Worker Implementation

```typescript
// apps/voice/src/index.ts

import { VoiceSession } from './VoiceSession';

export { VoiceSession };

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Health check
    if (url.pathname === '/health') {
      return new Response('OK');
    }
    
    // WebSocket upgrade for voice sessions
    if (url.pathname === '/session') {
      const upgradeHeader = request.headers.get('Upgrade');
      if (upgradeHeader !== 'websocket') {
        return new Response('Expected WebSocket', { status: 426 });
      }
      
      // Get or create session ID from query params or generate new
      const sessionId = url.searchParams.get('session') || crypto.randomUUID();
      
      // Route to Durable Object
      const id = env.VOICE_SESSION.idFromName(sessionId);
      const stub = env.VOICE_SESSION.get(id);
      
      return stub.fetch(request);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

interface Env {
  VOICE_SESSION: DurableObjectNamespace;
  DEEPGRAM_API_KEY: string;
  ANTHROPIC_API_KEY: string;
  AZURE_SPEECH_KEY: string;
  AZURE_SPEECH_REGION: string;
}
```

```typescript
// apps/voice/src/VoiceSession.ts

import { DurableObject } from 'cloudflare:workers';
import { DeepgramSTT } from './providers/deepgram';
import { ClaudeCoach } from './providers/claude';
import { AzureTTS } from './providers/azure-tts';
import type { ClientMessage, ServerMessage } from '@repo/voice-types';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export class VoiceSession extends DurableObject {
  private ws: WebSocket | null = null;
  private stt: DeepgramSTT | null = null;
  private coach: ClaudeCoach | null = null;
  private tts: AzureTTS | null = null;
  
  private conversationHistory: ConversationMessage[] = [];
  private currentTranscript = '';
  private difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
  private topic = 'general conversation';
  
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    
    // Initialize providers
    this.stt = new DeepgramSTT(env.DEEPGRAM_API_KEY, {
      language: 'vi',
      model: 'nova-2',
      punctuate: true,
      interimResults: true,
    });
    
    this.coach = new ClaudeCoach(env.ANTHROPIC_API_KEY);
    
    this.tts = new AzureTTS(env.AZURE_SPEECH_KEY, env.AZURE_SPEECH_REGION, {
      voice: 'vi-VN-HoaiMyNeural', // Female Vietnamese voice
      outputFormat: 'raw-16khz-16bit-mono-pcm',
    });
  }

  async fetch(request: Request): Promise<Response> {
    // WebSocket Hibernation API for cost efficiency
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    
    this.ctx.acceptWebSocket(server);
    this.ws = server;
    
    // Set up STT callback
    this.stt!.onTranscript((text, isFinal) => {
      this.send({ type: 'transcript', text, isFinal });
      
      if (isFinal) {
        this.currentTranscript += ' ' + text;
      }
    });
    
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: ArrayBuffer | string) {
    try {
      if (message instanceof ArrayBuffer) {
        // Binary = audio data, forward to STT
        await this.stt!.sendAudio(message);
        return;
      }
      
      const msg: ClientMessage = JSON.parse(message);
      
      switch (msg.type) {
        case 'audio_chunk':
          await this.stt!.sendAudio(msg.data);
          break;
          
        case 'end_turn':
          await this.handleEndTurn();
          break;
          
        case 'set_topic':
          this.topic = msg.topic;
          break;
          
        case 'set_difficulty':
          this.difficulty = msg.level;
          break;
          
        case 'request_correction':
          await this.handleCorrectionRequest();
          break;
          
        case 'ping':
          this.send({ type: 'pong' });
          break;
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
      this.send({ type: 'error', message: 'Failed to process message' });
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string) {
    // Clean up provider connections
    await this.stt?.close();
    await this.tts?.close();
    this.ws = null;
  }

  private async handleEndTurn() {
    if (!this.currentTranscript.trim()) return;
    
    // Add user message to history
    this.conversationHistory.push({
      role: 'user',
      content: this.currentTranscript.trim(),
      timestamp: Date.now(),
    });
    
    // Generate coach response with streaming
    const responseStream = await this.coach!.respond({
      userMessage: this.currentTranscript.trim(),
      conversationHistory: this.conversationHistory,
      difficulty: this.difficulty,
      topic: this.topic,
    });
    
    let fullResponse = '';
    let sentenceBuffer = '';
    
    // Stream text to client and buffer for TTS
    for await (const chunk of responseStream) {
      fullResponse += chunk;
      sentenceBuffer += chunk;
      
      // Send text chunk to client
      this.send({ type: 'coach_text', text: chunk, isFinal: false });
      
      // Check for sentence boundary for TTS
      const sentenceMatch = sentenceBuffer.match(/[.!?।]+\s*/);
      if (sentenceMatch) {
        const sentence = sentenceBuffer.substring(0, sentenceMatch.index! + sentenceMatch[0].length);
        sentenceBuffer = sentenceBuffer.substring(sentence.length);
        
        // Stream TTS for this sentence
        await this.streamTTS(sentence);
      }
    }
    
    // Handle any remaining text
    if (sentenceBuffer.trim()) {
      await this.streamTTS(sentenceBuffer);
    }
    
    // Signal completion
    this.send({ type: 'coach_text', text: '', isFinal: true });
    this.send({ type: 'audio_end' });
    
    // Add assistant response to history
    this.conversationHistory.push({
      role: 'assistant',
      content: fullResponse,
      timestamp: Date.now(),
    });
    
    // Reset transcript for next turn
    this.currentTranscript = '';
  }

  private async handleCorrectionRequest() {
    if (this.conversationHistory.length === 0) return;
    
    // Get last user message
    const lastUserMessage = [...this.conversationHistory]
      .reverse()
      .find(m => m.role === 'user');
    
    if (!lastUserMessage) return;
    
    const correction = await this.coach!.correctVietnamese(lastUserMessage.content);
    
    if (correction.hasErrors) {
      this.send({
        type: 'correction',
        original: correction.original,
        corrected: correction.corrected,
        explanation: correction.explanation,
      });
      
      // Speak the correction
      await this.streamTTS(correction.corrected);
      this.send({ type: 'audio_end' });
    }
  }

  private async streamTTS(text: string) {
    const audioStream = await this.tts!.synthesize(text);
    
    for await (const chunk of audioStream) {
      this.send({ type: 'audio_chunk', data: chunk });
    }
  }

  private send(message: ServerMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      if (message.type === 'audio_chunk') {
        // Send audio as binary
        this.ws.send(message.data);
      } else {
        this.ws.send(JSON.stringify(message));
      }
    }
  }
}
```

## Provider Implementations

```typescript
// apps/voice/src/providers/deepgram.ts

export interface DeepgramConfig {
  language: string;
  model: string;
  punctuate: boolean;
  interimResults: boolean;
}

export class DeepgramSTT {
  private ws: WebSocket | null = null;
  private transcriptCallback: ((text: string, isFinal: boolean) => void) | null = null;
  
  constructor(private apiKey: string, private config: DeepgramConfig) {}
  
  async connect(): Promise<void> {
    const params = new URLSearchParams({
      language: this.config.language,
      model: this.config.model,
      punctuate: String(this.config.punctuate),
      interim_results: String(this.config.interimResults),
      encoding: 'linear16',
      sample_rate: '16000',
    });
    
    this.ws = new WebSocket(
      `wss://api.deepgram.com/v1/listen?${params}`,
      ['token', this.apiKey]
    );
    
    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.channel?.alternatives?.[0]) {
        const transcript = data.channel.alternatives[0].transcript;
        const isFinal = data.is_final;
        if (transcript && this.transcriptCallback) {
          this.transcriptCallback(transcript, isFinal);
        }
      }
    };
    
    // Wait for connection
    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = (e) => reject(e);
    });
  }
  
  onTranscript(callback: (text: string, isFinal: boolean) => void) {
    this.transcriptCallback = callback;
  }
  
  async sendAudio(data: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      await this.connect();
    }
    this.ws!.send(data);
  }
  
  async close() {
    if (this.ws) {
      // Send close message to Deepgram
      this.ws.send(JSON.stringify({ type: 'CloseStream' }));
      this.ws.close();
      this.ws = null;
    }
  }
}
```

```typescript
// apps/voice/src/providers/claude.ts

interface CoachRequest {
  userMessage: string;
  conversationHistory: Array<{ role: 'user' | 'assistant'; content: string }>;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  topic: string;
}

interface CorrectionResult {
  hasErrors: boolean;
  original: string;
  corrected: string;
  explanation: string;
}

export class ClaudeCoach {
  constructor(private apiKey: string) {}
  
  async *respond(request: CoachRequest): AsyncGenerator<string> {
    const systemPrompt = this.buildSystemPrompt(request.difficulty, request.topic);
    
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        stream: true,
        system: systemPrompt,
        messages: [
          ...request.conversationHistory.map(m => ({
            role: m.role,
            content: m.content,
          })),
          { role: 'user', content: request.userMessage },
        ],
      }),
    });
    
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '));
      
      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;
        
        try {
          const parsed = JSON.parse(data);
          if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
            yield parsed.delta.text;
          }
        } catch {
          // Skip unparseable chunks
        }
      }
    }
  }
  
  async correctVietnamese(text: string): Promise<CorrectionResult> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: `You are a Vietnamese language expert. Analyze the following Vietnamese text for grammatical errors, incorrect tones/diacritics, and unnatural phrasing. 

Respond in JSON format:
{
  "hasErrors": boolean,
  "original": "the original text",
  "corrected": "the corrected text with proper diacritics",
  "explanation": "Brief explanation in English of what was wrong and why"
}

Pay special attention to:
- Correct diacritics: sắc (´), huyền (\`), hỏi (?), ngã (~), nặng (.)
- Proper word order (Subject-Verb-Object but with modifiers after nouns)
- Correct classifiers (cái, con, chiếc, etc.)
- Register-appropriate pronouns (tôi/mình/em/anh/chị)
- Common learner mistakes with similar-sounding words`,
        messages: [
          { role: 'user', content: text },
        ],
      }),
    });
    
    const data = await response.json();
    const content = data.content[0].text;
    
    // Parse JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return {
      hasErrors: false,
      original: text,
      corrected: text,
      explanation: '',
    };
  }
  
  private buildSystemPrompt(difficulty: string, topic: string): string {
    const difficultyInstructions = {
      beginner: `
- Use simple vocabulary and short sentences
- Speak slowly and clearly
- Repeat key phrases
- Use basic grammar structures
- Provide English translations for new words`,
      intermediate: `
- Use a mix of simple and complex sentences
- Introduce idiomatic expressions occasionally
- Correct errors gently with explanations
- Discuss topics with moderate depth
- Use Vietnamese mostly, with occasional English clarification`,
      advanced: `
- Use natural, native-like speech patterns
- Include idioms, proverbs, and cultural references
- Discuss abstract topics in depth
- Only use English for nuanced grammar explanations
- Challenge the learner with complex structures`,
    };
    
    return `Bạn là một gia sư tiếng Việt thân thiện và kiên nhẫn. (You are a friendly and patient Vietnamese language tutor.)

Current conversation topic: ${topic}
Student level: ${difficulty}

${difficultyInstructions[difficulty as keyof typeof difficultyInstructions]}

Guidelines:
1. Respond primarily in Vietnamese, matching the student's level
2. Keep responses concise (2-4 sentences) for natural conversation flow
3. Gently correct major errors but don't interrupt flow for minor ones
4. Ask follow-up questions to keep the conversation going
5. Be encouraging and supportive
6. If the student seems stuck, offer helpful prompts or vocabulary

Remember: Your responses will be spoken aloud via TTS, so:
- Avoid special characters, URLs, or formatting
- Use natural spoken Vietnamese
- Include appropriate conversational particles (à, nhé, nhỉ, etc.)`;
  }
}
```

```typescript
// apps/voice/src/providers/azure-tts.ts

export interface AzureTTSConfig {
  voice: string;
  outputFormat: string;
}

export class AzureTTS {
  private token: string | null = null;
  private tokenExpiry = 0;
  
  constructor(
    private apiKey: string,
    private region: string,
    private config: AzureTTSConfig
  ) {}
  
  private async getToken(): Promise<string> {
    // Token valid for 10 minutes, refresh at 9
    if (this.token && Date.now() < this.tokenExpiry) {
      return this.token;
    }
    
    const response = await fetch(
      `https://${this.region}.api.cognitive.microsoft.com/sts/v1.0/issueToken`,
      {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.apiKey,
          'Content-Length': '0',
        },
      }
    );
    
    this.token = await response.text();
    this.tokenExpiry = Date.now() + 9 * 60 * 1000; // 9 minutes
    return this.token;
  }
  
  async *synthesize(text: string): AsyncGenerator<ArrayBuffer> {
    const token = await this.getToken();
    
    const ssml = `
      <speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis" xml:lang="vi-VN">
        <voice name="${this.config.voice}">
          <prosody rate="0.9">
            ${this.escapeXml(text)}
          </prosody>
        </voice>
      </speak>
    `;
    
    const response = await fetch(
      `https://${this.region}.tts.speech.microsoft.com/cognitiveservices/v1`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/ssml+xml',
          'X-Microsoft-OutputFormat': this.config.outputFormat,
        },
        body: ssml,
      }
    );
    
    if (!response.ok) {
      throw new Error(`Azure TTS error: ${response.status}`);
    }
    
    const reader = response.body!.getReader();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      yield value.buffer;
    }
  }
  
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
  
  async close() {
    // Nothing to clean up for HTTP-based API
  }
}
```

## SvelteKit Frontend

```typescript
// apps/web/src/lib/voice/VoiceClient.ts

import type { ClientMessage, ServerMessage } from '@repo/voice-types';

export type VoiceClientState = 'disconnected' | 'connecting' | 'connected' | 'listening' | 'processing';

export interface VoiceClientCallbacks {
  onStateChange: (state: VoiceClientState) => void;
  onTranscript: (text: string, isFinal: boolean) => void;
  onCoachText: (text: string, isFinal: boolean) => void;
  onCorrection: (original: string, corrected: string, explanation: string) => void;
  onError: (message: string) => void;
}

export class VoiceClient {
  private ws: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private mediaStream: MediaStream | null = null;
  private playbackQueue: ArrayBuffer[] = [];
  private isPlaying = false;
  
  private state: VoiceClientState = 'disconnected';
  private callbacks: VoiceClientCallbacks;
  
  constructor(callbacks: VoiceClientCallbacks) {
    this.callbacks = callbacks;
  }
  
  async connect(voiceWorkerUrl: string, sessionId?: string): Promise<void> {
    this.setState('connecting');
    
    const url = new URL(voiceWorkerUrl);
    url.pathname = '/session';
    if (sessionId) {
      url.searchParams.set('session', sessionId);
    }
    
    // Initialize WebSocket
    this.ws = new WebSocket(url.toString());
    this.ws.binaryType = 'arraybuffer';
    
    this.ws.onmessage = (event) => this.handleMessage(event);
    this.ws.onerror = () => this.callbacks.onError('WebSocket error');
    this.ws.onclose = () => this.setState('disconnected');
    
    await new Promise<void>((resolve, reject) => {
      this.ws!.onopen = () => resolve();
      this.ws!.onerror = () => reject(new Error('Failed to connect'));
    });
    
    // Initialize audio
    await this.initializeAudio();
    
    this.setState('connected');
  }
  
  private async initializeAudio(): Promise<void> {
    // Create AudioContext
    this.audioContext = new AudioContext({ sampleRate: 16000 });
    
    // Load AudioWorklet for PCM capture
    await this.audioContext.audioWorklet.addModule('/worklets/pcm-processor.js');
    
    // Get microphone access
    this.mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    
    // Create audio pipeline
    const source = this.audioContext.createMediaStreamSource(this.mediaStream);
    this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
    
    this.workletNode.port.onmessage = (event) => {
      if (this.state === 'listening' && this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(event.data);
      }
    };
    
    source.connect(this.workletNode);
    // Don't connect to destination - we don't want to hear ourselves
  }
  
  private handleMessage(event: MessageEvent): void {
    if (event.data instanceof ArrayBuffer) {
      // Binary = audio data
      this.playbackQueue.push(event.data);
      this.playNextChunk();
      return;
    }
    
    const message: ServerMessage = JSON.parse(event.data);
    
    switch (message.type) {
      case 'transcript':
        this.callbacks.onTranscript(message.text, message.isFinal);
        break;
        
      case 'coach_text':
        this.callbacks.onCoachText(message.text, message.isFinal);
        if (message.isFinal) {
          this.setState('connected');
        }
        break;
        
      case 'audio_end':
        // Audio playback finished signal
        break;
        
      case 'correction':
        this.callbacks.onCorrection(message.original, message.corrected, message.explanation);
        break;
        
      case 'error':
        this.callbacks.onError(message.message);
        break;
    }
  }
  
  private async playNextChunk(): Promise<void> {
    if (this.isPlaying || this.playbackQueue.length === 0) return;
    
    this.isPlaying = true;
    
    while (this.playbackQueue.length > 0) {
      const chunk = this.playbackQueue.shift()!;
      await this.playAudioChunk(chunk);
    }
    
    this.isPlaying = false;
  }
  
  private async playAudioChunk(data: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;
    
    // Convert Int16 to Float32 for Web Audio
    const int16 = new Int16Array(data);
    const float32 = new Float32Array(int16.length);
    
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }
    
    // Create buffer and play
    const buffer = this.audioContext.createBuffer(1, float32.length, 16000);
    buffer.getChannelData(0).set(float32);
    
    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.audioContext.destination);
    
    return new Promise((resolve) => {
      source.onended = () => resolve();
      source.start();
    });
  }
  
  startListening(): void {
    if (this.state !== 'connected') return;
    this.setState('listening');
  }
  
  stopListening(): void {
    if (this.state !== 'listening') return;
    this.setState('processing');
    this.send({ type: 'end_turn' });
  }
  
  setTopic(topic: string): void {
    this.send({ type: 'set_topic', topic });
  }
  
  setDifficulty(level: 'beginner' | 'intermediate' | 'advanced'): void {
    this.send({ type: 'set_difficulty', level });
  }
  
  requestCorrection(): void {
    this.send({ type: 'request_correction' });
  }
  
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }
  
  private setState(state: VoiceClientState): void {
    this.state = state;
    this.callbacks.onStateChange(state);
  }
  
  disconnect(): void {
    this.mediaStream?.getTracks().forEach(track => track.stop());
    this.audioContext?.close();
    this.ws?.close();
    
    this.mediaStream = null;
    this.audioContext = null;
    this.workletNode = null;
    this.ws = null;
    
    this.setState('disconnected');
  }
}
```

```javascript
// apps/web/static/worklets/pcm-processor.js

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.buffer = new Int16Array(512); // ~32ms at 16kHz
    this.bufferIndex = 0;
  }
  
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    
    const float32 = input[0];
    
    for (let i = 0; i < float32.length; i++) {
      // Convert float32 [-1, 1] to int16 [-32768, 32767]
      const sample = Math.max(-1, Math.min(1, float32[i]));
      this.buffer[this.bufferIndex++] = Math.floor(sample * 32767);
      
      if (this.bufferIndex >= this.buffer.length) {
        // Send buffer to main thread
        this.port.postMessage(this.buffer.buffer.slice(0));
        this.bufferIndex = 0;
      }
    }
    
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
```

```svelte
<!-- apps/web/src/routes/practice/+page.svelte -->

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { VoiceClient, type VoiceClientState } from '$lib/voice/VoiceClient';
  
  let voiceClient: VoiceClient | null = null;
  let state: VoiceClientState = 'disconnected';
  let transcript = '';
  let coachResponse = '';
  let correction: { original: string; corrected: string; explanation: string } | null = null;
  let error = '';
  
  let topic = 'general conversation';
  let difficulty: 'beginner' | 'intermediate' | 'advanced' = 'intermediate';
  
  const topics = [
    { value: 'general conversation', label: 'Trò chuyện chung' },
    { value: 'food and restaurants', label: 'Đồ ăn và nhà hàng' },
    { value: 'travel in Vietnam', label: 'Du lịch Việt Nam' },
    { value: 'family and relationships', label: 'Gia đình và mối quan hệ' },
    { value: 'work and career', label: 'Công việc và sự nghiệp' },
    { value: 'hobbies and interests', label: 'Sở thích' },
  ];
  
  onMount(() => {
    voiceClient = new VoiceClient({
      onStateChange: (s) => state = s,
      onTranscript: (text, isFinal) => {
        if (isFinal) {
          transcript = text;
        } else {
          transcript = text + '...';
        }
      },
      onCoachText: (text, isFinal) => {
        if (!isFinal) {
          coachResponse += text;
        }
      },
      onCorrection: (original, corrected, explanation) => {
        correction = { original, corrected, explanation };
      },
      onError: (msg) => error = msg,
    });
  });
  
  onDestroy(() => {
    voiceClient?.disconnect();
  });
  
  async function connect() {
    error = '';
    try {
      await voiceClient?.connect(import.meta.env.VITE_VOICE_WORKER_URL);
      voiceClient?.setTopic(topic);
      voiceClient?.setDifficulty(difficulty);
    } catch (e) {
      error = 'Failed to connect. Please try again.';
    }
  }
  
  function toggleListening() {
    if (state === 'listening') {
      voiceClient?.stopListening();
      coachResponse = '';
      correction = null;
    } else if (state === 'connected') {
      transcript = '';
      voiceClient?.startListening();
    }
  }
  
  function handleTopicChange() {
    voiceClient?.setTopic(topic);
  }
  
  function handleDifficultyChange() {
    voiceClient?.setDifficulty(difficulty);
  }
  
  function requestCorrection() {
    voiceClient?.requestCorrection();
  }
  
  function disconnect() {
    voiceClient?.disconnect();
    transcript = '';
    coachResponse = '';
    correction = null;
  }
</script>

<div class="min-h-screen bg-gradient-to-b from-emerald-50 to-white p-8">
  <div class="max-w-2xl mx-auto">
    <h1 class="text-3xl font-bold text-emerald-800 mb-2">
      Luyện tập tiếng Việt
    </h1>
    <p class="text-emerald-600 mb-8">Vietnamese Speaking Practice</p>
    
    {#if state === 'disconnected'}
      <!-- Settings Panel -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <h2 class="text-lg font-semibold text-gray-800 mb-4">Settings</h2>
        
        <div class="space-y-4">
          <div>
            <label for="topic" class="block text-sm font-medium text-gray-700 mb-1">
              Conversation Topic
            </label>
            <select
              id="topic"
              bind:value={topic}
              class="w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
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
              class="w-full rounded-lg border-gray-300 shadow-sm focus:ring-emerald-500 focus:border-emerald-500"
            >
              <option value="beginner">Beginner (Người mới bắt đầu)</option>
              <option value="intermediate">Intermediate (Trung cấp)</option>
              <option value="advanced">Advanced (Nâng cao)</option>
            </select>
          </div>
        </div>
        
        <button
          on:click={connect}
          class="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors"
        >
          Start Practice Session
        </button>
      </div>
    {:else}
      <!-- Active Session -->
      <div class="bg-white rounded-2xl shadow-lg p-6 mb-6">
        <!-- Status -->
        <div class="flex items-center justify-between mb-6">
          <div class="flex items-center gap-2">
            <div
              class="w-3 h-3 rounded-full {state === 'listening' ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}"
            ></div>
            <span class="text-sm text-gray-600">
              {state === 'listening' ? 'Listening...' : state === 'processing' ? 'Processing...' : 'Ready'}
            </span>
          </div>
          
          <div class="flex gap-2">
            <button
              on:click={handleTopicChange}
              class="text-sm text-emerald-600 hover:text-emerald-700"
            >
              Topic: {topics.find(t => t.value === topic)?.label}
            </button>
          </div>
        </div>
        
        <!-- Your Speech -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-500 mb-2">You said:</h3>
          <div class="bg-gray-50 rounded-xl p-4 min-h-[60px]">
            <p class="text-gray-800">{transcript || 'Press the button and speak in Vietnamese...'}</p>
          </div>
        </div>
        
        <!-- Coach Response -->
        <div class="mb-6">
          <h3 class="text-sm font-medium text-gray-500 mb-2">Coach says:</h3>
          <div class="bg-emerald-50 rounded-xl p-4 min-h-[80px]">
            <p class="text-emerald-800">{coachResponse || 'Waiting for your response...'}</p>
          </div>
        </div>
        
        <!-- Correction Display -->
        {#if correction}
          <div class="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <h3 class="text-sm font-medium text-amber-800 mb-2">📝 Correction</h3>
            <div class="space-y-2 text-sm">
              <p><span class="text-red-600 line-through">{correction.original}</span></p>
              <p><span class="text-emerald-600 font-medium">{correction.corrected}</span></p>
              <p class="text-gray-600 italic">{correction.explanation}</p>
            </div>
          </div>
        {/if}
        
        <!-- Main Button -->
        <button
          on:click={toggleListening}
          disabled={state === 'processing'}
          class="w-full py-4 rounded-xl font-semibold text-lg transition-all {
            state === 'listening'
              ? 'bg-red-500 hover:bg-red-600 text-white'
              : state === 'processing'
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
          }"
        >
          {state === 'listening' ? '⏹ Stop Speaking' : state === 'processing' ? 'Processing...' : '🎤 Start Speaking'}
        </button>
        
        <!-- Secondary Actions -->
        <div class="flex gap-3 mt-4">
          <button
            on:click={requestCorrection}
            disabled={!transcript || state !== 'connected'}
            class="flex-1 py-2 px-4 rounded-lg border border-emerald-300 text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Request Correction
          </button>
          
          <button
            on:click={disconnect}
            class="py-2 px-4 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          >
            End Session
          </button>
        </div>
      </div>
    {/if}
    
    <!-- Error Display -->
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
        {error}
      </div>
    {/if}
  </div>
</div>
```

## Wrangler Configuration

```toml
# apps/voice/wrangler.toml

name = "vietnamese-coach-voice"
main = "src/index.ts"
compatibility_date = "2024-01-01"

# Durable Objects
[durable_objects]
bindings = [
  { name = "VOICE_SESSION", class_name = "VoiceSession" }
]

[[migrations]]
tag = "v1"
new_classes = ["VoiceSession"]

# Secrets (set via `wrangler secret put`)
# DEEPGRAM_API_KEY
# ANTHROPIC_API_KEY
# AZURE_SPEECH_KEY
# AZURE_SPEECH_REGION

# Environment variables
[vars]
ENVIRONMENT = "production"
```

## Database Schema Extension

```typescript
// packages/data-ops/src/schema.ts

import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

// Existing tables from Backpine starter...

// NEW: Conversation history
export const conversations = sqliteTable('conversations', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  topic: text('topic').notNull(),
  difficulty: text('difficulty').notNull(),
  startedAt: integer('started_at', { mode: 'timestamp' }).notNull(),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
  messageCount: integer('message_count').default(0),
});

export const conversationMessages = sqliteTable('conversation_messages', {
  id: text('id').primaryKey(),
  conversationId: text('conversation_id').notNull().references(() => conversations.id),
  role: text('role').notNull(), // 'user' | 'assistant'
  content: text('content').notNull(),
  timestamp: integer('timestamp', { mode: 'timestamp' }).notNull(),
  hadCorrection: integer('had_correction', { mode: 'boolean' }).default(false),
});

// NEW: Track learning progress
export const learningProgress = sqliteTable('learning_progress', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  date: text('date').notNull(), // YYYY-MM-DD
  minutesPracticed: integer('minutes_practiced').default(0),
  messagesExchanged: integer('messages_exchanged').default(0),
  correctionsReceived: integer('corrections_received').default(0),
  topicsPracticed: text('topics_practiced'), // JSON array
});
```

## Cost Estimation

Based on moderate personal usage (100 conversations/month, ~5 minutes each):

| Service | Usage | Cost |
|---------|-------|------|
| Deepgram STT | 500 min | ~$3.85 |
| Claude API | ~50k tokens | ~$1.50 |
| Azure TTS | ~500k chars | Free tier |
| Cloudflare Workers | <1M requests | Free |
| Cloudflare DO | ~100 sessions | ~$0.50 |
| **Total** | | **~$6-8/month** |

With Deepgram's initial $200 credit, you'd have essentially **free usage for 6+ months**.

## Next Steps

1. **Phase 1: Backend Setup**
   - Clone Backpine starter
   - Add `apps/voice` Worker with Durable Object
   - Set up API keys as Wrangler secrets
   - Test WebSocket connection locally

2. **Phase 2: SvelteKit Integration**
   - Replace React app with SvelteKit
   - Implement VoiceClient and AudioWorklet
   - Build practice page UI

3. **Phase 3: Polish**
   - Add conversation history persistence
   - Implement progress tracking
   - Add Vietnamese voice selection options
   - Optimize latency
