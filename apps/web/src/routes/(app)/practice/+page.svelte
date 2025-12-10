<script lang="ts">
	import { onDestroy } from 'svelte';
	import { Mic, MicOff, Phone, PhoneOff, BookOpen, Sparkles, Volume2, VolumeX, MessageCircle, GraduationCap, RefreshCw, X, Check, Loader2, Save } from 'lucide-svelte';
	import {
		RealtimeClient,
		createFreeConversationConfig,
		createCoachModeConfig,
		type PracticeMode,
		type ModeOptions
	} from '$lib/voice/RealtimeClient';

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
	let userTranscript = $state('');
	let coachTranscript = $state('');
	let isCoachSpeaking = $state(false);
	let isMuted = $state(false);
	let errorMessage = $state('');
	let isSwitchingMode = $state(false);

	// Transcript collection for session summary
	let sessionTranscript = $state<TranscriptMessage[]>([]);
	let sessionId = $state<string>('');
	let showSummaryModal = $state(false);
	let corrections = $state<CorrectionRecord[]>([]);
	let isExtractingCorrections = $state(false);
	let extractionError = $state('');

	// Client instance
	let client: RealtimeClient | null = null;

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

	// Connect to voice session
	async function startSession() {
		connectionState = 'connecting';
		errorMessage = '';
		userTranscript = '';
		coachTranscript = '';
		sessionTranscript = [];
		sessionId = crypto.randomUUID();

		try {
			const config = getConfigForMode(selectedMode);

			client = new RealtimeClient({
				onUserTranscript: (text) => {
					userTranscript = text;
					// Add to transcript collection (final transcripts only, when text is complete)
					if (text.trim()) {
						sessionTranscript = [...sessionTranscript, {
							role: 'user',
							text: text.trim(),
							timestamp: Date.now()
						}];
					}
				},
				onCoachResponse: (text, isFinal) => {
					coachTranscript = text;
					// Add to transcript collection when final
					if (isFinal && text.trim()) {
						sessionTranscript = [...sessionTranscript, {
							role: 'coach',
							text: text.trim(),
							timestamp: Date.now()
						}];
					}
				},
				onCoachAudioStart: () => {
					isCoachSpeaking = true;
				},
				onCoachAudioEnd: () => {
					isCoachSpeaking = false;
				},
				onConnectionStateChange: (state) => {
					if (state === 'connected') {
						connectionState = 'connected';
					} else if (state === 'disconnected') {
						connectionState = 'disconnected';
					} else if (state === 'error') {
						connectionState = 'error';
					}
				},
				onError: (error) => {
					errorMessage = error.message;
					connectionState = 'error';
				}
			});

			await client.connect(config);
		} catch (err) {
			errorMessage = err instanceof Error ? err.message : 'Failed to connect';
			connectionState = 'error';
		}
	}

	// End session
	async function endSession() {
		client?.disconnect();
		client = null;

		// Show summary modal if in Coach Mode and we have transcript
		if (selectedMode === 'coach' && sessionTranscript.length > 0) {
			showSummaryModal = true;
			connectionState = 'disconnected';
			await extractCorrections();
		} else {
			resetSession();
		}
	}

	// Extract corrections from transcript using AI
	async function extractCorrections() {
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
		} catch (err) {
			extractionError = err instanceof Error ? err.message : 'Failed to analyze session';
		} finally {
			isExtractingCorrections = false;
		}
	}

	// Save corrections to localStorage
	function saveCorrections() {
		if (corrections.length === 0) return;

		const savedCorrections = JSON.parse(localStorage.getItem('speakphoreal_corrections') || '[]');
		const newEntry = {
			sessionId,
			date: new Date().toISOString(),
			topic: topics.find(t => t.value === selectedTopic)?.labelEn || selectedTopic,
			difficulty: selectedDifficulty,
			corrections
		};
		savedCorrections.push(newEntry);
		localStorage.setItem('speakphoreal_corrections', JSON.stringify(savedCorrections));
	}

	// Reset session state
	function resetSession() {
		connectionState = 'idle';
		userTranscript = '';
		coachTranscript = '';
		isCoachSpeaking = false;
		isMuted = false;
		showSummaryModal = false;
		corrections = [];
		extractionError = '';
	}

	// Close summary modal and reset
	function closeSummary(save = false) {
		if (save && corrections.length > 0) {
			saveCorrections();
		}
		showSummaryModal = false;
		resetSession();
	}

	// Toggle mute
	function toggleMute() {
		if (client) {
			isMuted = !isMuted;
			client.setMuted(isMuted);
		}
	}

	// Switch mode mid-session
	async function switchMode() {
		if (!client || isSwitchingMode) return;

		isSwitchingMode = true;
		const newMode: PracticeMode = selectedMode === 'free' ? 'coach' : 'free';
		const newConfig = getConfigForMode(newMode);

		try {
			client.updateSessionConfig({ instructions: newConfig.instructions });
			selectedMode = newMode;
		} catch (err) {
			errorMessage = 'Failed to switch mode';
		} finally {
			isSwitchingMode = false;
		}
	}

	// Cleanup on destroy
	onDestroy(() => {
		client?.disconnect();
	});
