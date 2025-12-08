<script lang="ts">
	import { onMount } from 'svelte';
	import { Send, Loader2, BookOpen, Sparkles } from 'lucide-svelte';

	// Types
	type Message = {
		id: string;
		role: 'user' | 'assistant';
		content: string;
		timestamp: Date;
	};

	type Topic = {
		value: string;
		label: string;
		labelEn: string;
	};

	type Difficulty = 'beginner' | 'intermediate' | 'advanced';

	// State
	let messages = $state<Message[]>([]);
	let inputValue = $state('');
	let isLoading = $state(false);
	let selectedTopic = $state('general');
	let selectedDifficulty = $state<Difficulty>('intermediate');
	let showSettings = $state(true);
	let chatContainer: HTMLElement;

	// API base URL - will be configured for production
	const API_BASE = 'http://localhost:8791';

	// Available topics
	const topics: Topic[] = [
		{ value: 'general', label: 'Trò chuyện chung', labelEn: 'General conversation' },
		{ value: 'food', label: 'Đồ ăn và nhà hàng', labelEn: 'Food and restaurants' },
		{ value: 'travel', label: 'Du lịch Việt Nam', labelEn: 'Travel in Vietnam' },
		{ value: 'family', label: 'Gia đình và mối quan hệ', labelEn: 'Family and relationships' },
		{ value: 'work', label: 'Công việc và sự nghiệp', labelEn: 'Work and career' },
		{ value: 'hobbies', label: 'Sở thích', labelEn: 'Hobbies and interests' },
		{ value: 'shopping', label: 'Mua sắm', labelEn: 'Shopping' },
		{ value: 'culture', label: 'Văn hóa Việt Nam', labelEn: 'Vietnamese culture' }
	];

	const difficulties: { value: Difficulty; label: string; description: string }[] = [
		{ value: 'beginner', label: 'Người mới', description: 'Simple vocabulary, translations provided' },
		{ value: 'intermediate', label: 'Trung cấp', description: 'Mixed complexity, occasional English' },
		{ value: 'advanced', label: 'Nâng cao', description: 'Natural speech, idioms, cultural depth' }
	];

	// Send message to API
	async function sendMessage() {
		if (!inputValue.trim() || isLoading) return;

		const userMessage: Message = {
			id: crypto.randomUUID(),
			role: 'user',
			content: inputValue.trim(),
			timestamp: new Date()
		};

		messages = [...messages, userMessage];
		const messageToSend = inputValue.trim();
		inputValue = '';
		isLoading = true;
		showSettings = false;

		// Scroll to bottom
		setTimeout(() => {
			if (chatContainer) {
				chatContainer.scrollTop = chatContainer.scrollHeight;
			}
		}, 50);

		try {
			const conversationHistory = messages.slice(0, -1).map((m) => ({
				role: m.role,
				content: m.content
			}));

			const response = await fetch(`${API_BASE}/trpc/coach.chat`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					message: messageToSend,
					conversationHistory,
					difficulty: selectedDifficulty,
					topic: selectedTopic
				})
			});

			const data = await response.json();

			if (!response.ok || data.error) {
				console.error('API Error:', data.error);
				throw new Error(data.error?.message || 'Failed to get response');
			}

			const assistantMessage: Message = {
				id: crypto.randomUUID(),
				role: 'assistant',
				content: data.result.data.response,
				timestamp: new Date()
			};

			messages = [...messages, assistantMessage];
		} catch (error) {
			console.error('Error sending message:', error);
			const errorMessage = error instanceof Error ? error.message : 'Unknown error';
			// Add error message
			messages = [
				...messages,
				{
					id: crypto.randomUUID(),
					role: 'assistant',
					content: `Xin lỗi, có lỗi xảy ra: ${errorMessage.includes('authentication') ? 'API key chưa được cấu hình. (API key not configured)' : 'Vui lòng thử lại. (Please try again.)'}`,
					timestamp: new Date()
				}
			];
		} finally {
			isLoading = false;
			setTimeout(() => {
				if (chatContainer) {
					chatContainer.scrollTop = chatContainer.scrollHeight;
				}
			}, 50);
		}
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	function startConversation() {
		showSettings = false;
		// Send an initial greeting to start the conversation
		inputValue = 'Xin chào!';
		sendMessage();
	}
</script>

<svelte:head>
	<title>Practice Vietnamese | Viet Coach</title>
</svelte:head>

