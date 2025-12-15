/**
 * Voice Provider Abstraction Layer
 * Supports both Gemini Live API and OpenAI Realtime API with automatic fallback
 * 
 * This design allows:
 * 1. Easy switching between providers
 * 2. Automatic fallback when primary fails
 * 3. Clear visibility into which provider is active
 * 4. Consistent interface for the UI layer
 */

// ============================================
// TYPES & INTERFACES
// ============================================

export type VoiceProvider = 'gemini' | 'openai';

export interface VoiceProviderConfig {
  systemPrompt: string;
  voice?: string;
  language?: string;
  onProviderChange?: (provider: VoiceProvider, reason: string) => void;
}

export interface VoiceClientEvents {
  onConnected: (provider: VoiceProvider) => void;
  onDisconnected: (reason: string) => void;
  onUserTranscript: (text: string) => void;
  onCoachResponse: (text: string, isFinal: boolean) => void;
  onCoachAudio: (audioData: ArrayBuffer) => void;
  onError: (error: Error, provider: VoiceProvider) => void;
  onProviderFallback: (from: VoiceProvider, to: VoiceProvider, reason: string) => void;
  onSessionTimeWarning: (remainingSeconds: number) => void;
}

export interface VoiceClientState {
  isConnected: boolean;
  activeProvider: VoiceProvider | null;
  sessionStartTime: number | null;
  sessionDurationMs: number;
}


// ============================================
// ABSTRACT BASE CLASS
// ============================================

abstract class BaseVoiceProvider {
  protected config: VoiceProviderConfig;
  protected events: VoiceClientEvents;
  
  constructor(config: VoiceProviderConfig, events: VoiceClientEvents) {
    this.config = config;
    this.events = events;
  }
  
  abstract get providerName(): VoiceProvider;
  abstract connect(): Promise<void>;
  abstract disconnect(): void;
  abstract sendAudio(audioData: ArrayBuffer): void;
  abstract sendText(text: string): void;
  abstract isConnected(): boolean;
}

// ============================================
// GEMINI PROVIDER
// ============================================

class GeminiVoiceProvider extends BaseVoiceProvider {
  private session: any = null; // GoogleGenAI Live session
  private ai: any = null;
  
  get providerName(): VoiceProvider {
    return 'gemini';
  }
  
