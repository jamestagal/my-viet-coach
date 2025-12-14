/**
 * RealtimeClient - OpenAI Realtime API client using WebRTC
 *
 * Handles speech-to-speech communication with OpenAI's realtime model
 * for Vietnamese language coaching.
 */

export interface SessionConfig {
	model: 'gpt-4o-realtime-preview' | 'gpt-4o-mini-realtime-preview';
	voice: 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse';
	instructions: string;
	input_audio_transcription?: {
		model: 'whisper-1';
		language?: string;
	};
	turn_detection?: {
		type: 'server_vad';
		threshold?: number;
		prefix_padding_ms?: number;
		silence_duration_ms?: number;
	};
}

export interface RealtimeClientOptions {
	onUserTranscript?: (text: string) => void;
	onCoachResponse?: (text: string, isFinal: boolean) => void;
	onCoachAudioStart?: () => void;
	onCoachAudioEnd?: () => void;
	onConnectionStateChange?: (state: 'connecting' | 'connected' | 'disconnected' | 'error') => void;
	onError?: (error: Error) => void;
}

export type PracticeMode = 'free' | 'coach';

export interface ModeOptions {
	topic: string;
	difficulty: 'beginner' | 'intermediate' | 'advanced';
}

// Difficulty-specific instructions shared between modes
// Note: Gemini Live API doesn't have explicit speech rate parameters,
// so we rely on prompt instructions to control pacing
const difficultyInstructions = {
	beginner: `
## Speech Style for Beginners - VERY IMPORTANT
- Speak SLOWLY and CLEARLY - pause between phrases
- Use short sentences (3-5 words maximum)
- Pronounce each syllable distinctly with clear tones
- Add natural pauses after each sentence to let learner process
- Repeat key vocabulary naturally in conversation

## Content Guidelines
- Use simple, high-frequency vocabulary only
- Provide English translations for ALL new phrases
- Focus on basic greetings, numbers, and everyday expressions
- Use concrete nouns and simple verbs
- Avoid idioms, slang, or regional expressions`,

	intermediate: `
## Speech Style for Intermediate Learners
- Speak at a moderate, conversational pace
- Use natural sentence length (5-10 words)
- Clear pronunciation but natural flow
- Brief pauses at sentence boundaries

## Content Guidelines
- Use natural conversational Vietnamese
- Mix complexity based on learner's responses
- Provide English explanations only when correcting errors
- Introduce common idioms and expressions gradually
- Include some compound sentences and connectors`,

	advanced: `
## Speech Style for Advanced Learners
- Speak at natural native speed
- Use complex sentence structures freely
- Include natural speech patterns (contractions, ellipsis)
- Minimal pauses - flowing conversation

## Content Guidelines
- Use natural, fluent Vietnamese with regional expressions
- Minimal English - only for complex grammar points
- Include proverbs, idioms, and cultural references
- Challenge with nuanced vocabulary and formal/informal registers
- Discuss abstract topics and express complex opinions`
};

/**
 * Create config for Free Conversation mode (no corrections)
 */
