<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { Mic, MicOff, Phone, PhoneOff, BookOpen, Sparkles, Volume2, VolumeX, MessageCircle, GraduationCap, RefreshCw, X, Check, Loader2, Save, Zap, Lock } from 'lucide-svelte';
	import {
		VoiceClient,
		type VoiceProvider,
	} from '$lib/voice/VoiceClient';
	import {
		createFreeConversationConfig,
		createCoachModeConfig,
		type PracticeMode,
		type ModeOptions
	} from '$lib/voice/RealtimeClient';
	import UsageBar from '$lib/components/UsageBar.svelte';
	import UsageWarning from '$lib/components/UsageWarning.svelte';
	import {
		getUsageStatus,
		startSession as startUsageSession,
		sendHeartbeat,
		endSession as endUsageSession,
		hasNoCredits,
		type UsageStatus,
		type SessionEndOptions
	} from '$lib/services/usage';

	// Types
	type Topic = {
		value: string;
		label: string;
		labelEn: string;
		icon: string;
	};

	type Difficulty = 'beginner' | 'intermediate' | 'advanced';

	type ConnectionState = 'idle' | 'connecting' | 'connected' | 'disconnected' | 'error';

	type TranscriptMessage = {
		role: 'user' | 'coach';
		text: string;
		timestamp: number;
	};

	type CorrectionRecord = {
		original: string;
		correction: string;
		explanation: string;
		category: 'grammar' | 'tone' | 'vocabulary' | 'word_order' | 'pronunciation';
	};

	// State
	let connectionState = $state<ConnectionState>('idle');
	let selectedTopic = $state('general');
	let selectedDifficulty = $state<Difficulty>('intermediate');
	let selectedMode = $state<PracticeMode>('coach');
	let isCoachSpeaking = $state(false);
	let isMuted = $state(false);
	let errorMessage = $state('');
	let isSwitchingMode = $state(false);

	// Usage tracking state
	let usageStatus = $state<UsageStatus>({
		plan: 'free',
		minutesUsed: 0,
		minutesRemaining: 10,
		minutesLimit: 10,
		periodStart: '',
		periodEnd: '',
		hasActiveSession: false,
		activeSessionMinutes: 0,
		percentUsed: 0
	});
	let isLoadingUsage = $state(true);
	let usageSessionId = $state<string | null>(null);
	let heartbeatInterval: ReturnType<typeof setInterval> | null = null;
	let showLowCreditWarning = $state(false);

	// Conversation display - shows full history with streaming support
	let conversationHistory = $state<TranscriptMessage[]>([]);
	let streamingCoachText = $state(''); // Current streaming response (not yet finalized)
	let streamingUserText = $state(''); // Current user speech being transcribed

	// Transcript collection for session summary
	let sessionTranscript = $state<TranscriptMessage[]>([]);
	let sessionId = $state<string>('');
	let showSummaryModal = $state(false);
	let corrections = $state<CorrectionRecord[]>([]);
	let isExtractingCorrections = $state(false);
	let extractionError = $state('');

	// Auto-scroll ref
	let conversationContainer: HTMLDivElement | null = $state(null);

	// Provider tracking (Gemini primary, OpenAI fallback)
	let activeProvider = $state<VoiceProvider | null>(null);
	let initialProvider = $state<VoiceProvider | null>(null); // Track initial provider for session health
	let showFallbackNotice = $state(false);
	let fallbackReason = $state('');
	let showSessionWarning = $state(false);
	let sessionWarningSeconds = $state(0);
	let disconnectReason = $state(''); // Track why session disconnected
	let disconnectCode = $state<number | undefined>(undefined); // WebSocket close code

	// Client instance
	let client: VoiceClient | null = null;

	// Derived values
	let canStartSession = $derived(!hasNoCredits(usageStatus.minutesRemaining) && !isLoadingUsage);

	// Available topics with Vietnamese cultural icons
	const topics: Topic[] = [
		{ value: 'general', label: 'Trò chuyện chung', labelEn: 'General chat', icon: '💬' },
		{ value: 'food', label: 'Ẩm thực', labelEn: 'Food & dining', icon: '🍜' },
		{ value: 'travel', label: 'Du lịch', labelEn: 'Travel', icon: '✈️' },
		{ value: 'family', label: 'Gia đình', labelEn: 'Family', icon: '👨‍👩‍👧' },
		{ value: 'work', label: 'Công việc', labelEn: 'Work', icon: '💼' },
		{ value: 'hobbies', label: 'Sở thích', labelEn: 'Hobbies', icon: '🎨' },
		{ value: 'shopping', label: 'Mua sắm', labelEn: 'Shopping', icon: '🛍️' },
		{ value: 'culture', label: 'Văn hóa', labelEn: 'Culture', icon: '🏮' }
	];

	const difficulties: { value: Difficulty; label: string; labelEn: string; desc: string }[] = [
		{ value: 'beginner', label: 'Người mới', labelEn: 'Beginner', desc: 'Simple words, translations' },
		{ value: 'intermediate', label: 'Trung cấp', labelEn: 'Intermediate', desc: 'Natural conversation' },
		{ value: 'advanced', label: 'Nâng cao', labelEn: 'Advanced', desc: 'Idioms, cultural depth' }
	];

	const modes: { value: PracticeMode; label: string; labelEn: string; desc: string; descEn: string }[] = [
		{
			value: 'free',
			label: 'Trò chuyện tự do',
			labelEn: 'Free Chat',
			desc: 'Nói thoải mái, không sửa lỗi',
			descEn: 'Practice speaking naturally without corrections'
		},
		{
			value: 'coach',
			label: 'Học với Cô Hà',
			labelEn: 'Coach Mode',
			desc: 'Được sửa lỗi và giải thích',
			descEn: 'Get gentle corrections and explanations'
		}
	];

	// Get config based on selected mode
	function getConfigForMode(mode: PracticeMode) {
		const modeOptions: ModeOptions = {
			topic: topics.find(t => t.value === selectedTopic)?.labelEn || selectedTopic,
			difficulty: selectedDifficulty
		};

		return mode === 'free'
			? createFreeConversationConfig(modeOptions)
			: createCoachModeConfig(modeOptions);
	}

	// Auto-scroll to bottom of conversation
	function scrollToBottom() {
		if (conversationContainer) {
			setTimeout(() => {
				conversationContainer?.scrollTo({
					top: conversationContainer.scrollHeight,
					behavior: 'smooth'
				});
			}, 50);
		}
	}

	// Load usage status on mount
	async function loadUsageStatus() {
		isLoadingUsage = true;
		try {
			usageStatus = await getUsageStatus();
		} catch (err) {
			console.error('[Practice] Failed to load usage status:', err);
			// Keep default free plan status on error
		} finally {
			isLoadingUsage = false;
		}
	}

	// Start heartbeat interval
	function startHeartbeat() {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
		}

		// Send heartbeat every 30 seconds
		heartbeatInterval = setInterval(async () => {
			if (!usageSessionId) return;

			try {
				const result = await sendHeartbeat(usageSessionId);

				// Update usage status from heartbeat response
				usageStatus.minutesUsed = usageStatus.minutesLimit - result.minutesRemaining;
				usageStatus.minutesRemaining = result.minutesRemaining;
				usageStatus.percentUsed = Math.round(
					(usageStatus.minutesUsed / usageStatus.minutesLimit) * 100
				);

				// Show warning if low on credits
				if (result.warning) {
					showLowCreditWarning = true;
					console.warn('[Practice] Low credit warning:', result.warning);
				}

				// Auto-end session if credits exhausted
				if (result.minutesRemaining <= 0) {
					errorMessage = 'Session ended: Monthly limit reached.';
					await endSession();
				}
			} catch (err) {
				console.error('[Practice] Heartbeat failed:', err);
			}
		}, 30_000);
	}

	// Stop heartbeat interval
	function stopHeartbeat() {
		if (heartbeatInterval) {
			clearInterval(heartbeatInterval);
			heartbeatInterval = null;
		}
	}

	// Connect to voice session (with optional provider override)
	async function startSession(forceProvider?: 'gemini' | 'openai') {
		// Check credits before starting
		if (!canStartSession) {
			errorMessage = 'No credits remaining. Please upgrade your plan.';
			return;
		}

		connectionState = 'connecting';
		errorMessage = '';
		showLowCreditWarning = false;

		// Only reset history if this is a fresh session, not a reconnect
		if (!forceProvider) {
			conversationHistory = [];
			sessionTranscript = [];
			sessionId = crypto.randomUUID();
		}
		streamingCoachText = '';
		streamingUserText = '';
		// Reset provider state
		activeProvider = null;
		initialProvider = null;
		showFallbackNotice = false;
		fallbackReason = '';
		showSessionWarning = false;
		disconnectReason = '';
		disconnectCode = undefined;

		// Determine the primary provider for this session
		const primaryProvider = forceProvider || 'gemini';
		const fallbackProvider = forceProvider ? null : 'openai'; // No fallback when forcing a specific provider

		try {
			// 1. Start usage session first (reserves credits) - pass mode and provider
			const usageResult = await startUsageSession({
				topic: selectedTopic,
				difficulty: selectedDifficulty,
				mode: selectedMode,
				provider: primaryProvider
			});
			usageSessionId = usageResult.sessionId;

			// Store the initial provider for tracking provider switches
			initialProvider = primaryProvider;

			// 2. Start heartbeat
			startHeartbeat();

			// 3. Connect to voice API
			const config = getConfigForMode(selectedMode);

			client = new VoiceClient(
				{
					systemPrompt: config.instructions,
					voice: selectedMode === 'coach' ? 'Kore' : 'Puck', // Gemini voices
					language: 'vi',
				},
				{
					onConnected: (provider) => {
						activeProvider = provider;
						connectionState = 'connected';
					},
					onDisconnected: (reason, code) => {
						console.log('[Practice] Session disconnected:', reason, 'code:', code);
						disconnectReason = reason;
						disconnectCode = code;
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
							streamingUserText = '';
							scrollToBottom();
						}
					},
					onUserTranscriptStreaming: (text) => {
						// Real-time display while user is speaking (not finalized yet)
						streamingUserText = text;
						scrollToBottom();
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
							isCoachSpeaking = false;
							scrollToBottom();
						} else {
							streamingCoachText = text;
							isCoachSpeaking = true;
							scrollToBottom();
						}
					},
					onCoachAudio: (audioData) => {
						// Audio playback handled by providers (WebRTC for OpenAI, need audio context for Gemini)
						isCoachSpeaking = true;
					},
					onError: (error, provider) => {
						errorMessage = `${provider}: ${error.message}`;
						connectionState = 'error';
					},
					onProviderFallback: (from, to, reason) => {
						showFallbackNotice = true;
						fallbackReason = reason;
						activeProvider = to;
						console.warn(`Switched from ${from} to ${to}: ${reason}`);
					},
					onSessionTimeWarning: (remainingSeconds) => {
						showSessionWarning = true;
						sessionWarningSeconds = remainingSeconds;
					},
				},
				primaryProvider,
				fallbackProvider
			);

			await client.connect();
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to connect';
			connectionState = 'error';

			// Clean up usage session if voice connection failed
			if (usageSessionId) {
				try {
					await endUsageSession({ sessionId: usageSessionId });
				} catch {
					// Ignore cleanup errors
				}
				usageSessionId = null;
			}
			stopHeartbeat();
		}
	}

	// End session
	async function endSession() {
		// Stop heartbeat first
		stopHeartbeat();

		// Disconnect from voice API
		client?.disconnect();
		client = null;

		// Store session ID for corrections saving (before it gets cleared)
		const sessionIdForCorrections = usageSessionId;

		// End usage session with extended data
		if (usageSessionId) {
			try {
				// Build session end options with complete data
				const endOptions: SessionEndOptions = {
					sessionId: usageSessionId,
					// Disconnect info
					disconnectCode: disconnectCode,
					disconnectReason: disconnectReason || 'User ended session',
					// Provider info
					provider: activeProvider || initialProvider || 'gemini',
					providerSwitched: initialProvider !== null && activeProvider !== null && initialProvider !== activeProvider,
					// Message data
					messageCount: sessionTranscript.length,
					messages: sessionTranscript.map(msg => ({
						role: msg.role,
						text: msg.text,
						timestamp: msg.timestamp
					})),
					// Corrections will be saved separately after extraction
					corrections: []
				};

				const result = await endUsageSession(endOptions);
				usageStatus.minutesUsed = result.totalMinutesUsed;
				usageStatus.minutesRemaining = result.minutesRemaining;
				usageStatus.percentUsed = Math.round(
					(usageStatus.minutesUsed / usageStatus.minutesLimit) * 100
				);
			} catch (err) {
				console.error('[Practice] Failed to end usage session:', err);
			}
			usageSessionId = null;
		}

		// Show summary modal if in Coach Mode and we have transcript
		if (selectedMode === 'coach' && sessionTranscript.length > 0) {
			showSummaryModal = true;
			connectionState = 'disconnected';
			await extractCorrections(sessionIdForCorrections);
		} else {
			resetSession();
		}
	}

	// Extract corrections from transcript using AI and save to database
	async function extractCorrections(sessionIdToSave: string | null) {
		if (sessionTranscript.length === 0) return;

		isExtractingCorrections = true;
		extractionError = '';
		corrections = [];

		try {
			const response = await fetch('/api/private/extract-corrections', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					transcript: sessionTranscript,
					topic: topics.find(t => t.value === selectedTopic)?.labelEn || selectedTopic,
					difficulty: selectedDifficulty
				})
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.message || 'Failed to extract corrections');
			}

			const data = await response.json();
			corrections = data.corrections || [];

			// Save corrections to database if we have a session ID and corrections
			if (sessionIdToSave && corrections.length > 0) {
				try {
					const saveResponse = await fetch('/api/session/corrections', {
						method: 'POST',
						headers: { 'Content-Type': 'application/json' },
						body: JSON.stringify({
							sessionId: sessionIdToSave,
							corrections: corrections
						})
					});

					if (!saveResponse.ok) {
						console.error('[Practice] Failed to save corrections to database');
					}
				} catch (saveErr) {
					console.error('[Practice] Error saving corrections:', saveErr);
				}
			}
		} catch (err) {
			extractionError = err instanceof Error ? err.message : 'Failed to analyze session';
		} finally {
			isExtractingCorrections = false;
		}
	}

	// Reset session state
	function resetSession() {
		connectionState = 'idle';
		conversationHistory = [];
		streamingCoachText = '';
		streamingUserText = '';
		isCoachSpeaking = false;
		isMuted = false;
		showSummaryModal = false;
		corrections = [];
		extractionError = '';
		showLowCreditWarning = false;
		initialProvider = null;
		disconnectCode = undefined;
	}

	// Close summary modal and reset
	// Note: Corrections are now saved server-side via session end API, no localStorage needed
	function closeSummary() {
		showSummaryModal = false;
		resetSession();
	}

	// Toggle mute
	function toggleMute() {
		isMuted = !isMuted;
		// Note: VoiceClient doesn't have setMuted yet - would need to implement
	}

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

	// Switch mode mid-session (requires reconnect with new config)
	async function switchMode() {
		if (!client || isSwitchingMode) return;

		isSwitchingMode = true;
		const newMode: PracticeMode = selectedMode === 'free' ? 'coach' : 'free';

		try {
			// Disconnect current session
			client.disconnect();
			selectedMode = newMode;
			// Start new session with updated mode
			await startSession();
		} catch (err) {
			errorMessage = 'Failed to switch mode';
		} finally {
			isSwitchingMode = false;
		}
	}

	// Lifecycle
	onMount(() => {
		loadUsageStatus();
	});

	onDestroy(() => {
		// Clean up heartbeat
		stopHeartbeat();

		// End usage session if active
		if (usageSessionId) {
			endUsageSession({ sessionId: usageSessionId }).catch(() => {});
		}

		// Disconnect voice client
		client?.disconnect();
	});