<div class="min-h-[calc(100vh-3.5rem)] flex flex-col paper-texture">
	<!-- Decorative header bar -->
	<div class="ink-stroke w-full"></div>

	<div class="flex-1 flex flex-col max-w-4xl mx-auto w-full px-4 py-6">
		<!-- Header -->
		<header class="text-center mb-8">
			<h1 class="text-4xl md:text-5xl text-foreground mb-2 tracking-tight">
				Luyện Tập Tiếng Việt
			</h1>
			<p class="text-muted-foreground text-lg font-light">
				Practice Vietnamese Conversation
			</p>
			<div class="ink-stroke max-w-xs mx-auto mt-4"></div>
		</header>

		{#if showSettings && messages.length === 0}
			<!-- Settings Panel - shown before conversation starts -->
			<div class="flex-1 flex items-center justify-center">
				<div class="w-full max-w-2xl space-y-8 animate-in fade-in duration-500">
					<!-- Topic Selection -->
					<section>
						<h2 class="text-2xl mb-4 text-foreground flex items-center gap-2">
							<BookOpen class="w-5 h-5 text-primary" />
							<span>Choose a Topic</span>
						</h2>
						<div class="grid grid-cols-2 md:grid-cols-4 gap-3">
							{#each topics as topic}
								<button
									class="topic-card text-left group {selectedTopic === topic.value ? 'selected' : ''}"
									onclick={() => (selectedTopic = topic.value)}
								>
									<span class="block text-sm font-medium text-foreground viet-text">
										{topic.label}
									</span>
									<span class="block text-xs text-muted-foreground mt-1">
										{topic.labelEn}
									</span>
								</button>
							{/each}
						</div>
					</section>

					<!-- Difficulty Selection -->
					<section>
						<h2 class="text-2xl mb-4 text-foreground flex items-center gap-2">
							<Sparkles class="w-5 h-5 text-primary" />
							<span>Select Your Level</span>
						</h2>
						<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
							{#each difficulties as diff}
								<button
									class="topic-card text-left {selectedDifficulty === diff.value ? 'selected' : ''}"
									onclick={() => (selectedDifficulty = diff.value)}
								>
									<span class="difficulty-badge {diff.value} mb-2">
										{diff.label}
									</span>
									<span class="block text-sm text-muted-foreground">
										{diff.description}
									</span>
								</button>
							{/each}
						</div>
					</section>

					<!-- Start Button -->
					<div class="text-center pt-4">
						<button
							onclick={startConversation}
							class="inline-flex items-center gap-2 px-8 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-all duration-200 shadow-sm hover:shadow-md text-lg"
						>
							<span>Bắt đầu</span>
							<span class="text-primary-foreground/80">Start Practice</span>
						</button>
					</div>
				</div>
			</div>
		{:else}
			<!-- Chat Interface -->
			<div class="flex-1 flex flex-col min-h-0">
				<!-- Conversation Info Bar -->
				<div class="flex items-center justify-between mb-4 px-2">
					<div class="flex items-center gap-3">
						<span class="difficulty-badge {selectedDifficulty}">
							{difficulties.find((d) => d.value === selectedDifficulty)?.label}
						</span>
						<span class="text-sm text-muted-foreground">
							{topics.find((t) => t.value === selectedTopic)?.label}
						</span>
					</div>
					<button
						onclick={() => {
							messages = [];
							showSettings = true;
						}}
						class="text-sm text-muted-foreground hover:text-foreground transition-colors"
					>
						New Session
					</button>
				</div>

				<!-- Messages Container -->
				<div
					bind:this={chatContainer}
					class="flex-1 overflow-y-auto space-y-4 pb-4 scroll-smooth"
				>
					{#each messages as message, i}
						<div
							class="flex {message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in slide-in-from-bottom-2 duration-300"
							style="animation-delay: {i * 50}ms"
						>
							<div
								class="max-w-[85%] md:max-w-[75%] px-4 py-3 {message.role === 'user'
									? 'chat-bubble-user'
									: 'chat-bubble-assistant'}"
							>
								<p class="viet-text text-base leading-relaxed whitespace-pre-wrap">
									{message.content}
								</p>
							</div>
						</div>
					{/each}

					{#if isLoading}
						<div class="flex justify-start animate-in fade-in duration-200">
							<div class="chat-bubble-assistant px-4 py-3">
								<div class="flex items-center gap-2 text-muted-foreground">
									<Loader2 class="w-4 h-4 animate-spin" />
									<span class="text-sm">Đang suy nghĩ...</span>
								</div>
							</div>
						</div>
					{/if}
				</div>

				<!-- Input Area -->
				<div class="pt-4 border-t border-border">
					<form onsubmit={(e) => { e.preventDefault(); sendMessage(); }} class="flex gap-3">
						<div class="flex-1 relative">
							<textarea
								bind:value={inputValue}
								onkeydown={handleKeydown}
								placeholder="Viết tin nhắn của bạn... (Write your message...)"
								rows="1"
								class="w-full px-4 py-3 bg-card border border-border rounded-xl resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all duration-200 viet-text"
								disabled={isLoading}
							></textarea>
						</div>
						<button
							type="submit"
							disabled={!inputValue.trim() || isLoading}
							class="px-4 py-3 bg-primary text-primary-foreground rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 shadow-sm hover:shadow-md"
						>
							<Send class="w-5 h-5" />
						</button>
					</form>
					<p class="text-xs text-muted-foreground text-center mt-3">
						Press Enter to send • Shift+Enter for new line
					</p>
				</div>
			</div>
		{/if}
	</div>

	<!-- Bottom decorative bar -->
	<div class="ink-stroke w-full mt-auto"></div>
</div>

<style>
	/* Smooth scrollbar styling */
	:global(.overflow-y-auto) {
		scrollbar-width: thin;
		scrollbar-color: hsl(var(--border)) transparent;
	}

	:global(.overflow-y-auto::-webkit-scrollbar) {
		width: 6px;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-track) {
		background: transparent;
	}

	:global(.overflow-y-auto::-webkit-scrollbar-thumb) {
		background-color: hsl(var(--border));
		border-radius: 3px;
	}

	/* Animate in utilities */
	.animate-in {
		animation: animateIn 0.3s ease-out forwards;
	}

	.fade-in {
		animation-name: fadeIn;
	}

	.slide-in-from-bottom-2 {
		animation-name: slideInFromBottom;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
		}
		to {
			opacity: 1;
		}
	}

	@keyframes slideInFromBottom {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* Textarea auto-resize feel */
	textarea {
		min-height: 48px;
		max-height: 120px;
	}
</style>