</script>

<svelte:head>
	<title>Practice Vietnamese | Speak Phở Real</title>
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
							onclick={startSession}
							class="group inline-flex items-center gap-3 px-10 py-4 bg-primary text-primary-foreground rounded-2xl hover:bg-primary/90 transition-all duration-300 shadow-lg hover:shadow-xl hover:-translate-y-0.5 text-lg"
						>
							<Mic class="w-6 h-6 transition-transform group-hover:scale-110" />
							<span class="viet-text">Bắt đầu nói</span>
							<span class="text-primary-foreground/70 text-base">Start Speaking</span>
						</button>
						<p class="text-xs text-muted-foreground mt-4">
							Requires microphone access • Speak in Vietnamese
						</p>
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

	{:else}
		<!-- Active Voice Session -->
		<div class="flex-1 flex flex-col">
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
				</div>
				<div class="flex items-center gap-3">
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

			<!-- Voice Interface -->
			<div class="flex-1 flex flex-col items-center justify-center px-4 py-8">
				<!-- Main Voice Orb -->
				<div class="voice-orb {isCoachSpeaking ? 'speaking' : 'listening'} mb-10">
					<div class="orb-inner">
						{#if isCoachSpeaking}
							<Volume2 class="w-12 h-12 text-primary-foreground" />
						{:else}
							<Mic class="w-12 h-12 text-primary-foreground {isMuted ? 'opacity-30' : ''}" />
						{/if}
					</div>
					<div class="orb-ring"></div>
					<div class="orb-ring delay-1"></div>
					<div class="orb-ring delay-2"></div>
					{#if isCoachSpeaking}
						<div class="orb-wave"></div>
						<div class="orb-wave delay-1"></div>
					{/if}
				</div>

				<!-- Status Text -->
				<div class="text-center mb-8">
					{#if isCoachSpeaking}
						<p class="text-lg text-foreground mb-1">
							{selectedMode === 'coach' ? 'Cô Hà đang nói...' : 'Lan đang nói...'}
						</p>
						<p class="text-sm text-muted-foreground">
							{selectedMode === 'coach' ? 'Coach is speaking' : 'Partner is speaking'}
						</p>
					{:else if isMuted}
						<p class="text-lg text-foreground mb-1">Đã tắt mic</p>
						<p class="text-sm text-muted-foreground">Microphone muted</p>
					{:else}
						<p class="text-lg text-foreground mb-1">Đang nghe...</p>
						<p class="text-sm text-muted-foreground">Listening — speak in Vietnamese</p>
					{/if}
				</div>

				<!-- Transcript Cards -->
				<div class="w-full max-w-xl space-y-4">
					<!-- User Transcript -->
					{#if userTranscript}
						<div class="transcript-card user animate-slide-up">
							<span class="transcript-label">You said</span>
							<p class="viet-text text-base leading-relaxed">{userTranscript}</p>
						</div>
					{/if}

					<!-- Coach Transcript -->
					{#if coachTranscript}
						<div class="transcript-card coach animate-slide-up">
							<span class="transcript-label">{selectedMode === 'coach' ? 'Cô Hà' : 'Lan'}</span>
							<p class="viet-text text-base leading-relaxed">{coachTranscript}</p>
						</div>
					{/if}
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
	<div class="modal-overlay" onclick={() => closeSummary(false)}>
		<div class="modal-content" onclick={(e) => e.stopPropagation()}>
			<!-- Modal Header -->
			<div class="modal-header">
				<div>
					<h2 class="text-xl font-semibold text-foreground">Tổng kết buổi học</h2>
					<p class="text-sm text-muted-foreground">Session Summary</p>
				</div>
				<button
					onclick={() => closeSummary(false)}
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
						<p class="text-lg text-foreground">Tuyệt vời!</p>
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
					onclick={() => closeSummary(false)}
					class="btn-secondary"
				>
					Skip
				</button>
				{#if corrections.length > 0}
					<button
						onclick={() => closeSummary(true)}
						class="btn-primary"
					>
						<Save class="w-4 h-4" />
						Save for Review
					</button>
				{:else}
					<button
						onclick={() => closeSummary(false)}
						class="btn-primary"
					>
						Done
					</button>
				{/if}
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

	.voice-orb.speaking .orb-inner {
		animation: orb-pulse 1.5s ease-in-out infinite;
	}

	.voice-orb.listening .orb-inner {
		animation: orb-breathe 3s ease-in-out infinite;
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
</style>