</script>

<svelte:head>
	<title>Practice Vietnamese | Speak Pho Real</title>
</svelte:head>

<div class="min-h-[calc(100vh-3.5rem)] flex flex-col paper-texture">
	<!-- Decorative top bar -->
	<div class="ink-stroke w-full"></div>

	{#if connectionState === 'idle' || connectionState === 'error'}
		<!-- Setup Screen -->
		<div class="flex-1 flex flex-col">
			<!-- Header -->
			<header class="text-center py-12 px-4">
				<p class="text-primary font-medium mb-3 viet-text tracking-wide animate-fade-in">
					Luyện nói tiếng Việt
				</p>
				<h1 class="text-4xl md:text-5xl text-foreground mb-3 tracking-tight">
					Voice Practice
				</h1>
				<p class="text-muted-foreground text-lg font-light max-w-md mx-auto">
					Speak naturally with your AI tutor. Real conversation, gentle corrections.
				</p>
				<div class="ink-stroke max-w-xs mx-auto mt-6"></div>

				<!-- Usage Bar -->
				<div class="mt-6 max-w-md mx-auto bg-card rounded-xl p-4 shadow-sm border border-border">
					{#if isLoadingUsage}
						<div class="flex items-center justify-center py-2">
							<Loader2 class="w-5 h-5 text-muted-foreground animate-spin" />
							<span class="ml-2 text-sm text-muted-foreground">Loading usage...</span>
						</div>
					{:else}
						<UsageBar
							plan={usageStatus.plan}
							minutesUsed={usageStatus.minutesUsed}
							minutesLimit={usageStatus.minutesLimit}
							minutesRemaining={usageStatus.minutesRemaining}
							percentUsed={usageStatus.percentUsed}
						/>
					{/if}
				</div>

				<!-- Usage Warning -->
				{#if !isLoadingUsage && usageStatus.minutesRemaining <= 5}
					<div class="mt-4 max-w-md mx-auto">
						<UsageWarning
							minutesRemaining={usageStatus.minutesRemaining}
							showUpgradeLink={true}
						/>
					</div>
				{/if}
			</header>

			<!-- Settings -->
			<div class="flex-1 flex items-start justify-center px-4 pb-12">
				<div class="w-full max-w-2xl space-y-10">
					<!-- Topic Selection -->
					<section class="animate-slide-up" style="animation-delay: 100ms;">
						<h2 class="text-xl mb-5 text-foreground flex items-center gap-2">
							<BookOpen class="w-5 h-5 text-primary" />
							<span>Choose a Topic</span>
						</h2>
						<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
							{#each topics as topic}
								<button
									class="topic-card text-left group relative overflow-hidden {selectedTopic === topic.value ? 'selected' : ''}"
									onclick={() => (selectedTopic = topic.value)}
								>
									<span class="text-2xl mb-2 block">{topic.icon}</span>
									<span class="block text-sm font-medium text-foreground viet-text">
										{topic.label}
									</span>
									<span class="block text-xs text-muted-foreground mt-0.5">
										{topic.labelEn}
									</span>
									{#if selectedTopic === topic.value}
										<div class="absolute inset-0 bg-primary/5 pointer-events-none"></div>
									{/if}
								</button>
							{/each}
						</div>
					</section>

					<!-- Difficulty Selection -->
					<section class="animate-slide-up" style="animation-delay: 200ms;">
						<h2 class="text-xl mb-5 text-foreground flex items-center gap-2">
							<Sparkles class="w-5 h-5 text-primary" />
							<span>Select Your Level</span>
						</h2>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							{#each difficulties as diff}
								<button
									class="topic-card text-left {selectedDifficulty === diff.value ? 'selected' : ''}"
									onclick={() => (selectedDifficulty = diff.value)}
								>
									<div class="flex items-center gap-2 mb-2">
										<span class="difficulty-badge {diff.value}">
											{diff.label}
										</span>
									</div>
									<span class="block text-sm font-medium text-foreground">
										{diff.labelEn}
									</span>
									<span class="block text-xs text-muted-foreground mt-1">
										{diff.desc}
									</span>
								</button>
							{/each}
						</div>
					</section>

					<!-- Mode Selection -->
					<section class="animate-slide-up" style="animation-delay: 300ms;">
						<h2 class="text-xl mb-5 text-foreground flex items-center gap-2">
							<GraduationCap class="w-5 h-5 text-primary" />
							<span>Choose Practice Mode</span>
						</h2>
						<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
							{#each modes as mode}
								<button
									class="mode-card text-left {selectedMode === mode.value ? 'selected' : ''}"
									onclick={() => (selectedMode = mode.value)}
								>
									<div class="flex items-start gap-4">
										<div class="mode-icon {mode.value}">
											{#if mode.value === 'free'}
												<MessageCircle class="w-6 h-6" />
											{:else}
												<GraduationCap class="w-6 h-6" />
											{/if}
										</div>
										<div class="flex-1">
											<div class="flex items-center gap-2 mb-1">
												<span class="text-base font-medium text-foreground">
													{mode.labelEn}
												</span>
											</div>
											<span class="block text-sm viet-text text-primary mb-1">
												{mode.label}
											</span>
											<span class="block text-xs text-muted-foreground">
												{mode.descEn}
											</span>
										</div>
									</div>
								</button>
							{/each}
						</div>
					</section>

					<!-- Error Message -->
					{#if errorMessage}
						<div class="bg-destructive/10 border border-destructive/20 rounded-xl p-4 text-destructive text-sm animate-fade-in">
							<strong>Error:</strong> {errorMessage}
						</div>
					{/if}

					<!-- Start Button -->
					<div class="text-center pt-4 animate-slide-up" style="animation-delay: 400ms;">
						<button
							onclick={() => startSession()}
							disabled={!canStartSession}
							class="group inline-flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:hover:translate-y-0"
						>
							{#if !canStartSession}
								<Lock class="w-6 h-6" />
								<span>No Credits</span>
								<span class="text-primary-foreground/70 text-base">Upgrade Plan</span>
							{:else}
								<Mic class="w-6 h-6 transition-transform group-hover:scale-110" />
								<span class="viet-text">Bắt đầu nói</span>
								<span class="text-primary-foreground/70 text-base">Start Speaking</span>
							{/if}
						</button>
						{#if canStartSession}
							<p class="text-xs text-muted-foreground mt-4">
								Requires microphone access - {usageStatus.minutesRemaining} minutes remaining
							</p>
						{:else}
							<a
								href="/pricing"
								class="inline-block mt-4 text-sm text-primary hover:underline"
							>
								View pricing plans
							</a>
						{/if}
					</div>
				</div>
			</div>
		</div>

	{:else if connectionState === 'connecting'}
		<!-- Connecting State -->
		<div class="flex-1 flex items-center justify-center">
			<div class="text-center animate-fade-in">
				<div class="voice-orb connecting mx-auto mb-8">
					<div class="orb-inner"></div>
					<div class="orb-ring"></div>
					<div class="orb-ring delay-1"></div>
					<div class="orb-ring delay-2"></div>
				</div>
				<h2 class="text-2xl text-foreground mb-2">Đang kết nối...</h2>
				<p class="text-muted-foreground">Connecting to your tutor</p>
			</div>
		</div>

	{:else if connectionState === 'disconnected' && conversationHistory.length > 0 && !showSummaryModal}
		<!-- Disconnected State (mid-session) - offer reconnect -->
		<div class="flex-1 flex items-center justify-center px-4">
			<div class="text-center animate-fade-in max-w-md">
				<div class="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-500/10 flex items-center justify-center">
					<PhoneOff class="w-10 h-10 text-amber-500" />
				</div>
				<h2 class="text-2xl text-foreground mb-2">Kết nối bị gián đoạn</h2>
				<p class="text-muted-foreground mb-2">Connection interrupted</p>
				{#if disconnectReason}
					<p class="text-sm text-muted-foreground/70 mb-6 bg-muted/50 rounded-lg px-3 py-2">
						{disconnectReason}
					</p>
				{/if}
				<div class="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
					<button
						onclick={() => startSession()}
						disabled={!canStartSession}
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<RefreshCw class="w-5 h-5" />
						<span>Reconnect</span>
					</button>
					<button
						onclick={() => startSession('openai')}
						disabled={!canStartSession}
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Zap class="w-5 h-5" />
						<span>Try OpenAI</span>
					</button>
					<button
						onclick={() => {
							if (selectedMode === 'coach' && sessionTranscript.length > 0) {
								showSummaryModal = true;
								extractCorrections();
							} else {
								resetSession();
							}
						}}
						class="inline-flex items-center justify-center gap-2 px-6 py-3 bg-muted text-muted-foreground rounded-xl hover:bg-muted/80 transition-all"
					>
						<X class="w-5 h-5" />
						<span>End Session</span>
					</button>
				</div>
				{#if conversationHistory.length > 0}
					<p class="text-xs text-muted-foreground mt-4">
						{conversationHistory.length} messages in this session
					</p>
				{/if}
			</div>
		</div>

	{:else if connectionState === 'connected' || (connectionState === 'disconnected' && showSummaryModal)}
		<!-- Active Voice Session -->
		<div class="flex-1 flex flex-col min-h-0 overflow-hidden">
			<!-- Session Header -->
			<div class="flex items-center justify-between px-4 py-3 border-b border-border/50">
				<div class="flex items-center gap-3">
					<span class="mode-badge {selectedMode}">
						{#if selectedMode === 'free'}
							<MessageCircle class="w-3 h-3" />
						{:else}
							<GraduationCap class="w-3 h-3" />
						{/if}
						{modes.find(m => m.value === selectedMode)?.labelEn}
					</span>
					<span class="text-sm text-muted-foreground viet-text">
						{topics.find(t => t.value === selectedTopic)?.label}
					</span>
					<!-- Provider badge -->
					{#if activeProvider}
						<span class="provider-badge {activeProvider}">
							{#if activeProvider === 'gemini'}
								Gemini
							{:else}
								OpenAI
							{/if}
							{#if showFallbackNotice}
								<span class="text-xs opacity-70">(fallback)</span>
							{/if}
						</span>
					{/if}
				</div>
				<div class="flex items-center gap-3">
					<!-- Usage indicator during session -->
					<span class="text-xs text-muted-foreground">
						{usageStatus.minutesRemaining} min left
					</span>
					<button
						onclick={switchMode}
						disabled={isSwitchingMode}
						class="switch-mode-btn"
						title="Switch to {selectedMode === 'free' ? 'Coach Mode' : 'Free Chat'}"
					>
						<RefreshCw class="w-4 h-4 {isSwitchingMode ? 'animate-spin' : ''}" />
						<span class="text-xs">Switch Mode</span>
					</button>
					<div class="flex items-center gap-2">
						<div class="w-2 h-2 rounded-full bg-jade animate-pulse"></div>
						<span class="text-xs text-muted-foreground">Live</span>
					</div>
				</div>
			</div>

			<!-- Fallback Notice Banner -->
			{#if showFallbackNotice}
				<div class="fallback-notice">
					<span class="text-amber-600">Warning:</span>
					<span>Using OpenAI as fallback. Reason: {fallbackReason}</span>
					<button
						onclick={() => showFallbackNotice = false}
						class="ml-auto text-amber-600 hover:text-amber-800"
					>
						x
					</button>
				</div>
			{/if}

			<!-- Low Credit Warning Banner -->
			{#if showLowCreditWarning}
				<div class="credit-warning">
					<span>Warning:</span>
					<span>Low on credits! Only {usageStatus.minutesRemaining} minutes remaining.</span>
					<button
						onclick={() => showLowCreditWarning = false}
						class="ml-auto text-amber-600 hover:text-amber-800"
					>
						x
					</button>
				</div>
			{/if}

			<!-- Session Warning Banner (Gemini 15-min limit) -->
			{#if showSessionWarning}
				<div class="session-warning">
					<span>Timer:</span>
					<span>Session ending in {sessionWarningSeconds}s</span>
					<button
						onclick={extendSession}
						class="btn-small"
					>
						Extend Session
					</button>
				</div>
			{/if}

			<!-- Voice Interface -->
			<div class="flex-1 flex flex-col px-4 py-4 min-h-0">
				<!-- Voice Status Header -->
				<div class="flex items-center justify-center gap-4 py-4 flex-shrink-0">
					<!-- Compact Voice Orb -->
					<div class="voice-orb-mini {isCoachSpeaking ? 'speaking' : 'listening'}">
						<div class="orb-inner-mini">
							{#if isCoachSpeaking}
								<Volume2 class="w-5 h-5 text-primary-foreground" />
							{:else}
								<Mic class="w-5 h-5 text-primary-foreground {isMuted ? 'opacity-30' : ''}" />
							{/if}
						</div>
						{#if isCoachSpeaking}
							<div class="orb-ring-mini"></div>
						{/if}
					</div>

					<!-- Status Text -->
					<div class="text-left">
						{#if isCoachSpeaking}
							<p class="text-sm font-medium text-foreground">
								{selectedMode === 'coach' ? 'Cô Hà đang nói...' : 'Lan đang nói...'}
							</p>
							<p class="text-xs text-muted-foreground">
								{selectedMode === 'coach' ? 'Coach is speaking' : 'Partner is speaking'}
							</p>
						{:else if isMuted}
							<p class="text-sm font-medium text-foreground">Đã tắt mic</p>
							<p class="text-xs text-muted-foreground">Microphone muted</p>
						{:else}
							<p class="text-sm font-medium text-foreground">Đang nghe...</p>
							<p class="text-xs text-muted-foreground">Listening - speak in Vietnamese</p>
						{/if}
					</div>
				</div>

				<!-- Conversation History (scrollable) -->
				<div
					class="flex-1 overflow-y-auto conversation-scroll"
					bind:this={conversationContainer}
				>
					<div class="w-full max-w-xl mx-auto space-y-3 pb-4">
						{#if conversationHistory.length === 0 && !streamingCoachText}
							<div class="text-center py-12 text-muted-foreground">
								<p class="text-sm">Conversation will appear here...</p>
								<p class="text-xs mt-1">Start speaking in Vietnamese</p>
							</div>
						{/if}

						<!-- Past messages -->
						{#each conversationHistory as message, i}
							<div class="transcript-card {message.role === 'user' ? 'user' : 'coach'}" class:animate-slide-up={i === conversationHistory.length - 1}>
								<span class="transcript-label">
									{message.role === 'user' ? 'You' : (selectedMode === 'coach' ? 'Co Ha' : 'Lan')}
								</span>
								<p class="viet-text text-base leading-relaxed">{message.text}</p>
							</div>
						{/each}

						<!-- Streaming user speech (in-progress, not finalized yet) -->
						{#if streamingUserText}
							<div class="transcript-card user streaming animate-slide-up">
								<span class="transcript-label flex items-center gap-2">
									You
									<span class="streaming-indicator"></span>
								</span>
								<p class="viet-text text-base leading-relaxed">{streamingUserText}</p>
							</div>
						{/if}

						<!-- Streaming coach response (in-progress) -->
						{#if streamingCoachText}
							<div class="transcript-card coach streaming animate-slide-up">
								<span class="transcript-label flex items-center gap-2">
									{selectedMode === 'coach' ? 'Co Ha' : 'Lan'}
									<span class="streaming-indicator"></span>
								</span>
								<p class="viet-text text-base leading-relaxed">{streamingCoachText}</p>
							</div>
						{/if}
					</div>
				</div>
			</div>

			<!-- Control Bar -->
			<div class="border-t border-border bg-card/50 backdrop-blur-sm">
				<div class="max-w-xl mx-auto px-4 py-5 flex items-center justify-center gap-4">
					<!-- Mute Button -->
					<button
						onclick={toggleMute}
						class="control-btn {isMuted ? 'muted' : ''}"
						aria-label={isMuted ? 'Unmute' : 'Mute'}
					>
						{#if isMuted}
							<MicOff class="w-6 h-6" />
						{:else}
							<Mic class="w-6 h-6" />
						{/if}
					</button>

					<!-- End Call Button -->
					<button
						onclick={endSession}
						class="control-btn end-call"
						aria-label="End session"
					>
						<PhoneOff class="w-6 h-6" />
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Decorative bottom bar -->
	<div class="ink-stroke w-full"></div>
</div>

<!-- Session Summary Modal -->
{#if showSummaryModal}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div class="modal-overlay" onclick={() => closeSummary()} role="dialog" aria-modal="true" tabindex="-1">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<!-- Modal Header -->
			<div class="modal-header">
				<div>
					<h2 class="text-xl font-semibold text-foreground">Tổng kết buổi học</h2>
					<p class="text-sm text-muted-foreground">Session Summary</p>
				</div>
				<button
					onclick={() => closeSummary()}
					class="modal-close-btn"
					aria-label="Close"
				>
					<X class="w-5 h-5" />
				</button>
			</div>

			<!-- Modal Body -->
			<div class="modal-body">
				{#if isExtractingCorrections}
					<div class="text-center py-12">
						<Loader2 class="w-10 h-10 text-primary mx-auto mb-4 animate-spin" />
						<p class="text-foreground">Đang phân tích buổi học...</p>
						<p class="text-sm text-muted-foreground">Analyzing your session</p>
					</div>
				{:else if extractionError}
					<div class="bg-destructive/10 border border-destructive/20 rounded-lg p-4 text-destructive">
						<p class="font-medium">Could not analyze session</p>
						<p class="text-sm mt-1">{extractionError}</p>
					</div>
				{:else if corrections.length === 0}
					<div class="text-center py-12">
						<div class="w-16 h-16 mx-auto mb-4 rounded-full bg-viet-jade/10 flex items-center justify-center">
							<Check class="w-8 h-8 text-viet-jade" />
						</div>
						<p class="text-lg text-foreground">Tuyet voi!</p>
						<p class="text-muted-foreground">No corrections needed this session</p>
					</div>
				{:else}
					<div class="space-y-4">
						<div class="flex items-center justify-between">
							<span class="text-sm font-medium text-muted-foreground">
								{corrections.length} correction{corrections.length !== 1 ? 's' : ''} found
							</span>
							<span class="text-xs text-muted-foreground">
								{topics.find(t => t.value === selectedTopic)?.labelEn}
							</span>
						</div>

						<div class="corrections-list">
							{#each corrections as correction, i}
								<div class="correction-card">
									<div class="correction-number">{i + 1}</div>
									<div class="correction-content">
										<div class="correction-original">
											<span class="correction-label">You said:</span>
											<span class="viet-text">{correction.original}</span>
										</div>
										<div class="correction-fixed">
											<span class="correction-label">Correct:</span>
											<span class="viet-text">{correction.correction}</span>
										</div>
										<p class="correction-explanation">{correction.explanation}</p>
										<span class="correction-category">{correction.category}</span>
									</div>
								</div>
							{/each}
						</div>
					</div>
				{/if}
			</div>

			<!-- Modal Footer -->
			<div class="modal-footer">
				<button
					onclick={() => closeSummary()}
					class="btn-secondary"
				>
					Close
				</button>
				<button
					onclick={() => closeSummary()}
					class="btn-primary"
				>
					<Check class="w-4 h-4" />
					Done
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	/* Animations */
	@keyframes fade-in {
		from { opacity: 0; }
		to { opacity: 1; }
	}

	@keyframes slide-up {
		from {
			opacity: 0;
			transform: translateY(20px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	.animate-fade-in {
		animation: fade-in 0.5s ease-out forwards;
	}

	.animate-slide-up {
		animation: slide-up 0.6s ease-out forwards;
		opacity: 0;
	}

	/* Voice Orb */
	.voice-orb {
		position: relative;
		width: 160px;
		height: 160px;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.orb-inner {
		width: 100px;
		height: 100px;
		border-radius: 50%;
		background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 2;
		box-shadow:
			0 4px 20px hsl(var(--primary) / 0.3),
			inset 0 2px 10px hsl(0 0% 100% / 0.1);
		transition: transform 0.3s ease;
	}

	.voice-orb.connecting .orb-inner {
		animation: orb-spin 2s linear infinite;
		background: linear-gradient(135deg, hsl(var(--muted-foreground)) 0%, hsl(var(--muted)) 100%);
	}

	@keyframes orb-pulse {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.08); }
	}

	@keyframes orb-breathe {
		0%, 100% { transform: scale(1); }
		50% { transform: scale(1.03); }
	}

	@keyframes orb-spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	/* Orb Rings */
	.orb-ring {
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 2px solid hsl(var(--primary) / 0.2);
		animation: ring-expand 2s ease-out infinite;
	}

	.orb-ring.delay-1 { animation-delay: 0.5s; }
	.orb-ring.delay-2 { animation-delay: 1s; }

	.voice-orb.connecting .orb-ring {
		border-color: hsl(var(--muted-foreground) / 0.2);
	}

	@keyframes ring-expand {
		0% {
			transform: scale(0.6);
			opacity: 0.8;
		}
		100% {
			transform: scale(1.5);
			opacity: 0;
		}
	}

	/* Wave effect for speaking */
	.orb-wave {
		position: absolute;
		width: 140%;
		height: 140%;
		border-radius: 50%;
		background: radial-gradient(circle, hsl(var(--primary) / 0.1) 0%, transparent 70%);
		animation: wave-pulse 1s ease-in-out infinite;
	}

	.orb-wave.delay-1 { animation-delay: 0.3s; }

	@keyframes wave-pulse {
		0%, 100% {
			transform: scale(0.8);
			opacity: 0.5;
		}
		50% {
			transform: scale(1.1);
			opacity: 0.2;
		}
	}

	/* Transcript Cards */
	.transcript-card {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 1rem;
		padding: 1rem 1.25rem;
		position: relative;
	}

	.transcript-card.user {
		background: hsl(var(--primary) / 0.05);
		border-color: hsl(var(--primary) / 0.2);
	}

	.transcript-card.coach {
		background: hsl(var(--accent) / 0.05);
		border-color: hsl(var(--accent) / 0.2);
	}

	.transcript-label {
		display: block;
		font-size: 0.75rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		margin-bottom: 0.5rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.transcript-card.user .transcript-label {
		color: hsl(var(--primary));
	}

	.transcript-card.coach .transcript-label {
		color: hsl(var(--accent));
	}

	/* Control Buttons */
	.control-btn {
		width: 56px;
		height: 56px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		color: hsl(var(--foreground));
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.control-btn:hover {
		background: hsl(var(--muted));
		transform: scale(1.05);
	}

	.control-btn.muted {
		background: hsl(var(--destructive) / 0.1);
		border-color: hsl(var(--destructive) / 0.3);
		color: hsl(var(--destructive));
	}

	.control-btn.end-call {
		background: hsl(var(--destructive));
		border-color: hsl(var(--destructive));
		color: white;
		width: 64px;
		height: 64px;
	}

	.control-btn.end-call:hover {
		background: hsl(var(--destructive) / 0.9);
		transform: scale(1.05);
	}

	/* Jade accent */
	.bg-jade {
		background-color: hsl(var(--viet-jade));
	}

	/* Mode Cards */
	.mode-card {
		background: hsl(var(--card));
		border: 2px solid hsl(var(--border));
		border-radius: 1rem;
		padding: 1.25rem;
		transition: all 0.2s ease;
		cursor: pointer;
	}

	.mode-card:hover {
		border-color: hsl(var(--primary) / 0.3);
		background: hsl(var(--primary) / 0.02);
	}

	.mode-card.selected {
		border-color: hsl(var(--primary));
		background: hsl(var(--primary) / 0.05);
	}

	.mode-icon {
		width: 44px;
		height: 44px;
		border-radius: 12px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.mode-icon.free {
		background: hsl(var(--viet-jade) / 0.15);
		color: hsl(var(--viet-jade));
	}

	.mode-icon.coach {
		background: hsl(var(--primary) / 0.15);
		color: hsl(var(--primary));
	}

	/* Mode Badge */
	.mode-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.75rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.mode-badge.free {
		background: hsl(var(--viet-jade) / 0.15);
		color: hsl(var(--viet-jade));
	}

	.mode-badge.coach {
		background: hsl(var(--primary) / 0.15);
		color: hsl(var(--primary));
	}

	/* Switch Mode Button */
	.switch-mode-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 0.5rem;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		font-size: 0.75rem;
		transition: all 0.2s ease;
		cursor: pointer;
		border: 1px solid hsl(var(--border));
	}

	.switch-mode-btn:hover:not(:disabled) {
		background: hsl(var(--card));
		color: hsl(var(--foreground));
		border-color: hsl(var(--primary) / 0.3);
	}

	.switch-mode-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	/* Modal Styles */
	.modal-overlay {
		position: fixed;
		inset: 0;
		background: rgba(0, 0, 0, 0.6);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 50;
		padding: 1rem;
		animation: fade-in 0.2s ease-out;
	}

	.modal-content {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 1.25rem;
		width: 100%;
		max-width: 32rem;
		max-height: 85vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
		animation: slide-up 0.3s ease-out;
	}

	.modal-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		padding: 1.25rem 1.5rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.modal-close-btn {
		padding: 0.5rem;
		border-radius: 0.5rem;
		color: hsl(var(--muted-foreground));
		transition: all 0.2s ease;
	}

	.modal-close-btn:hover {
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.modal-body {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
		padding: 1rem 1.5rem;
		border-top: 1px solid hsl(var(--border));
	}

	/* Buttons */
	.btn-primary {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.625rem 1.25rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.btn-primary:hover {
		background: hsl(var(--primary) / 0.9);
	}

	.btn-secondary {
		padding: 0.625rem 1.25rem;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border-radius: 0.75rem;
		font-size: 0.875rem;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.btn-secondary:hover {
		background: hsl(var(--muted) / 0.8);
		color: hsl(var(--foreground));
	}

	/* Corrections List */
	.corrections-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.correction-card {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		background: hsl(var(--muted) / 0.3);
		border-radius: 0.75rem;
		border: 1px solid hsl(var(--border));
	}

	.correction-number {
		width: 1.75rem;
		height: 1.75rem;
		border-radius: 50%;
		background: hsl(var(--primary) / 0.1);
		color: hsl(var(--primary));
		display: flex;
		align-items: center;
		justify-content: center;
		font-size: 0.75rem;
		font-weight: 600;
		flex-shrink: 0;
	}

	.correction-content {
		flex: 1;
		min-width: 0;
	}

	.correction-original,
	.correction-fixed {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin-bottom: 0.5rem;
	}

	.correction-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		min-width: 4.5rem;
	}

	.correction-original .viet-text {
		color: hsl(var(--destructive));
		text-decoration: line-through;
		text-decoration-color: hsl(var(--destructive) / 0.5);
	}

	.correction-fixed .viet-text {
		color: hsl(var(--viet-jade));
		font-weight: 500;
	}

	.correction-explanation {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.5rem;
		line-height: 1.5;
	}

	.correction-category {
		display: inline-block;
		margin-top: 0.5rem;
		padding: 0.125rem 0.5rem;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border-radius: 999px;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.text-viet-jade {
		color: hsl(var(--viet-jade));
	}

	.bg-viet-jade\/10 {
		background: hsl(var(--viet-jade) / 0.1);
	}

	/* Mini Voice Orb for conversation view */
	.voice-orb-mini {
		position: relative;
		width: 44px;
		height: 44px;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.orb-inner-mini {
		width: 36px;
		height: 36px;
		border-radius: 50%;
		background: linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.8) 100%);
		display: flex;
		align-items: center;
		justify-content: center;
		position: relative;
		z-index: 2;
		box-shadow: 0 2px 10px hsl(var(--primary) / 0.3);
	}

	.voice-orb-mini.speaking .orb-inner-mini {
		animation: orb-pulse 1.5s ease-in-out infinite;
	}

	.voice-orb-mini.listening .orb-inner-mini {
		animation: orb-breathe 3s ease-in-out infinite;
	}

	.orb-ring-mini {
		position: absolute;
		width: 100%;
		height: 100%;
		border-radius: 50%;
		border: 2px solid hsl(var(--primary) / 0.3);
		animation: ring-expand 1.5s ease-out infinite;
	}

	/* Conversation scroll container */
	.conversation-scroll {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--border)) transparent;
	}

	.conversation-scroll::-webkit-scrollbar {
		width: 6px;
	}

	.conversation-scroll::-webkit-scrollbar-track {
		background: transparent;
	}

	.conversation-scroll::-webkit-scrollbar-thumb {
		background: hsl(var(--border));
		border-radius: 3px;
	}

	.conversation-scroll::-webkit-scrollbar-thumb:hover {
		background: hsl(var(--muted-foreground));
	}

	/* Streaming indicator */
	.streaming-indicator {
		display: inline-block;
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: hsl(var(--primary));
		animation: streaming-pulse 1s ease-in-out infinite;
	}

	@keyframes streaming-pulse {
		0%, 100% {
			opacity: 0.4;
			transform: scale(0.8);
		}
		50% {
			opacity: 1;
			transform: scale(1.2);
		}
	}

	/* Streaming card variant */
	.transcript-card.streaming {
		border-style: dashed;
		background: hsl(var(--accent) / 0.03);
	}

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

	/* Credit Warning */
	.credit-warning {
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
		cursor: pointer;
		transition: background 0.2s ease;
	}

	.btn-small:hover {
		background: hsl(var(--primary) / 0.9);
	}
</style>
