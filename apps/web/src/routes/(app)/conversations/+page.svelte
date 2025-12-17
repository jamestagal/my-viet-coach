<script lang="ts">
	import { onMount } from 'svelte';
	import {
		MessageCircle,
		GraduationCap,
		Clock,
		Calendar,
		ChevronRight,
		AlertCircle,
		Loader2,
		ChevronLeft
	} from 'lucide-svelte';

	// Types
	type Session = {
		id: string;
		startedAt: number;
		endedAt: number | null;
		topic: string | null;
		difficulty: string | null;
		mode: string | null;
		provider: string | null;
		messageCount: number;
		correctionCount: number;
	};

	type Message = {
		id: string;
		role: 'user' | 'coach';
		text: string;
		timestamp: number;
		sequenceNumber: number;
	};

	type Correction = {
		id: string;
		original: string;
		correction: string;
		explanation: string | null;
		category: string | null;
		reviewed: boolean;
		reviewedAt: number | null;
		confidenceLevel: number;
		createdAt: number;
	};

	type SessionDetail = {
		session: Session & {
			initialProvider: string | null;
			providerSwitchedAt: number | null;
			disconnectCode: number | null;
			disconnectReason: string | null;
			minutesUsed: number | null;
		};
		messages: Message[];
		corrections: Correction[];
	};

	// State
	let sessions = $state<Session[]>([]);
	let selectedSession = $state<SessionDetail | null>(null);
	let loading = $state(true);
	let loadingDetail = $state(false);
	let error = $state<string | null>(null);

	// Pagination
	let currentPage = $state(1);
	let totalSessions = $state(0);
	let limit = 10;

	// Derived
	let totalPages = $derived(Math.ceil(totalSessions / limit));

	// Load sessions list
	async function loadSessions(page = 1) {
		loading = true;
		error = null;

		try {
			const response = await fetch(`/api/conversations?page=${page}&limit=${limit}`, {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Failed to load conversations');
			}

			const data = await response.json();
			sessions = data.data.sessions;
			totalSessions = data.data.pagination.total;
			currentPage = data.data.pagination.page;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load conversations';
		} finally {
			loading = false;
		}
	}

	// Load session details
	async function loadSessionDetail(sessionId: string) {
		loadingDetail = true;

		try {
			const response = await fetch(`/api/conversations/${sessionId}`, {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Failed to load session details');
			}

			const data = await response.json();
			selectedSession = data.data;
		} catch (err) {
			console.error('Failed to load session:', err);
		} finally {
			loadingDetail = false;
		}
	}

	// Format date for display
	function formatDate(timestamp: number | null): string {
		if (!timestamp) return 'N/A';
		const date = new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric',
			year: 'numeric'
		});
	}

	// Format time for display
	function formatTime(timestamp: number | null): string {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		return date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit'
		});
	}

	// Calculate duration in minutes
	function getDuration(startedAt: number, endedAt: number | null): string {
		if (!endedAt) return 'In progress';
		const durationMs = endedAt - startedAt;
		const minutes = Math.round(durationMs / 60000);
		return `${minutes} min`;
	}

	// Get topic label
	function getTopicLabel(topic: string | null): string {
		const topics: Record<string, string> = {
			general: 'General Chat',
			food: 'Food & Dining',
			travel: 'Travel',
			family: 'Family',
			work: 'Work',
			hobbies: 'Hobbies',
			shopping: 'Shopping',
			culture: 'Culture'
		};
		return topics[topic || ''] || topic || 'General';
	}

	// Get category display
	function getCategoryLabel(category: string | null): string {
		const categories: Record<string, string> = {
			grammar: 'Grammar',
			tone: 'Tone',
			vocabulary: 'Vocabulary',
			word_order: 'Word Order',
			pronunciation: 'Pronunciation'
		};
		return categories[category || ''] || category || 'Other';
	}

	// Navigate pages
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			loadSessions(page);
		}
	}

	// Initialize
	onMount(() => {
		loadSessions();
	});
</script>

<svelte:head>
	<title>Conversations | Speak Pho Real</title>
</svelte:head>