export function createFreeConversationConfig(options: ModeOptions): SessionConfig {
	return {
		model: 'gpt-4o-realtime-preview',
		voice: 'coral',
		instructions: `
# Role
You are a friendly Vietnamese conversation partner named "Lan". You're helping a learner practice speaking naturally.

# Current Session
- Topic: ${options.topic}
- Learner Level: ${options.difficulty}

# Core Behavior - IMPORTANT
- DO NOT correct the learner's Vietnamese
- DO NOT point out mistakes or offer improvements
- Simply have a natural, flowing conversation
- Respond to what they say, not how they say it
- Keep the conversation going naturally

# Language Rules
- Conduct the conversation primarily in Vietnamese
- The learner will speak Vietnamese; respond in Vietnamese
- Match their language level naturally

# Personality & Tone
- Friendly, casual, like chatting with a friend
- Use natural conversational particles (à, nhé, nhỉ, ạ, nha)
- Show genuine interest in the conversation topic
- React naturally to what they share

# Level-Specific Guidelines
${difficultyInstructions[options.difficulty]}

# Turn Length
- Keep responses to 2-4 sentences maximum
- Ask follow-up questions to maintain conversation flow
- Pause naturally to let the learner respond

# Adapting to User Requests
- If user asks you to "slow down", "speak slower", "nói chậm hơn" - acknowledge and speak MORE SLOWLY with longer pauses
- If user asks to "repeat", "lặp lại" - repeat the last phrase slowly and clearly
- If user seems confused, simplify your language and slow down

# Starting the Session
- Greet warmly in Vietnamese (casual, not formal)
- Start chatting about the topic naturally
- Ask an easy opening question to get the conversation started
`.trim(),
		input_audio_transcription: {
			model: 'whisper-1',
			language: 'vi'
		},
		turn_detection: {
			type: 'server_vad',
			threshold: 0.6, // Higher threshold = less sensitive, reduces false triggers
			prefix_padding_ms: 400, // More padding before speech starts
			silence_duration_ms: 1000 // Wait longer before ending turn (1 second)
		}
	};
}

/**
 * Create config for Coach Mode (with corrections)
 */
export function createCoachModeConfig(options: ModeOptions): SessionConfig {
	return {
		model: 'gpt-4o-realtime-preview',
		voice: 'coral',
		instructions: `
# Role
You are a friendly Vietnamese language coach named "Cô Hà" (Teacher Hà) helping a learner practice conversation.

# Current Session
- Topic: ${options.topic}
- Learner Level: ${options.difficulty}

# Language Rules
- Conduct the conversation primarily in Vietnamese
- The learner will speak Vietnamese; respond in Vietnamese
- When correcting, briefly explain in English, then continue in Vietnamese

# Personality & Tone
- Warm, encouraging, patient like a favorite aunt/teacher
- Use natural conversational particles (à, nhé, nhỉ, ạ, nha)
- Match the learner's pace and complexity level
- Celebrate progress with genuine enthusiasm

# Level-Specific Guidelines
${difficultyInstructions[options.difficulty]}

# Corrections
- Gently correct grammar and tone errors
- Don't interrupt flow for minor mistakes
- Group corrections at natural pause points
- Format: "Ah, một chút sửa nhé: [correct form]. [Brief English explanation if needed]"

# Turn Length
- Keep responses to 2-4 sentences maximum
- Ask follow-up questions to maintain conversation flow
- Pause naturally to let the learner respond

# Adapting to User Requests
- If user asks you to "slow down", "speak slower", "nói chậm hơn" - acknowledge and speak MORE SLOWLY with longer pauses
- If user asks to "repeat", "lặp lại" - repeat the last phrase slowly and clearly
- If user seems confused, simplify your language and slow down

# Starting the Session
- Greet warmly in Vietnamese
- Introduce the topic naturally
- Ask an easy opening question to get the conversation started
`.trim(),
		input_audio_transcription: {
			model: 'whisper-1',
			language: 'vi'
		},
		turn_detection: {
			type: 'server_vad',
			threshold: 0.6, // Higher threshold = less sensitive, reduces false triggers
			prefix_padding_ms: 400, // More padding before speech starts
			silence_duration_ms: 1000 // Wait longer before ending turn (1 second)
		}
	};
}

export class RealtimeClient {
	private pc: RTCPeerConnection | null = null;
	private dc: RTCDataChannel | null = null;
	private audioEl: HTMLAudioElement | null = null;
	private localStream: MediaStream | null = null;

	// Event callbacks
	public onUserTranscript: ((text: string) => void) | null = null;
	public onCoachResponse: ((text: string, isFinal: boolean) => void) | null = null;
	public onCoachAudioStart: (() => void) | null = null;
	public onCoachAudioEnd: (() => void) | null = null;
	public onConnectionStateChange:
		| ((state: 'connecting' | 'connected' | 'disconnected' | 'error') => void)
		| null = null;
	public onError: ((error: Error) => void) | null = null;

