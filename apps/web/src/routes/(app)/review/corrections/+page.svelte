<script lang="ts">
	import { onMount } from 'svelte';
	import {
		BookOpen,
		Check,
		Clock,
		AlertCircle,
		Loader2,
		ChevronLeft,
		ChevronRight,
		Filter,
		Star
	} from 'lucide-svelte';

	// Types
	type Correction = {
		id: string;
		sessionId: string;
		original: string;
		correction: string;
		explanation: string | null;
		category: string | null;
		reviewed: boolean;
		reviewedAt: number | null;
		confidenceLevel: number;
		createdAt: number;
	};

	type Stats = {
		total: number;
		reviewed: number;
		byCategory: {
			grammar: number;
			tone: number;
			vocabulary: number;
			word_order: number;
			pronunciation: number;
		};
	};

	// State
	let corrections = $state<Correction[]>([]);
	let stats = $state<Stats | null>(null);
	let loading = $state(true);
	let error = $state<string | null>(null);

	// Filters
	let selectedCategory = $state<string | null>(null);
	let showReviewed = $state<boolean | null>(null); // null = all, true = reviewed, false = unreviewed

	// Pagination
	let currentPage = $state(1);
	let totalCorrections = $state(0);
	let limit = 20;

	// Update in progress
	let updatingId = $state<string | null>(null);

	// Derived
	let totalPages = $derived(Math.ceil(totalCorrections / limit));
	let unreviewedCount = $derived(stats ? stats.total - stats.reviewed : 0);

	// Categories for filter tabs
	const categories = [
		{ value: null, label: 'All' },
		{ value: 'grammar', label: 'Grammar' },
		{ value: 'tone', label: 'Tone' },
		{ value: 'vocabulary', label: 'Vocabulary' },
		{ value: 'word_order', label: 'Word Order' },
		{ value: 'pronunciation', label: 'Pronunciation' }
	];

	// Load corrections
	async function loadCorrections(page = 1) {
		loading = true;
		error = null;

		try {
			const params = new URLSearchParams();
			params.set('page', String(page));
			params.set('limit', String(limit));

			if (selectedCategory) {
				params.set('category', selectedCategory);
			}

			if (showReviewed !== null) {
				params.set('reviewed', String(showReviewed));
			}

			const response = await fetch(`/api/review/corrections?${params}`, {
				credentials: 'include'
			});

			if (!response.ok) {
				throw new Error('Failed to load corrections');
			}

			const data = await response.json();
			corrections = data.data.corrections;
			stats = data.data.stats;
			totalCorrections = data.data.pagination.total;
			currentPage = data.data.pagination.page;
		} catch (err) {
			error = err instanceof Error ? err.message : 'Failed to load corrections';
		} finally {
			loading = false;
		}
	}

	// Mark correction as reviewed
	async function markAsReviewed(correctionId: string, reviewed: boolean, confidenceLevel: number) {
		updatingId = correctionId;

		try {
			const response = await fetch(`/api/review/corrections/${correctionId}`, {
				method: 'PATCH',
				credentials: 'include',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ reviewed, confidenceLevel })
			});

			if (!response.ok) {
				throw new Error('Failed to update correction');
			}

			const data = await response.json();

			// Update local state
			corrections = corrections.map((c) =>
				c.id === correctionId
					? {
							...c,
							reviewed: data.data.reviewed,
							reviewedAt: data.data.reviewedAt,
							confidenceLevel: data.data.confidenceLevel
						}
					: c
			);

			// Update stats
			if (stats) {
				if (reviewed && !corrections.find((c) => c.id === correctionId)?.reviewed) {
					stats = { ...stats, reviewed: stats.reviewed + 1 };
				} else if (!reviewed && corrections.find((c) => c.id === correctionId)?.reviewed) {
					stats = { ...stats, reviewed: stats.reviewed - 1 };
				}
			}
		} catch (err) {
			console.error('Failed to update correction:', err);
		} finally {
			updatingId = null;
		}
	}

	// Handle category filter change
	function selectCategory(category: string | null) {
		selectedCategory = category;
		currentPage = 1;
		loadCorrections(1);
	}

	// Handle reviewed filter change
	function toggleReviewedFilter(value: boolean | null) {
		showReviewed = value;
		currentPage = 1;
		loadCorrections(1);
	}

	// Navigate pages
	function goToPage(page: number) {
		if (page >= 1 && page <= totalPages) {
			loadCorrections(page);
		}
	}

	// Format date
	function formatDate(timestamp: number | null): string {
		if (!timestamp) return '';
		const date = new Date(timestamp);
		return date.toLocaleDateString('en-US', {
			month: 'short',
			day: 'numeric'
		});
	}

	// Get category display
	function getCategoryLabel(category: string | null): string {
		const labels: Record<string, string> = {
			grammar: 'Grammar',
			tone: 'Tone',
			vocabulary: 'Vocabulary',
			word_order: 'Word Order',
			pronunciation: 'Pronunciation'
		};
		return labels[category || ''] || category || 'Other';
	}

	// Initialize
	onMount(() => {
		loadCorrections();
	});
