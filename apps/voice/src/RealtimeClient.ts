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