	private sessionConfig: SessionConfig | null = null;
	private responseText = '';

	constructor(options: RealtimeClientOptions = {}) {
		this.onUserTranscript = options.onUserTranscript || null;
		this.onCoachResponse = options.onCoachResponse || null;
		this.onCoachAudioStart = options.onCoachAudioStart || null;
		this.onCoachAudioEnd = options.onCoachAudioEnd || null;
		this.onConnectionStateChange = options.onConnectionStateChange || null;
		this.onError = options.onError || null;
	}

	/**
	 * Connect to OpenAI Realtime API
	 */
	async connect(config: SessionConfig): Promise<void> {
		this.sessionConfig = config;
		this.onConnectionStateChange?.('connecting');

		try {
			// 1. Get ephemeral token from backend (private route - requires auth)
			const tokenResponse = await fetch('/api/private/realtime-token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ model: config.model })
			});

			if (!tokenResponse.ok) {
				const error = await tokenResponse.json();
				throw new Error(error.message || 'Failed to get realtime token');
			}

			const { token } = await tokenResponse.json();

			// 2. Create peer connection
			this.pc = new RTCPeerConnection();

			// 3. Set up audio playback for coach's voice
			this.audioEl = document.createElement('audio');
			this.audioEl.autoplay = true;

			this.pc.ontrack = (event) => {
				if (this.audioEl && event.streams[0]) {
					this.audioEl.srcObject = event.streams[0];
				}
			};

			// 4. Get microphone access and add track
			this.localStream = await navigator.mediaDevices.getUserMedia({
				audio: {
					echoCancellation: true,
					noiseSuppression: true,
					autoGainControl: true
				}
			});

			const audioTrack = this.localStream.getAudioTracks()[0];
			this.pc.addTrack(audioTrack, this.localStream);

			// 5. Set up data channel for events
			this.dc = this.pc.createDataChannel('oai-events');
			this.dc.onopen = () => {
				// Configure session once data channel is open
				this.sendEvent({
					type: 'session.update',
					session: {
						modalities: ['audio', 'text'],
						voice: config.voice,
						instructions: config.instructions,
						input_audio_transcription: config.input_audio_transcription,
						turn_detection: config.turn_detection
					}
				});
			};
			this.dc.onmessage = (event) => {
				this.handleEvent(JSON.parse(event.data));
			};

			// 6. Handle connection state changes
			this.pc.onconnectionstatechange = () => {
				switch (this.pc?.connectionState) {
					case 'connected':
						this.onConnectionStateChange?.('connected');
						break;
					case 'disconnected':
					case 'closed':
						this.onConnectionStateChange?.('disconnected');
						break;
					case 'failed':
						this.onConnectionStateChange?.('error');
						this.onError?.(new Error('Connection failed'));
						break;
				}
			};

			// 7. Create and set local description
			const offer = await this.pc.createOffer();
			await this.pc.setLocalDescription(offer);

			// 8. Connect to OpenAI Realtime API
			const baseUrl = 'https://api.openai.com/v1/realtime';
			const response = await fetch(`${baseUrl}?model=${config.model}`, {
				method: 'POST',
				headers: {
					Authorization: `Bearer ${token}`,
					'Content-Type': 'application/sdp'
				},
				body: offer.sdp
			});

			if (!response.ok) {
				throw new Error(`OpenAI connection failed: ${response.status}`);
			}

			const answerSdp = await response.text();
			await this.pc.setRemoteDescription({
				type: 'answer',
				sdp: answerSdp
			});
		} catch (error) {
			this.onConnectionStateChange?.('error');
			this.onError?.(error instanceof Error ? error : new Error(String(error)));
			throw error;
		}
	}

	/**
	 * Handle events from OpenAI Realtime API
	 */
	private handleEvent(event: Record<string, unknown>): void {
		const eventType = event.type as string;

		switch (eventType) {
			// Session events
			case 'session.created':
			case 'session.updated':
				// Session configured successfully
				break;

			// User speech transcription
			case 'conversation.item.input_audio_transcription.completed':
				this.onUserTranscript?.(event.transcript as string);
				break;

			// Coach response events
			case 'response.audio.started':
				this.onCoachAudioStart?.();
				this.responseText = '';
				break;

			case 'response.audio_transcript.delta':
				this.responseText += event.delta as string;
				this.onCoachResponse?.(this.responseText, false);
				break;

			case 'response.audio_transcript.done':
				// Use the accumulated responseText if it's longer (more complete)
				// The done event's transcript can sometimes be truncated
				const doneTranscript = event.transcript as string;
				const finalText = this.responseText.length >= doneTranscript.length
					? this.responseText
					: doneTranscript;
				this.onCoachResponse?.(finalText, true);
				this.responseText = ''; // Clear for next response
				break;

			case 'response.audio.done':
				this.onCoachAudioEnd?.();
				break;

			// Error handling
			case 'error':
				const errorData = event.error as { message?: string };
				this.onError?.(new Error(errorData?.message || 'Unknown error'));
				break;

			// Rate limits
			case 'rate_limits.updated':
				// Could track usage here
				break;
		}
	}

	/**
	 * Send an event to OpenAI
	 */
	private sendEvent(event: Record<string, unknown>): void {
		if (this.dc?.readyState === 'open') {
			this.dc.send(JSON.stringify(event));
		}
	}

	/**
	 * Update session configuration mid-session (e.g., for mode switching)
	 */
	updateSessionConfig(config: Partial<SessionConfig>): void {
		this.sendEvent({
			type: 'session.update',
			session: {
				...(config.instructions && { instructions: config.instructions }),
				...(config.voice && { voice: config.voice }),
				...(config.turn_detection && { turn_detection: config.turn_detection })
			}
		});

		if (config.instructions && this.sessionConfig) {
			this.sessionConfig.instructions = config.instructions;
		}
	}

	/**
	 * Send a text message to the coach (useful for initial context)
	 */
	sendTextMessage(text: string): void {
		this.sendEvent({
			type: 'conversation.item.create',
			item: {
				type: 'message',
				role: 'user',
				content: [{ type: 'input_text', text }]
			}
		});
		this.sendEvent({ type: 'response.create' });
	}

	/**
	 * Interrupt the coach (stop current response)
	 */
	interrupt(): void {
		this.sendEvent({ type: 'response.cancel' });
	}

	/**
	 * Mute/unmute microphone
	 */
	setMuted(muted: boolean): void {
		if (this.localStream) {
			this.localStream.getAudioTracks().forEach((track) => {
				track.enabled = !muted;
			});
		}
	}

	/**
	 * Check if microphone is muted
	 */
	isMuted(): boolean {
		if (this.localStream) {
			const track = this.localStream.getAudioTracks()[0];
			return track ? !track.enabled : true;
		}
		return true;
	}

	/**
	 * Disconnect and clean up
	 */
	disconnect(): void {
		// Stop local media tracks
		if (this.localStream) {
			this.localStream.getTracks().forEach((track) => track.stop());
			this.localStream = null;
		}

		// Close data channel
		if (this.dc) {
			this.dc.close();
			this.dc = null;
		}

		// Close peer connection
		if (this.pc) {
			this.pc.close();
			this.pc = null;
		}

		// Clean up audio element
		if (this.audioEl) {
			this.audioEl.srcObject = null;
			this.audioEl = null;
		}

		this.onConnectionStateChange?.('disconnected');
	}

	/**
	 * Check if currently connected
	 */
	isConnected(): boolean {
		return this.pc?.connectionState === 'connected';
	}
}
