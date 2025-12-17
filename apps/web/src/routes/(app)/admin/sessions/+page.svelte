<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from '$lib/components/ui/toast';
	import {
		Activity,
		Clock,
		ArrowLeftRight,
		Server,
		Zap,
		AlertTriangle,
		CheckCircle2,
		XCircle,
		RefreshCw,
		ChevronLeft,
		ChevronRight
	} from 'lucide-svelte';
	import AdminPageHeader from '$lib/components/admin/AdminPageHeader.svelte';

	// ============================================================================
	// STATE
	// ============================================================================

	interface Session {
		id: string;
		userId: string;
		userEmail: string | null;
		startedAt: number;
		endedAt: number | null;
		minutesUsed: number;
		topic: string | null;
		difficulty: string | null;
		mode: string | null;
		provider: string | null;
		initialProvider: string | null;
		providerSwitched: boolean;
		providerSwitchedAt: number | null;
		disconnectCode: number | null;
		disconnectReason: string | null;
		messageCount: number;
	}

	interface Stats {
		totalSessions: number;
		avgDuration: number;
		providerBreakdown: Record<string, number>;
		disconnectBreakdown: Record<string, number>;
		providerSwitchRate: number;
	}

	interface Pagination {
		page: number;
		limit: number;
		total: number;
	}

	let sessions = $state<Session[]>([]);
	let stats = $state<Stats | null>(null);
	let pagination = $state<Pagination>({ page: 1, limit: 50, total: 0 });
	let isLoading = $state(false);

	// Filter state
	let filters = $state({
		from: getDefaultFromDate(),
		to: getDefaultToDate(),
		provider: '',
		hasDisconnect: false
	});

	// Derived values
	let totalPages = $derived(Math.ceil(pagination.total / pagination.limit));

	// ============================================================================
	// HELPERS
	// ============================================================================

	function getDefaultFromDate(): string {
		const date = new Date();
		date.setDate(date.getDate() - 7);
		return date.toISOString().split('T')[0];
	}

	function getDefaultToDate(): string {
		return new Date().toISOString().split('T')[0];
	}

	function getDisconnectLabel(code: string): string {
		const labels: Record<string, string> = {
			'1000': 'Normal',
			'1001': 'Going Away',
			'1006': 'Abnormal',
			'1011': 'Server Error',
			'1012': 'Service Restart',
			'1013': 'Try Again Later'
		};
		return labels[code] || `Code ${code}`;
	}

	function getDisconnectSeverity(code: string): 'success' | 'warning' | 'danger' {
		if (code === '1000') return 'success';
		if (['1001', '1012', '1013'].includes(code)) return 'warning';
		return 'danger';
	}

	function formatDuration(minutes: number | null): string {
		if (minutes === null || minutes === undefined) return '-';
		if (minutes < 1) return '<1 min';
		return `${Math.round(minutes)} min`;
	}

	function formatTime(timestamp: number | null): string {
		if (!timestamp) return '-';
		return new Date(timestamp).toLocaleString();
	}

	function formatPercentage(rate: number): string {
		return `${(rate * 100).toFixed(1)}%`;
	}

	// ============================================================================
	// DATA FETCHING
	// ============================================================================

	async function loadData() {
		isLoading = true;

		try {
			const params = new URLSearchParams({
				page: String(pagination.page),
				limit: String(pagination.limit)
			});

			if (filters.from) params.set('from', filters.from);
			if (filters.to) params.set('to', filters.to);
			if (filters.provider) params.set('provider', filters.provider);
			if (filters.hasDisconnect) params.set('hasDisconnect', 'true');

			const response = await fetch(`/api/admin/sessions?${params}`, {
				method: 'GET',
				credentials: 'include'
			});

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.message || `Failed to fetch sessions: ${response.statusText}`);
			}

			const data = await response.json();

			if (data.success) {
				sessions = data.data.sessions;
				stats = data.data.stats;
				pagination = data.data.pagination;
			}
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : 'Error fetching sessions';
			toast.error(errorMessage);
			console.error('[Admin Sessions]', errorMessage, error);
			sessions = [];
			stats = null;
		} finally {
			isLoading = false;
		}
	}

	function handleFilterChange() {
		pagination.page = 1;
		loadData();
	}

	function changePage(newPage: number) {
		if (newPage < 1 || newPage > totalPages) return;
		pagination.page = newPage;
		loadData();
	}

	onMount(loadData);
</script>

<svelte:head>
	<title>Session Health | Admin</title>
</svelte:head>

<AdminPageHeader
	title="Session Health"
	subtitle="Monitor voice session performance and provider reliability"
	icon={Activity}
/>