</script>

<svelte:head>
	<title>Review Corrections | Speak Pho Real</title>
</svelte:head>

<div class="review-page">
	<!-- Header -->
	<header class="page-header">
		<div>
			<p class="page-subtitle viet-text">Ôn tập lỗi sai</p>
			<h1 class="page-title">Review Corrections</h1>
			<p class="page-description">Review and practice your corrections to improve your Vietnamese</p>
		</div>
	</header>

	{#if stats}
		<!-- Stats Cards -->
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon total">
					<BookOpen size={20} />
				</div>
				<div class="stat-content">
					<p class="stat-value">{stats.total}</p>
					<p class="stat-label">Total Corrections</p>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon reviewed">
					<Check size={20} />
				</div>
				<div class="stat-content">
					<p class="stat-value">{stats.reviewed}</p>
					<p class="stat-label">Reviewed</p>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon pending">
					<Clock size={20} />
				</div>
				<div class="stat-content">
					<p class="stat-value">{unreviewedCount}</p>
					<p class="stat-label">To Review</p>
				</div>
			</div>

			<div class="stat-card">
				<div class="stat-icon progress">
					<Star size={20} />
				</div>
				<div class="stat-content">
					<p class="stat-value">
						{stats.total > 0 ? Math.round((stats.reviewed / stats.total) * 100) : 0}%
					</p>
					<p class="stat-label">Progress</p>
				</div>
			</div>
		</div>
	{/if}

	<!-- Filters -->
	<div class="filters-section">
		<!-- Category Tabs -->
		<div class="category-tabs">
			{#each categories as cat}
				<button
					type="button"
					class="category-tab"
					class:active={selectedCategory === cat.value}
					onclick={() => selectCategory(cat.value)}
				>
					{cat.label}
					{#if stats && cat.value}
						<span class="category-count">
							{stats.byCategory[cat.value as keyof typeof stats.byCategory] || 0}
						</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Reviewed Toggle -->
		<div class="reviewed-toggle">
			<Filter size={16} />
			<button
				type="button"
				class="toggle-btn"
				class:active={showReviewed === null}
				onclick={() => toggleReviewedFilter(null)}
			>
				All
			</button>
			<button
				type="button"
				class="toggle-btn"
				class:active={showReviewed === false}
				onclick={() => toggleReviewedFilter(false)}
			>
				To Review
			</button>
			<button
				type="button"
				class="toggle-btn"
				class:active={showReviewed === true}
				onclick={() => toggleReviewedFilter(true)}
			>
				Reviewed
			</button>
		</div>
	</div>

	{#if loading && corrections.length === 0}
		<!-- Loading state -->
		<div class="loading-state">
			<Loader2 class="animate-spin" size={32} />
			<p>Loading corrections...</p>
		</div>
	{:else if error}
		<!-- Error state -->
		<div class="error-state">
			<AlertCircle size={32} />
			<p>{error}</p>
			<button onclick={() => loadCorrections()} class="retry-btn">Try Again</button>
		</div>
	{:else if corrections.length === 0}
		<!-- Empty state -->
		<div class="empty-state">
			<Check size={48} />
			<h2>
				{#if showReviewed === false}
					All caught up!
				{:else}
					No corrections yet
				{/if}
			</h2>
			<p>
				{#if showReviewed === false}
					You've reviewed all your corrections. Keep practicing!
				{:else}
					Practice in Coach Mode to receive corrections.
				{/if}
			</p>
			<a href="/practice" class="start-btn">Start Practice</a>
		</div>
	{:else}
		<!-- Corrections List -->
		<div class="corrections-container">
			<div class="corrections-list">
				{#each corrections as correction (correction.id)}
					<div class="correction-card" class:reviewed={correction.reviewed}>
						<div class="correction-header">
							<span class="category-badge {correction.category || 'other'}">
								{getCategoryLabel(correction.category)}
							</span>
							<span class="correction-date">{formatDate(correction.createdAt)}</span>
						</div>

						<div class="correction-body">
							<div class="correction-original">
								<span class="correction-label">You said:</span>
								<span class="viet-text original-text">{correction.original}</span>
							</div>
							<div class="correction-fixed">
								<span class="correction-label">Correct:</span>
								<span class="viet-text correct-text">{correction.correction}</span>
							</div>
							{#if correction.explanation}
								<p class="correction-explanation">{correction.explanation}</p>
							{/if}
						</div>

						<div class="correction-footer">
							<!-- Confidence level selector -->
							<div class="confidence-selector">
								<span class="confidence-label">Confidence:</span>
								<div class="confidence-stars">
									{#each [1, 2, 3, 4, 5] as level}
										<button
											type="button"
											class="star-btn"
											class:active={correction.confidenceLevel >= level}
											disabled={updatingId === correction.id}
											onclick={() => markAsReviewed(correction.id, true, level)}
											aria-label="Set confidence level to {level}"
										>
											<Star
												size={16}
												fill={correction.confidenceLevel >= level ? 'currentColor' : 'none'}
											/>
										</button>
									{/each}
								</div>
							</div>

							<!-- Review toggle -->
							<button
								type="button"
								class="review-btn"
								class:reviewed={correction.reviewed}
								disabled={updatingId === correction.id}
								onclick={() => markAsReviewed(correction.id, !correction.reviewed, correction.reviewed ? 0 : correction.confidenceLevel || 3)}
							>
								{#if updatingId === correction.id}
									<Loader2 size={14} class="animate-spin" />
								{:else if correction.reviewed}
									<Check size={14} />
								{/if}
								{correction.reviewed ? 'Reviewed' : 'Mark as Reviewed'}
							</button>
						</div>
					</div>
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
	{/if}
</div>

<style>
	.review-page {
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

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 1rem;
	}

	@media (min-width: 768px) {
		.stats-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 1rem;
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.5rem;
		flex-shrink: 0;
	}

	.stat-icon.total {
		background-color: hsl(220 60% 92%);
		color: hsl(220 60% 45%);
	}

	.stat-icon.reviewed {
		background-color: hsl(142 60% 90%);
		color: hsl(142 70% 35%);
	}

	.stat-icon.pending {
		background-color: hsl(45 90% 90%);
		color: hsl(45 90% 35%);
	}

	.stat-icon.progress {
		background-color: hsl(280 60% 92%);
		color: hsl(280 60% 45%);
	}

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.25rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		line-height: 1.2;
	}

	.stat-label {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	/* Filters */
	.filters-section {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
	}

	@media (min-width: 768px) {
		.filters-section {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}
	}

	.category-tabs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.category-tab {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-radius: 999px;
		font-size: 0.8125rem;
		font-weight: 500;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border: none;
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.category-tab:hover {
		background: hsl(var(--muted) / 0.8);
	}

	.category-tab.active {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}

	.category-count {
		font-size: 0.625rem;
		padding: 0.125rem 0.375rem;
		border-radius: 999px;
		background: hsl(0 0% 0% / 0.1);
	}

	.reviewed-toggle {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		color: hsl(var(--muted-foreground));
	}

	.toggle-btn {
		padding: 0.375rem 0.75rem;
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		background: transparent;
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.toggle-btn:hover {
		background: hsl(var(--muted));
	}

	.toggle-btn.active {
		background: hsl(var(--primary) / 0.1);
		color: hsl(var(--primary));
		border-color: hsl(var(--primary) / 0.3);
	}

	/* Loading, Error, Empty states */
	.loading-state,
	.error-state,
	.empty-state {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 3rem 1rem;
		text-align: center;
		color: hsl(var(--muted-foreground));
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
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

	/* Corrections Container */
	.corrections-container {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.corrections-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.correction-card {
		background: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
		overflow: hidden;
		transition: border-color 0.2s ease;
	}

	.correction-card:hover {
		border-color: hsl(var(--primary) / 0.3);
	}

	.correction-card.reviewed {
		opacity: 0.7;
	}

	.correction-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0.75rem 1rem;
		background: hsl(var(--muted) / 0.3);
		border-bottom: 1px solid hsl(var(--border));
	}

	.category-badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
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

	.correction-date {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.correction-body {
		padding: 1rem;
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

	.original-text {
		color: hsl(var(--destructive));
		text-decoration: line-through;
		text-decoration-color: hsl(var(--destructive) / 0.5);
	}

	.correct-text {
		color: hsl(var(--viet-jade));
		font-weight: 500;
	}

	.correction-explanation {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
		margin: 0.75rem 0 0 0;
		line-height: 1.5;
		padding-left: 5rem;
	}

	.correction-footer {
		display: flex;
		flex-wrap: wrap;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		border-top: 1px solid hsl(var(--border));
		background: hsl(var(--muted) / 0.2);
	}

	/* Confidence Selector */
	.confidence-selector {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.confidence-label {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.confidence-stars {
		display: flex;
		gap: 0.125rem;
	}

	.star-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.25rem;
		background: transparent;
		border: none;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition: color 0.15s ease;
	}

	.star-btn:hover:not(:disabled),
	.star-btn.active {
		color: hsl(45 90% 50%);
	}

	.star-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Review Button */
	.review-btn {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.75rem;
		font-weight: 500;
		background: hsl(var(--muted));
		color: hsl(var(--muted-foreground));
		border: 1px solid hsl(var(--border));
		cursor: pointer;
		transition: all 0.15s ease;
	}

	.review-btn:hover:not(:disabled) {
		background: hsl(var(--primary) / 0.1);
		color: hsl(var(--primary));
		border-color: hsl(var(--primary) / 0.3);
	}

	.review-btn.reviewed {
		background: hsl(var(--viet-jade) / 0.1);
		color: hsl(var(--viet-jade));
		border-color: hsl(var(--viet-jade) / 0.3);
	}

	.review-btn:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	/* Pagination */
	.pagination {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1rem;
		padding: 1rem;
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

	/* Dark mode adjustments */
	:global(.dark) .stat-icon.total {
		background-color: hsl(220 50% 25%);
		color: hsl(220 60% 65%);
	}

	:global(.dark) .stat-icon.reviewed {
		background-color: hsl(142 40% 20%);
		color: hsl(142 60% 55%);
	}

	:global(.dark) .stat-icon.pending {
		background-color: hsl(45 50% 25%);
		color: hsl(45 80% 55%);
	}

	:global(.dark) .stat-icon.progress {
		background-color: hsl(280 40% 25%);
		color: hsl(280 60% 65%);
	}

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
