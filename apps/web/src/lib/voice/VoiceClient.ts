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
  onUserTranscriptStreaming?: (text: string) => void; // Real-time streaming (not finalized)
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
  private mediaStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private playbackContext: AudioContext | null = null;
  private isCapturing = false;
  private _isConnected = false;

  // Transcription buffering - accumulate until turn complete
  private userTranscriptBuffer = '';
  private coachTranscriptBuffer = '';

  // Debounce for user transcript emission (longer delay to avoid fragmentation)
  private userTranscriptTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly USER_TRANSCRIPT_DELAY = 2500; // 2.5s silence before emitting

  // Audio queue for smooth playback
  private audioQueue: ArrayBuffer[] = [];
  private isPlayingAudio = false;
  private nextPlayTime = 0;
  private gainNode: GainNode | null = null;
  private readonly PREBUFFER_CHUNKS = 2; // Wait for N chunks before starting playback

  get providerName(): VoiceProvider {
    return 'gemini';
  }

  async connect(): Promise<void> {
    console.log('[Gemini] Starting connection...');

    // Dynamic import to avoid bundling issues
    const { GoogleGenAI, Modality } = await import('@google/genai');
    console.log('[Gemini] SDK loaded');

    // Get ephemeral token from backend (using SvelteKit server route)
    const tokenResponse = await fetch('/api/private/realtime-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider: 'gemini' }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Failed to get Gemini token: ${tokenResponse.status}`);
    }

    const { token } = await tokenResponse.json();
    console.log('[Gemini] Token received, length:', token?.length);

    this.ai = new GoogleGenAI({ apiKey: token });

    // Vietnamese language code for output speech
    const languageCode = this.config.language === 'vi' ? 'vi-VN' : 'en-US';

    const config = {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: { voiceName: this.config.voice || 'Kore' }
        },
        // Set output language to Vietnamese for better pronunciation
        languageCode: languageCode,
      },
      systemInstruction: this.config.systemPrompt,
      outputAudioTranscription: {}, // Enable transcription
      // Note: inputAudioTranscription doesn't support languageCode yet in Gemini Live API
      // The model auto-detects language, but may misidentify Vietnamese as Thai occasionally
      inputAudioTranscription: {},
    };

    console.log('[Gemini] Connecting to live session...');

    try {
      this.session = await this.ai.live.connect({
        model: 'models/gemini-2.5-flash-native-audio-preview-12-2025',
        config,
        callbacks: {
          onopen: async () => {
            console.log('[Gemini] WebSocket opened');
            this._isConnected = true;
            // Start microphone capture after connection is established
            await this.startMicrophoneCapture();
            this.events.onConnected('gemini');
          },
          onclose: (e: any) => {
            // Enhanced logging to diagnose disconnection issues
            console.log('[Gemini] WebSocket closed:', {
              code: e?.code,
              reason: e?.reason,
              wasClean: e?.wasClean,
              event: e,
            });
            this._isConnected = false;
            this.stopMicrophoneCapture();

            // Provide more descriptive reason for debugging
            const closeReason = e?.reason
              || (e?.code === 1000 ? 'Normal closure'
                : e?.code === 1006 ? 'Abnormal closure (network issue or server timeout)'
                : e?.code === 1001 ? 'Going away (page navigation or server shutdown)'
                : e?.code === 1011 ? 'Server error'
                : `Connection closed (code: ${e?.code || 'unknown'})`);

            this.events.onDisconnected(closeReason);
          },
          onerror: (e: any) => {
            console.error('[Gemini] WebSocket error:', {
              message: e?.message,
              type: e?.type,
              error: e,
            });
            this._isConnected = false;
            this.events.onError(new Error(e?.message || 'Connection error'), 'gemini');
          },
          onmessage: (message: any) => {
            console.log('[Gemini] Message received:', message);
            this.handleGeminiMessage(message);
          },
        },
      });
      console.log('[Gemini] Session created:', this.session);
    } catch (err) {
      console.error('[Gemini] Connection failed:', err);
      throw err;
    }

    // Initialize playback context for audio output
    this.playbackContext = new AudioContext({ sampleRate: 24000 });
  }

  private async startMicrophoneCapture(): Promise<void> {
    try {
      // Get microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        }
      });

      // Create audio context for processing
      this.audioContext = new AudioContext({ sampleRate: 16000 });

      // Create source from microphone
      this.sourceNode = this.audioContext.createMediaStreamSource(this.mediaStream);

      // Use ScriptProcessorNode for audio capture (AudioWorklet would be better but more complex)
      const bufferSize = 4096;
      const scriptProcessor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

      scriptProcessor.onaudioprocess = (e) => {
        if (!this.isCapturing || !this.session) return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Convert Float32 to Int16 PCM
        const pcmData = this.float32ToInt16(inputData);
        // Send to Gemini
        this.sendAudioChunk(pcmData);
      };

      this.sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(this.audioContext.destination);

      this.isCapturing = true;
      console.log('[Gemini] Microphone capture started');
    } catch (err) {
      console.error('[Gemini] Failed to start microphone:', err);
      throw new Error(`Microphone access denied: ${(err as Error).message}`);
    }
  }

  private float32ToInt16(float32Array: Float32Array): Int16Array {
    const int16Array = new Int16Array(float32Array.length);
    for (let i = 0; i < float32Array.length; i++) {
      const s = Math.max(-1, Math.min(1, float32Array[i]));
      int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return int16Array;
  }

  private sendAudioChunk(pcmData: Int16Array): void {
    if (!this.session || !this._isConnected) return;

    try {
      // Convert Int16Array to base64
      const uint8Array = new Uint8Array(pcmData.buffer);
      let binary = '';
      for (let i = 0; i < uint8Array.length; i++) {
        binary += String.fromCharCode(uint8Array[i]);
      }
      const base64 = btoa(binary);

      this.session.sendRealtimeInput({
        audio: {
          data: base64,
          mimeType: 'audio/pcm;rate=16000'
        }
      });
    } catch (err) {
      // Silently ignore send errors when connection is closing
      console.warn('[Gemini] Failed to send audio chunk:', err);
    }
  }

  private stopMicrophoneCapture(): void {
    this.isCapturing = false;

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(track => track.stop());
      this.mediaStream = null;
    }

    if (this.playbackContext) {
      this.playbackContext.close();
      this.playbackContext = null;
    }

    console.log('[Gemini] Microphone capture stopped');
  }
  
  private handleGeminiMessage(message: any) {
    // Handle audio output - queue for smooth playback
    if (message.serverContent?.modelTurn?.parts) {
      for (const part of message.serverContent.modelTurn.parts) {
        if (part.inlineData?.data) {
          const audioData = this.base64ToArrayBuffer(part.inlineData.data);
          this.queueAudio(audioData);
          this.events.onCoachAudio(audioData);
        }
      }
    }

    // Handle output transcription - accumulate until turn complete
    if (message.serverContent?.outputTranscription?.text) {
      const text = message.serverContent.outputTranscription.text;
      // Accumulate the transcript
      this.coachTranscriptBuffer += text;
      // Send accumulated text as streaming (not final)
      this.events.onCoachResponse(this.coachTranscriptBuffer, false);
    }

    // Handle turn complete - finalize coach response
    if (message.serverContent?.turnComplete) {
      if (this.coachTranscriptBuffer.trim()) {
        this.events.onCoachResponse(this.coachTranscriptBuffer.trim(), true);
      }
      this.coachTranscriptBuffer = '';
    }

    // Handle input transcription - accumulate, stream, and debounce
    if (message.serverContent?.inputTranscription?.text) {
      let text = message.serverContent.inputTranscription.text;
      // Filter out <noise> tags that Gemini sometimes adds
      text = text.replace(/<noise>/gi, '').replace(/\s+/g, ' ').trim();
      if (!text) return; // Skip if only noise
      this.userTranscriptBuffer += (this.userTranscriptBuffer ? ' ' : '') + text;

      // Stream for real-time visual feedback
      this.events.onUserTranscriptStreaming?.(this.userTranscriptBuffer);

      // Reset debounce timer - emit after silence
      if (this.userTranscriptTimeout) {
        clearTimeout(this.userTranscriptTimeout);
      }
      this.userTranscriptTimeout = setTimeout(() => {
        if (this.userTranscriptBuffer.trim()) {
          this.events.onUserTranscript(this.userTranscriptBuffer.trim());
          this.userTranscriptBuffer = '';
          // Clear streaming display
          this.events.onUserTranscriptStreaming?.('');
        }
      }, this.USER_TRANSCRIPT_DELAY);
    }

    // Handle user turn complete (when model starts responding) - emit full transcript immediately
    if (message.serverContent?.modelTurn && this.userTranscriptBuffer.trim()) {
      // Clear debounce since model is responding
      if (this.userTranscriptTimeout) {
        clearTimeout(this.userTranscriptTimeout);
        this.userTranscriptTimeout = null;
      }
      // User finished speaking, emit the full accumulated transcript
      this.events.onUserTranscript(this.userTranscriptBuffer.trim());
      this.userTranscriptBuffer = '';
      this.events.onUserTranscriptStreaming?.('');
    }

    // Handle turnComplete for user (in case modelTurn doesn't fire)
    if (message.serverContent?.turnComplete && this.userTranscriptBuffer.trim()) {
      if (this.userTranscriptTimeout) {
        clearTimeout(this.userTranscriptTimeout);
        this.userTranscriptTimeout = null;
      }
      // Emit any remaining user transcript
      this.events.onUserTranscript(this.userTranscriptBuffer.trim());
      this.userTranscriptBuffer = '';
      this.events.onUserTranscriptStreaming?.('');
    }

    // Handle interruption
    if (message.serverContent?.interrupted) {
      if (this.userTranscriptTimeout) {
        clearTimeout(this.userTranscriptTimeout);
        this.userTranscriptTimeout = null;
      }
      // User interrupted - emit what we have
      if (this.userTranscriptBuffer.trim()) {
        this.events.onUserTranscript(this.userTranscriptBuffer.trim());
        this.userTranscriptBuffer = '';
        this.events.onUserTranscriptStreaming?.('');
      }
      // Clear coach buffer since they were interrupted
      this.coachTranscriptBuffer = '';
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

  private queueAudio(audioData: ArrayBuffer): void {
    this.audioQueue.push(audioData);

    // Wait for prebuffer before starting playback to reduce stuttering
    if (!this.isPlayingAudio && this.audioQueue.length >= this.PREBUFFER_CHUNKS) {
      this.startAudioPlayback();
    }
  }

  private startAudioPlayback(): void {
    if (!this.playbackContext || this.isPlayingAudio) return;

    // Create gain node for smooth volume control if not exists
    if (!this.gainNode) {
      this.gainNode = this.playbackContext.createGain();
      this.gainNode.connect(this.playbackContext.destination);
    }

    // Reset timing
    this.nextPlayTime = this.playbackContext.currentTime;
    this.isPlayingAudio = true;
    this.playNextAudio();
  }

  private async playNextAudio(): Promise<void> {
    if (!this.playbackContext || !this.gainNode) {
      this.isPlayingAudio = false;
      return;
    }

    // If queue is empty, wait a bit for more chunks before stopping
    if (this.audioQueue.length === 0) {
      // Small delay to wait for more chunks
      setTimeout(() => {
        if (this.audioQueue.length > 0) {
          this.playNextAudio();
        } else {
          this.isPlayingAudio = false;
        }
      }, 50);
      return;
    }

    const audioData = this.audioQueue.shift()!;

    try {
      // Gemini returns PCM audio at 24kHz
      const int16Array = new Int16Array(audioData);
      const float32Array = new Float32Array(int16Array.length);

      // Convert Int16 to Float32
      for (let i = 0; i < int16Array.length; i++) {
        float32Array[i] = int16Array[i] / 32768;
      }

      // Create audio buffer
      const audioBuffer = this.playbackContext.createBuffer(1, float32Array.length, 24000);
      audioBuffer.getChannelData(0).set(float32Array);

      // Schedule audio for seamless playback
      const source = this.playbackContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.gainNode);

      // Schedule chunk to play immediately after previous one
      const currentTime = this.playbackContext.currentTime;
      const startTime = Math.max(currentTime, this.nextPlayTime);

      source.start(startTime);

      // Update next play time for continuous playback
      this.nextPlayTime = startTime + audioBuffer.duration;

      // Schedule next chunk proactively
      if (this.audioQueue.length > 0) {
        requestAnimationFrame(() => this.playNextAudio());
      } else {
        // Wait for chunk to end before checking again
        source.onended = () => {
          this.playNextAudio();
        };
      }
    } catch (err) {
      console.error('[Gemini] Error playing audio:', err);
      this.playNextAudio(); // Try next chunk
    }
  }

  disconnect(): void {
    this.stopMicrophoneCapture();
    this.session?.close();
    this.session = null;
    // Clear buffers
    this.userTranscriptBuffer = '';
    this.coachTranscriptBuffer = '';
    this.audioQueue = [];
    this.isPlayingAudio = false;
    this.nextPlayTime = 0;
    // Clear debounce timeout
    if (this.userTranscriptTimeout) {
      clearTimeout(this.userTranscriptTimeout);
      this.userTranscriptTimeout = null;
    }
    // Disconnect gain node
    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }
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
    // Get ephemeral token from backend (using SvelteKit server route)
    const tokenResponse = await fetch('/api/private/realtime-token', {
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