<!-- Stats Grid -->
{#if stats}
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-icon sessions">
				<Activity size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{stats.totalSessions}</p>
				<p class="stat-label">Total Sessions</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon duration">
				<Clock size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{stats.avgDuration.toFixed(1)} min</p>
				<p class="stat-label">Avg Duration</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon switch">
				<ArrowLeftRight size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{formatPercentage(stats.providerSwitchRate)}</p>
				<p class="stat-label">Provider Switch Rate</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon providers">
				<Server size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">
					{stats.providerBreakdown.gemini || 0} / {stats.providerBreakdown.openai || 0}
				</p>
				<p class="stat-label">Gemini / OpenAI</p>
			</div>
		</div>
	</div>
{/if}

<!-- Disconnect Codes Breakdown -->
{#if stats && Object.keys(stats.disconnectBreakdown).length > 0}
	<div class="card disconnect-breakdown">
		<h2>Disconnect Codes</h2>
		<div class="disconnect-grid">
			{#each Object.entries(stats.disconnectBreakdown) as [code, count]}
				{@const severity = getDisconnectSeverity(code)}
				<div class="disconnect-item {severity}">
					<div class="disconnect-code">{code}</div>
					<div class="disconnect-count">{count}</div>
					<div class="disconnect-label">{getDisconnectLabel(code)}</div>
				</div>
			{/each}
		</div>
	</div>
{/if}

<!-- Filter Controls -->
<div class="card filters">
	<h2>Filters</h2>
	<div class="filter-grid">
		<div class="filter-group">
			<label for="from-date">From</label>
			<input
				type="date"
				id="from-date"
				bind:value={filters.from}
				onchange={handleFilterChange}
				class="input"
			/>
		</div>

		<div class="filter-group">
			<label for="to-date">To</label>
			<input
				type="date"
				id="to-date"
				bind:value={filters.to}
				onchange={handleFilterChange}
				class="input"
			/>
		</div>

		<div class="filter-group">
			<label for="provider-select">Provider</label>
			<select
				id="provider-select"
				bind:value={filters.provider}
				onchange={handleFilterChange}
				class="input"
			>
				<option value="">All Providers</option>
				<option value="gemini">Gemini</option>
				<option value="openai">OpenAI</option>
			</select>
		</div>

		<div class="filter-group checkbox-group">
			<label class="checkbox-label">
				<input
					type="checkbox"
					bind:checked={filters.hasDisconnect}
					onchange={handleFilterChange}
				/>
				<span>Has Disconnect</span>
			</label>
		</div>

		<div class="filter-group">
			<button class="button highlight" onclick={loadData} disabled={isLoading}>
				<RefreshCw size={16} class={isLoading ? 'animate-spin' : ''} />
				Refresh
			</button>
		</div>
	</div>
</div>

<!-- Sessions Table -->
<div class="card overflow-hidden">
	<div class="overflow-x-auto">
		<!-- Table Header -->
		<div
			class="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center border-b border-border/50 text-sm font-medium bg-muted"
		>
			<div class="p-2 sm:p-3">User</div>
			<div class="p-2 sm:p-3">Time</div>
			<div class="p-2 sm:p-3">Duration</div>
			<div class="p-2 sm:p-3">Provider</div>
			<div class="p-2 sm:p-3">Disconnect</div>
			<div class="p-2 sm:p-3">Messages</div>
		</div>

		<!-- Table Body -->
		<div
			class="divide-y divide-border/50 {isLoading
				? 'transition-opacity duration-100 opacity-50'
				: ''}"
		>
			{#each sessions as session (session.id)}
				<!-- Mobile card layout -->
				<div class="sm:hidden p-3 bg-background hover:bg-muted transition-colors">
					<div class="flex items-start justify-between gap-2">
						<div class="flex flex-col">
							<span class="font-medium truncate">{session.userEmail || 'Unknown'}</span>
							<span class="text-xs text-secondary-4">{formatTime(session.startedAt)}</span>
						</div>
						<div class="flex flex-col items-end gap-1">
							<span
								class="badge {session.provider === 'gemini' ? 'bg-provider-gemini' : 'bg-provider-openai'}"
							>
								{session.provider || 'N/A'}
								{#if session.providerSwitched}
									<ArrowLeftRight size={12} class="ml-1" />
								{/if}
							</span>
							{#if session.disconnectCode}
								<span class="badge bg-danger">{session.disconnectCode}</span>
							{:else}
								<span class="badge bg-success">Clean</span>
							{/if}
						</div>
					</div>
					<div class="flex items-center gap-4 mt-2 text-sm text-secondary-4">
						<span>{formatDuration(session.minutesUsed)}</span>
						<span>{session.messageCount} msgs</span>
					</div>
				</div>

				<!-- Desktop grid layout -->
				<div
					class="hidden sm:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] items-center bg-background hover:bg-muted transition-colors"
				>
					<!-- User -->
					<div class="p-2 sm:p-3 text-sm truncate">
						<span class="font-medium">{session.userEmail || 'Unknown'}</span>
					</div>

					<!-- Time -->
					<div class="p-2 sm:p-3 text-sm text-secondary-4">
						{formatTime(session.startedAt)}
					</div>

					<!-- Duration -->
					<div class="p-2 sm:p-3 text-sm">
						{formatDuration(session.minutesUsed)}
					</div>

					<!-- Provider -->
					<div class="p-2 sm:p-3">
						<span
							class="badge {session.provider === 'gemini' ? 'bg-provider-gemini' : 'bg-provider-openai'}"
						>
							{session.provider || 'N/A'}
						</span>
						{#if session.providerSwitched}
							<span class="ml-1 text-xs text-amber-600 dark:text-amber-400" title="Provider switched">
								<ArrowLeftRight size={14} class="inline" />
							</span>
						{/if}
					</div>

					<!-- Disconnect Code -->
					<div class="p-2 sm:p-3">
						{#if session.disconnectCode}
							{@const severity = getDisconnectSeverity(String(session.disconnectCode))}
							<span class="badge disconnect-badge {severity}" title={session.disconnectReason || ''}>
								{#if severity === 'success'}
									<CheckCircle2 size={12} class="mr-1" />
								{:else if severity === 'warning'}
									<AlertTriangle size={12} class="mr-1" />
								{:else}
									<XCircle size={12} class="mr-1" />
								{/if}
								{session.disconnectCode}
							</span>
						{:else}
							<span class="badge bg-success">
								<CheckCircle2 size={12} class="mr-1" />
								Clean
							</span>
						{/if}
					</div>

					<!-- Messages -->
					<div class="p-2 sm:p-3 text-sm">{session.messageCount}</div>
				</div>
			{:else}
				<div class="w-full p-4 h-24 flex items-center justify-center z-10">
					{#if isLoading}
						<div
							class="animate-spin h-6 w-6 border-3 border-border border-t-muted-foreground rounded-full"
						></div>
					{:else}
						<div class="text-sm text-secondary-4">No sessions found</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>

	<!-- Pagination -->
	{#if totalPages > 1}
		<div
			class="flex flex-col sm:flex-row justify-between items-center gap-2 p-2 sm:p-3 border-t border-border/50"
		>
			<span class="text-xs sm:text-sm text-secondary-4">
				Page {pagination.page} of {totalPages}
				<span class="hidden sm:inline">({pagination.total} sessions)</span>
			</span>
			<div class="flex gap-2">
				<button
					class="button p-2 highlight"
					onclick={() => changePage(pagination.page - 1)}
					disabled={pagination.page <= 1 || isLoading}
				>
					<ChevronLeft size={18} />
				</button>
				<button
					class="button p-2 highlight"
					onclick={() => changePage(pagination.page + 1)}
					disabled={pagination.page >= totalPages || isLoading}
				>
					<ChevronRight size={18} />
				</button>
			</div>
		</div>
	{/if}
</div>

<style>
	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	@media (min-width: 640px) {
		.stats-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.stats-grid {
			grid-template-columns: repeat(4, 1fr);
		}
	}

	.stat-card {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 1.25rem;
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
	}

	.stat-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.75rem;
		height: 2.75rem;
		border-radius: 0.5rem;
		flex-shrink: 0;
	}

	.stat-icon.sessions {
		background-color: hsl(160, 30%, 90%);
		color: hsl(160, 30%, 35%);
	}

	.stat-icon.duration {
		background-color: hsl(220, 60%, 92%);
		color: hsl(220, 60%, 45%);
	}

	.stat-icon.switch {
		background-color: hsl(42, 75%, 90%);
		color: hsl(42, 75%, 35%);
	}

	.stat-icon.providers {
		background-color: hsl(280, 60%, 92%);
		color: hsl(280, 60%, 45%);
	}

	.stat-content {
		display: flex;
		flex-direction: column;
	}

	.stat-value {
		font-size: 1.5rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		line-height: 1.2;
	}

	.stat-label {
		font-size: 0.8125rem;
		color: hsl(var(--muted-foreground));
	}

	/* Disconnect Breakdown */
	.disconnect-breakdown {
		margin-bottom: 1.5rem;
	}

	.disconnect-breakdown h2 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0 0 1rem;
	}

	.disconnect-grid {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 0.75rem;
	}

	@media (min-width: 640px) {
		.disconnect-grid {
			grid-template-columns: repeat(3, 1fr);
		}
	}

	@media (min-width: 1024px) {
		.disconnect-grid {
			grid-template-columns: repeat(6, 1fr);
		}
	}

	.disconnect-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		padding: 0.75rem;
		border-radius: 0.5rem;
		text-align: center;
	}

	.disconnect-item.success {
		background-color: hsl(142, 60%, 90%);
		color: hsl(142, 70%, 30%);
	}

	.disconnect-item.warning {
		background-color: hsl(42, 75%, 90%);
		color: hsl(42, 75%, 30%);
	}

	.disconnect-item.danger {
		background-color: hsl(5, 72%, 92%);
		color: hsl(5, 72%, 35%);
	}

	.disconnect-code {
		font-family: monospace;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.disconnect-count {
		font-size: 1.25rem;
		font-weight: 700;
	}

	.disconnect-label {
		font-size: 0.75rem;
		opacity: 0.8;
	}

	/* Filter Controls */
	.filters {
		margin-bottom: 1.5rem;
	}

	.filters h2 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0 0 1rem;
	}

	.filter-grid {
		display: flex;
		flex-wrap: wrap;
		gap: 1rem;
		align-items: flex-end;
	}

	.filter-group {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.filter-group label {
		font-size: 0.75rem;
		font-weight: 500;
		color: hsl(var(--muted-foreground));
	}

	.filter-group .input {
		padding: 0.5rem 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		background-color: hsl(var(--background));
		color: hsl(var(--foreground));
		font-size: 0.875rem;
		min-width: 150px;
	}

	.filter-group .input:focus {
		outline: none;
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 2px hsl(var(--primary) / 0.1);
	}

	.checkbox-group {
		flex-direction: row;
		align-items: center;
		padding-bottom: 0.5rem;
	}

	.checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		font-size: 0.875rem !important;
		color: hsl(var(--foreground)) !important;
	}

	.checkbox-label input[type='checkbox'] {
		width: 1rem;
		height: 1rem;
		accent-color: hsl(var(--primary));
	}

	/* Provider Badge Colors */
	:global(.bg-provider-gemini) {
		background-color: hsl(220, 80%, 90%);
		color: hsl(220, 80%, 35%);
	}

	:global(.bg-provider-openai) {
		background-color: hsl(142, 50%, 90%);
		color: hsl(142, 60%, 30%);
	}

	/* Disconnect Badge */
	.disconnect-badge.success {
		background-color: hsl(142, 60%, 90%);
		color: hsl(142, 70%, 30%);
	}

	.disconnect-badge.warning {
		background-color: hsl(42, 75%, 90%);
		color: hsl(42, 75%, 30%);
	}

	.disconnect-badge.danger {
		background-color: hsl(5, 72%, 92%);
		color: hsl(5, 72%, 35%);
	}

	/* Dark mode */
	:global(.dark) .stat-icon.sessions {
		background-color: hsl(160, 30%, 20%);
		color: hsl(160, 35%, 55%);
	}

	:global(.dark) .stat-icon.duration {
		background-color: hsl(220, 50%, 20%);
		color: hsl(220, 60%, 60%);
	}

	:global(.dark) .stat-icon.switch {
		background-color: hsl(42, 50%, 20%);
		color: hsl(42, 70%, 55%);
	}

	:global(.dark) .stat-icon.providers {
		background-color: hsl(280, 40%, 20%);
		color: hsl(280, 50%, 60%);
	}

	:global(.dark) .disconnect-item.success {
		background-color: hsl(142, 40%, 20%);
		color: hsl(142, 60%, 55%);
	}

	:global(.dark) .disconnect-item.warning {
		background-color: hsl(42, 50%, 20%);
		color: hsl(42, 70%, 55%);
	}

	:global(.dark) .disconnect-item.danger {
		background-color: hsl(5, 50%, 20%);
		color: hsl(5, 65%, 55%);
	}

	:global(.dark) .bg-provider-gemini {
		background-color: hsl(220, 50%, 25%);
		color: hsl(220, 70%, 70%);
	}

	:global(.dark) .bg-provider-openai {
		background-color: hsl(142, 30%, 20%);
		color: hsl(142, 50%, 60%);
	}

	:global(.dark) .disconnect-badge.success {
		background-color: hsl(142, 40%, 20%);
		color: hsl(142, 60%, 55%);
	}

	:global(.dark) .disconnect-badge.warning {
		background-color: hsl(42, 50%, 20%);
		color: hsl(42, 70%, 55%);
	}

	:global(.dark) .disconnect-badge.danger {
		background-color: hsl(5, 50%, 20%);
		color: hsl(5, 65%, 55%);
	}
</style>