<div class="conversations-page">
	<!-- Header -->
	<header class="page-header">
		<div>
			<p class="page-subtitle viet-text">Lịch sử hội thoại</p>
			<h1 class="page-title">Conversations</h1>
			<p class="page-description">Review your past practice sessions and corrections</p>
		</div>
	</header>

	{#if loading && sessions.length === 0}
		<!-- Loading state -->
		<div class="loading-state">
			<Loader2 class="animate-spin" size={32} />
			<p>Loading conversations...</p>
		</div>
	{:else if error}
		<!-- Error state -->
		<div class="error-state">
			<AlertCircle size={32} />
			<p>{error}</p>
			<button onclick={() => loadSessions()} class="retry-btn">Try Again</button>
		</div>
	{:else if sessions.length === 0}
		<!-- Empty state -->
		<div class="empty-state">
			<MessageCircle size={48} />
			<h2>No conversations yet</h2>
			<p>Start practicing to see your conversation history here.</p>
			<a href="/practice" class="start-btn">Start Practice</a>
		</div>
	{:else}
		<!-- Main content -->
		<div class="content-grid">
			<!-- Session List -->
			<div class="session-list">
				<div class="list-header">
					<h2>Sessions</h2>
					<span class="session-count">{totalSessions} total</span>
				</div>

				<div class="sessions">
					{#each sessions as session (session.id)}
						<button
							type="button"
							class="session-card"
							class:selected={selectedSession?.session.id === session.id}
							onclick={() => loadSessionDetail(session.id)}
						>
							<div class="session-info">
								<div class="session-topic">
									{getTopicLabel(session.topic)}
								</div>
								<div class="session-meta">
									<span class="session-date">
										<Calendar size={12} />
										{formatDate(session.startedAt)}
									</span>
									<span class="session-duration">
										<Clock size={12} />
										{getDuration(session.startedAt, session.endedAt)}
									</span>
								</div>
							</div>
							<div class="session-badges">
								<span class="mode-badge {session.mode || 'free'}">
									{#if session.mode === 'coach'}
										<GraduationCap size={12} />
									{:else}
										<MessageCircle size={12} />
									{/if}
									{session.mode === 'coach' ? 'Coach' : 'Free'}
								</span>
								{#if session.correctionCount > 0}
									<span class="correction-badge">
										{session.correctionCount} corrections
									</span>
								{/if}
							</div>
							<ChevronRight size={16} class="chevron" />
						</button>
					{/each}
				</div>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="pagination">
						<button
							type="button"
							onclick={() => goToPage(currentPage - 1)}
							disabled={currentPage === 1}
							class="page-btn"
						>
							<ChevronLeft size={16} />
						</button>
						<span class="page-info">
							Page {currentPage} of {totalPages}
						</span>
						<button
							type="button"
							onclick={() => goToPage(currentPage + 1)}
							disabled={currentPage === totalPages}
							class="page-btn"
						>
							<ChevronRight size={16} />
						</button>
					</div>
				{/if}
			</div>

			<!-- Session Detail Panel -->
			<div class="detail-panel">
				{#if loadingDetail}
					<div class="loading-state">
						<Loader2 class="animate-spin" size={24} />
						<p>Loading session...</p>
					</div>
				{:else if selectedSession}
					<!-- Session Header -->
					<div class="detail-header">
						<h2>{getTopicLabel(selectedSession.session.topic)}</h2>
						<div class="detail-meta">
							<span>{formatDate(selectedSession.session.startedAt)}</span>
							<span class="dot"></span>
							<span>{formatTime(selectedSession.session.startedAt)}</span>
							<span class="dot"></span>
							<span>{getDuration(selectedSession.session.startedAt, selectedSession.session.endedAt)}</span>
						</div>
						<div class="detail-badges">
							<span class="mode-badge {selectedSession.session.mode || 'free'}">
								{#if selectedSession.session.mode === 'coach'}
									<GraduationCap size={12} />
								{:else}
									<MessageCircle size={12} />
								{/if}
								{selectedSession.session.mode === 'coach' ? 'Coach Mode' : 'Free Chat'}
							</span>
							{#if selectedSession.session.provider}
								<span class="provider-badge {selectedSession.session.provider}">
									{selectedSession.session.provider}
								</span>
							{/if}
						</div>
					</div>

					<!-- Conversation Transcript -->
					<div class="transcript-section">
						<h3>Conversation</h3>
						{#if selectedSession.messages.length === 0}
							<p class="no-messages">No messages recorded for this session.</p>
						{:else}
							<div class="transcript-list">
								{#each selectedSession.messages as message (message.id)}
									<div class="transcript-card {message.role}">
										<span class="transcript-label">
											{message.role === 'user' ? 'You' : 'Co Ha'}
										</span>
										<p class="viet-text">{message.text}</p>
									</div>
								{/each}
							</div>
						{/if}
					</div>

					<!-- Corrections -->
					{#if selectedSession.corrections.length > 0}
						<div class="corrections-section">
							<h3>Corrections ({selectedSession.corrections.length})</h3>
							<div class="corrections-list">
								{#each selectedSession.corrections as correction, i (correction.id)}
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
											{#if correction.explanation}
												<p class="correction-explanation">{correction.explanation}</p>
											{/if}
											<div class="correction-footer">
												<span class="category-badge {correction.category || 'other'}">
													{getCategoryLabel(correction.category)}
												</span>
												{#if correction.reviewed}
													<span class="reviewed-badge">Reviewed</span>
												{/if}
											</div>
										</div>
									</div>
								{/each}
							</div>
						</div>
					{/if}
				{:else}
					<div class="empty-detail">
						<MessageCircle size={32} />
						<p>Select a session to view details</p>
					</div>
				{/if}
			</div>
		</div>
	{/if}
</div>

<style>
	.conversations-page {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	/* Header */
	.page-header {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.page-subtitle {
		font-size: 0.875rem;
		color: hsl(var(--primary));
		font-weight: 500;
	}

	.page-title {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}

	.page-description {
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	/* Loading, Error, Empty states */
	.loading-state,
	.error-state,
	.empty-state,
	.empty-detail {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 3rem 1rem;
		text-align: center;
		color: hsl(var(--muted-foreground));
	}

	.empty-state h2 {
		color: hsl(var(--foreground));
		font-size: 1.25rem;
		margin: 0;
	}

	.retry-btn {
		padding: 0.5rem 1rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.start-btn {
		padding: 0.75rem 1.5rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 0.75rem;
		font-size: 0.875rem;
		text-decoration: none;
		transition: background 0.2s ease;
	}

	.start-btn:hover {
		background: hsl(var(--primary) / 0.9);
	}

	/* Content Grid */
	.content-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 1024px) {
		.content-grid {
			grid-template-columns: 360px 1fr;
		}
	}

	/* Session List */
	.session-list {
		display: flex;
		flex-direction: column;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		overflow: hidden;
	}

	.list-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.25rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.list-header h2 {
		font-size: 1rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}

	.session-count {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.sessions {
		display: flex;
		flex-direction: column;
		max-height: 60vh;
		overflow-y: auto;
	}

	.session-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem 1.25rem;
		border: none;
		border-bottom: 1px solid hsl(var(--border));
		background: transparent;
		cursor: pointer;
		text-align: left;
		width: 100%;
		transition: background 0.15s ease;
	}

	.session-card:hover {
		background: hsl(var(--muted) / 0.5);
	}

	.session-card.selected {
		background: hsl(var(--primary) / 0.1);
	}

	.session-card:last-child {
		border-bottom: none;
	}

	.session-info {
		flex: 1;
		min-width: 0;
	}

	.session-topic {
		font-weight: 500;
		color: hsl(var(--foreground));
		font-size: 0.875rem;
		margin-bottom: 0.25rem;
	}

	.session-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.session-meta span {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}

	.session-badges {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		align-items: flex-end;
	}

	.mode-badge {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.mode-badge.coach {
		background: hsl(var(--primary) / 0.15);
		color: hsl(var(--primary));
	}

	.mode-badge.free {
		background: hsl(var(--viet-jade) / 0.15);
		color: hsl(var(--viet-jade));
	}

	.correction-badge {
		font-size: 0.625rem;
		color: hsl(var(--amber-600, 45 93% 47%));
		background: hsl(45 93% 47% / 0.1);
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	.chevron {
		color: hsl(var(--muted-foreground));
		flex-shrink: 0;
	}

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1rem;
		border-top: 1px solid hsl(var(--border));
	}

	.page-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: 0.375rem;
		background: hsl(var(--muted));
		color: hsl(var(--foreground));
		border: none;
		cursor: pointer;
		transition: background 0.15s ease;
	}

	.page-btn:hover:not(:disabled) {
		background: hsl(var(--muted) / 0.8);
	}

	.page-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
	}

	/* Detail Panel */
	.detail-panel {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		overflow: hidden;
		min-height: 400px;
	}

	.detail-header {
		padding: 1.25rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.detail-header h2 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0 0 0.5rem 0;
	}

	.detail-meta {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		margin-bottom: 0.75rem;
	}

	.dot {
		width: 3px;
		height: 3px;
		border-radius: 50%;
		background: hsl(var(--muted-foreground));
	}

	.detail-badges {
		display: flex;
		gap: 0.5rem;
	}

	.provider-badge {
		display: inline-flex;
		align-items: center;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
	}

	.provider-badge.gemini {
		background: hsl(217 91% 60% / 0.15);
		color: hsl(217 91% 50%);
	}

	.provider-badge.openai {
		background: hsl(142 71% 45% / 0.15);
		color: hsl(142 71% 35%);
	}

	/* Transcript Section */
	.transcript-section {
		padding: 1.25rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.transcript-section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0 0 1rem 0;
	}

	.no-messages {
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
		font-style: italic;
	}

	.transcript-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		max-height: 300px;
		overflow-y: auto;
	}

	.transcript-card {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		padding: 0.75rem 1rem;
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
		margin-bottom: 0.25rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.transcript-card.user .transcript-label {
		color: hsl(var(--primary));
	}

	.transcript-card.coach .transcript-label {
		color: hsl(var(--accent));
	}

	/* Corrections Section */
	.corrections-section {
		padding: 1.25rem;
	}

	.corrections-section h3 {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0 0 1rem 0;
	}

	.corrections-list {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.correction-card {
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem 1rem;
		background: hsl(var(--muted) / 0.3);
		border-radius: 0.75rem;
		border: 1px solid hsl(var(--border));
	}

	.correction-number {
		width: 1.5rem;
		height: 1.5rem;
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
		margin-bottom: 0.375rem;
	}

	.correction-label {
		font-size: 0.75rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
		min-width: 4rem;
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
		margin: 0.5rem 0;
		line-height: 1.4;
	}

	.correction-footer {
		display: flex;
		gap: 0.5rem;
		align-items: center;
		margin-top: 0.5rem;
	}

	.category-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border-radius: 999px;
		font-size: 0.625rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.category-badge.grammar {
		background: hsl(220 60% 92%);
		color: hsl(220 60% 45%);
	}

	.category-badge.tone {
		background: hsl(280 60% 92%);
		color: hsl(280 60% 45%);
	}

	.category-badge.vocabulary {
		background: hsl(142 60% 92%);
		color: hsl(142 60% 35%);
	}

	.category-badge.word_order {
		background: hsl(25 80% 92%);
		color: hsl(25 80% 40%);
	}

	.category-badge.pronunciation {
		background: hsl(340 60% 92%);
		color: hsl(340 60% 45%);
	}

	.reviewed-badge {
		font-size: 0.625rem;
		color: hsl(var(--viet-jade));
		background: hsl(var(--viet-jade) / 0.1);
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}

	/* Dark mode adjustments */
	:global(.dark) .category-badge.grammar {
		background: hsl(220 50% 25%);
		color: hsl(220 60% 65%);
	}

	:global(.dark) .category-badge.tone {
		background: hsl(280 40% 25%);
		color: hsl(280 60% 65%);
	}

	:global(.dark) .category-badge.vocabulary {
		background: hsl(142 40% 20%);
		color: hsl(142 60% 55%);
	}

	:global(.dark) .category-badge.word_order {
		background: hsl(25 50% 25%);
		color: hsl(25 70% 60%);
	}

	:global(.dark) .category-badge.pronunciation {
		background: hsl(340 40% 25%);
		color: hsl(340 60% 65%);
	}
</style>