  async connect(): Promise<void> {
    // Dynamic import to avoid bundling issues
    const { GoogleGenAI, Modality } = await import('@google/genai');
    
    // Get ephemeral token from backend
    const tokenResponse = await fetch('/api/voice-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini' }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to get Gemini token: ${tokenResponse.status}`);
    }
    
    const { token } = await tokenResponse.json();
    
    this.ai = new GoogleGenAI({ apiKey: token });

    const config = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { 
          prebuiltVoiceConfig: { voiceName: this.config.voice || 'Kore' } 
        }
      },
      systemInstruction: this.config.systemPrompt,
      outputAudioTranscription: {}, // Enable transcription
      inputAudioTranscription: {},  // Enable input transcription
    };

    this.session = await this.ai.live.connect({
      model: 'gemini-2.5-flash-native-audio-preview-12-2025',
      config,
      callbacks: {
        onopen: () => this.events.onConnected('gemini'),
        onclose: (e: any) => this.events.onDisconnected(e.reason || 'Connection closed'),
        onerror: (e: any) => this.events.onError(new Error(e.message), 'gemini'),
        onmessage: (message: any) => this.handleGeminiMessage(message),
      },
    });
  }
  
  private handleGeminiMessage(message: any) {
    // Handle audio output
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const audioData = this.base64ToArrayBuffer(part.inlineData.data);
          this.events.onCoachAudio(audioData);
        }
      }
    }

    // Handle output transcription
    if (message.serverContent?.outputTranscription?.text) {
      const text = message.serverContent.outputTranscription.text;
      const isFinal = message.serverContent.turnComplete || false;
      this.events.onCoachResponse(text, isFinal);
    }
    
    // Handle input transcription
    if (message.serverContent?.inputTranscription?.text) {
      this.events.onUserTranscript(message.serverContent.inputTranscription.text);
    }
    
    // Handle interruption
    if (message.serverContent?.interrupted) {
      // Model was interrupted by user - could emit event here
    }
  }
  
  private base64ToArrayBuffer(base64: string): ArrayBuffer {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }
  
  disconnect(): void {
    this.session?.close();
    this.session = null;
  }

  sendAudio(audioData: ArrayBuffer): void {
    if (!this.session) return;
    
    // Convert to base64 for Gemini
    const base64 = btoa(String.fromCharCode(...new Uint8Array(audioData)));
    
    this.session.sendRealtimeInput({
      audio: {
        data: base64,
        mimeType: 'audio/pcm;rate=16000'
      }
    });
  }
  
  sendText(text: string): void {
    if (!this.session) return;
    
    this.session.sendClientContent({
      turns: { role: 'user', parts: [{ text }] },
      turnComplete: true
    });
  }
  
  isConnected(): boolean {
    return this.session !== null;
  }
}

// ============================================
// OPENAI PROVIDER
// ============================================

class OpenAIVoiceProvider extends BaseVoiceProvider {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private audioEl: HTMLAudioElement | null = null;

  get providerName(): VoiceProvider {
    return 'openai';
  }
  
  async connect(): Promise<void> {
    // Get ephemeral token from backend
    const tokenResponse = await fetch('/api/voice-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'openai' }),
    });
    
    if (!tokenResponse.ok) {
      throw new Error(`Failed to get OpenAI token: ${tokenResponse.status}`);
    }
    
    const { token } = await tokenResponse.json();
    
    // Create peer connection
    this.pc = new RTCPeerConnection();
    
    // Set up audio playback
    this.audioEl = document.createElement('audio');
    this.audioEl.autoplay = true;
    this.pc.ontrack = (e) => {
      this.audioEl!.srcObject = e.streams[0];
    };
    
    // Add microphone track
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.pc.addTrack(stream.getTracks()[0]);

    // Set up data channel for events
    this.dc = this.pc.createDataChannel('oai-events');
    this.dc.onmessage = (e) => this.handleOpenAIEvent(JSON.parse(e.data));
    this.dc.onopen = () => this.events.onConnected('openai');
    
    // Create and set local description
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);
    
    // Connect to OpenAI
    const response = await fetch('https://api.openai.com/v1/realtime?model=gpt-4o-realtime-preview', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/sdp',
      },
      body: offer.sdp,
    });
    
    if (!response.ok) {
      throw new Error(`OpenAI connection failed: ${response.status}`);
    }
    
    const answerSdp = await response.text();
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    // Configure session
    this.sendEvent({
      type: 'session.update',
      session: {
        modalities: ['audio', 'text'],
        voice: this.config.voice || 'coral',
        instructions: this.config.systemPrompt,
        input_audio_transcription: {
          model: 'whisper-1',
          language: 'vi',
        },
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 500,
        },
      },
    });
  }
  
  private handleOpenAIEvent(event: any) {
    switch (event.type) {
      case 'conversation.item.input_audio_transcription.completed':
        this.events.onUserTranscript(event.transcript);
        break;
      case 'response.audio_transcript.delta':
        this.events.onCoachResponse(event.delta, false);
        break;
      case 'response.audio_transcript.done':
        this.events.onCoachResponse(event.transcript, true);
        break;
      case 'error':
        this.events.onError(new Error(event.error.message), 'openai');
        break;
    }
  }

  private sendEvent(event: any): void {
    if (this.dc?.readyState === 'open') {
      this.dc.send(JSON.stringify(event));
    }
  }
  
  disconnect(): void {
    this.pc?.close();
    this.pc = null;
    this.dc = null;
  }
  
  sendAudio(audioData: ArrayBuffer): void {
    // WebRTC handles audio streaming automatically via the track
    // This method is for consistency with the interface
  }
  
  sendText(text: string): void {
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
  
  isConnected(): boolean {
    return this.dc?.readyState === 'open';
  }
}


// ============================================
// UNIFIED VOICE CLIENT WITH FALLBACK
// ============================================

export class VoiceClient {
  private primaryProvider: VoiceProvider;
  private fallbackProvider: VoiceProvider | null;
  private activeProvider: BaseVoiceProvider | null = null;
  private config: VoiceProviderConfig;
  private events: VoiceClientEvents;
  private state: VoiceClientState;
  private sessionTimer: ReturnType<typeof setTimeout> | null = null;
  
  // Gemini has 15-minute session limit
  private readonly GEMINI_SESSION_LIMIT_MS = 14 * 60 * 1000; // 14 min (1 min buffer)
  private readonly SESSION_WARNING_MS = 60 * 1000; // Warn 1 min before
  
  constructor(
    config: VoiceProviderConfig,
    events: VoiceClientEvents,
    primaryProvider: VoiceProvider = 'gemini',
    fallbackProvider: VoiceProvider | null = 'openai'
  ) {
    this.config = config;
    this.events = events;
    this.primaryProvider = primaryProvider;
    this.fallbackProvider = fallbackProvider;
    this.state = {
      isConnected: false,
      activeProvider: null,
      sessionStartTime: null,
      sessionDurationMs: 0,
    };
  }

  async connect(): Promise<void> {
    try {
      await this.connectToProvider(this.primaryProvider);
    } catch (primaryError) {
      console.error(`Primary provider (${this.primaryProvider}) failed:`, primaryError);
      
      if (this.fallbackProvider) {
        console.log(`Attempting fallback to ${this.fallbackProvider}...`);
        this.events.onProviderFallback(
          this.primaryProvider, 
          this.fallbackProvider,
          (primaryError as Error).message
        );
        
        try {
          await this.connectToProvider(this.fallbackProvider);
        } catch (fallbackError) {
          throw new Error(
            `Both providers failed. Primary (${this.primaryProvider}): ${(primaryError as Error).message}. ` +
            `Fallback (${this.fallbackProvider}): ${(fallbackError as Error).message}`
          );
        }
      } else {
        throw primaryError;
      }
    }
  }
  
  private async connectToProvider(provider: VoiceProvider): Promise<void> {
    if (provider === 'gemini') {
      this.activeProvider = new GeminiVoiceProvider(this.config, this.events);
    } else {
      this.activeProvider = new OpenAIVoiceProvider(this.config, this.events);
    }

    await this.activeProvider.connect();
    
    this.state.isConnected = true;
    this.state.activeProvider = provider;
    this.state.sessionStartTime = Date.now();
    
    // Start session timer for Gemini (15 min limit)
    if (provider === 'gemini') {
      this.startSessionTimer();
    }
  }
  
  private startSessionTimer(): void {
    // Warning at 14 minutes
    this.sessionTimer = setTimeout(() => {
      this.events.onSessionTimeWarning(60);
      // Could auto-reconnect here or let UI handle it
    }, this.GEMINI_SESSION_LIMIT_MS - this.SESSION_WARNING_MS);
  }
  
  disconnect(): void {
    if (this.sessionTimer) {
      clearTimeout(this.sessionTimer);
      this.sessionTimer = null;
    }
    
    this.activeProvider?.disconnect();
    this.activeProvider = null;
    
    this.state.isConnected = false;
    this.state.activeProvider = null;
    this.state.sessionDurationMs = this.state.sessionStartTime 
      ? Date.now() - this.state.sessionStartTime 
      : 0;
    this.state.sessionStartTime = null;
  }

  sendAudio(audioData: ArrayBuffer): void {
    this.activeProvider?.sendAudio(audioData);
  }
  
  sendText(text: string): void {
    this.activeProvider?.sendText(text);
  }
  
  getState(): VoiceClientState {
    return { ...this.state };
  }
  
  getActiveProvider(): VoiceProvider | null {
    return this.state.activeProvider;
  }
  
  /**
   * Manually switch to a different provider
   * Useful for testing or user preference
   */
  async switchProvider(provider: VoiceProvider): Promise<void> {
    const wasConnected = this.state.isConnected;
    this.disconnect();
    this.primaryProvider = provider;
    
    if (wasConnected) {
      await this.connect();
    }
  }
  
  /**
   * Reconnect to extend session (handles Gemini 15-min limit)
   */
  async reconnect(): Promise<void> {
    const currentProvider = this.state.activeProvider;
    this.disconnect();
    
    if (currentProvider) {
      await this.connectToProvider(currentProvider);
    } else {
      await this.connect();
    }
  }
}

export default VoiceClient;
