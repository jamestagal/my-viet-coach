<script lang="ts">
	import { authClient } from '$lib/actions/authClient';
	import { Chart } from '$lib/components/ui/chart';
	import { MessageSquare, Reply, CheckCircle2, Users, Package, MessageCircle, CreditCard } from 'lucide-svelte';

	const session = authClient.useSession();

	let stats = $state({
		totalUsers: 152,
		totalProducts: 48,
		pendingFeedback: 5,
		activeSubscriptions: 78
	});

	let recentActivity = $state([
		{ type: 'feedback_new', title: "New feedback submitted for 'Dashboard UI'.", time: '15m ago' },
		{ type: 'feedback_reply', title: "Replied to feedback on 'Login Issues'.", time: '1h ago' },
		{ type: 'feedback_resolved', title: "Marked feedback 'Feature Request X' as resolved.", time: '5h ago' },
		{ type: 'feedback_new', title: "Feedback received for 'Mobile App'.", time: '1d ago' },
		{ type: 'feedback_reply', title: "Admin commented on feedback 'Performance'.", time: '2d ago' }
	]);

	let weeklyChartData = $state({
		labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
		datasets: [
			{
				label: 'User Signups',
				data: [100, 150, 80, 120, 200, 180, 250],
				borderColor: 'hsl(160, 30%, 40%)',
				backgroundColor: 'hsl(160, 30%, 40%)',
				tension: 0.4,
				pointBorderWidth: 2,
				pointRadius: 5,
				pointHoverRadius: 7
			},
			{
				label: 'Revenue ($)',
				data: [300, 550, 400, 600, 900, 850, 1100],
				borderColor: 'hsl(5, 72%, 42%)',
				backgroundColor: 'hsl(5, 72%, 42%)',
				tension: 0.4,
				pointBorderWidth: 2,
				pointRadius: 5,
				pointHoverRadius: 7
			}
		]
	});

	let monthlyUserData = $state({
		labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
		datasets: [
			{
				label: 'New Subscribers',
				data: [65, 59, 80, 81, 56, 55, 40, 70, 60, 90, 110, 120],
				backgroundColor: 'hsl(160, 30%, 40%)',
				borderColor: 'hsl(160, 35%, 35%)'
			}
		]
	});

	function getActivityIcon(type: string) {
		switch (type) {
			case 'feedback_new':
				return MessageSquare;
			case 'feedback_reply':
				return Reply;
			case 'feedback_resolved':
				return CheckCircle2;
			default:
				return MessageCircle;
		}
	}
</script>

<svelte:head>
	<title>Admin Dashboard</title>
</svelte:head>

<div class="dashboard">
	<header class="dashboard-header">
		<h1>Dashboard</h1>
		<p class="subtitle">Welcome back, {$session.data?.user?.name || 'Admin'}</p>
	</header>

	<!-- Stats Grid -->
	<div class="stats-grid">
		<div class="stat-card">
			<div class="stat-icon users">
				<Users size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{stats.totalUsers}</p>
				<p class="stat-label">Total Users</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon products">
				<Package size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{stats.totalProducts}</p>
				<p class="stat-label">Total Products</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon feedback">
				<MessageCircle size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{stats.pendingFeedback}</p>
				<p class="stat-label">Pending Feedback</p>
			</div>
		</div>

		<div class="stat-card">
			<div class="stat-icon subscriptions">
				<CreditCard size={20} strokeWidth={1.75} />
			</div>
			<div class="stat-content">
				<p class="stat-value">{stats.activeSubscriptions}</p>
				<p class="stat-label">Active Subscriptions</p>
			</div>
		</div>
	</div>

	<!-- Charts Grid -->
	<div class="charts-grid">
		<div class="chart-card">
			<h2>Weekly Overview</h2>
			<div class="chart-container">
				<Chart data={weeklyChartData} />
			</div>
		</div>

		<div class="chart-card">
			<h2>Monthly New Subscribers</h2>
			<div class="chart-container">
				<Chart data={monthlyUserData} type="bar" />
			</div>
		</div>
	</div>

	<!-- Recent Activity -->
	<div class="activity-card">
		<h2>Recent Feedback Activity</h2>
		<div class="activity-list">
			{#each recentActivity as activity}
				{@const IconComponent = getActivityIcon(activity.type)}
				<div class="activity-item">
					<div class="activity-icon" class:new={activity.type === 'feedback_new'} class:reply={activity.type === 'feedback_reply'} class:resolved={activity.type === 'feedback_resolved'}>
						<IconComponent size={16} strokeWidth={2} />
					</div>
					<div class="activity-content">
						<p class="activity-title">{activity.title}</p>
						<p class="activity-time">{activity.time}</p>
					</div>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.dashboard {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.dashboard-header h1 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.875rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}

	.subtitle {
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
		margin-top: 0.25rem;
	}

	/* Stats Grid */
	.stats-grid {
		display: grid;
		grid-template-columns: repeat(1, 1fr);
		gap: 1rem;
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

	.stat-icon.users {
		background-color: hsl(160, 30%, 90%);
		color: hsl(160, 30%, 35%);
	}

	.stat-icon.products {
		background-color: hsl(42, 75%, 90%);
		color: hsl(42, 75%, 35%);
	}

	.stat-icon.feedback {
		background-color: hsl(5, 72%, 92%);
		color: hsl(5, 72%, 42%);
	}

	.stat-icon.subscriptions {
		background-color: hsl(220, 60%, 92%);
		color: hsl(220, 60%, 45%);
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

	/* Charts Grid */
	.charts-grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 1.5rem;
	}

	@media (min-width: 1024px) {
		.charts-grid {
			grid-template-columns: repeat(2, 1fr);
		}
	}

	.chart-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
	}

	.chart-card h2 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}

	.chart-container {
		height: 16rem;
	}

	/* Activity Card */
	.activity-card {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1.25rem;
		background-color: hsl(var(--card));
		border: 1px solid hsl(var(--border));
		border-radius: 0.75rem;
	}

	.activity-card h2 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.125rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}

	.activity-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.activity-item {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		padding: 0.75rem;
		border-radius: 0.5rem;
		transition: background-color 150ms ease;
	}

	.activity-item:hover {
		background-color: hsl(var(--muted) / 0.5);
	}

	.activity-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2rem;
		height: 2rem;
		border-radius: 50%;
		flex-shrink: 0;
	}

	.activity-icon.new {
		background-color: hsl(220, 60%, 92%);
		color: hsl(220, 60%, 45%);
	}

	.activity-icon.reply {
		background-color: hsl(160, 30%, 90%);
		color: hsl(160, 30%, 35%);
	}

	.activity-icon.resolved {
		background-color: hsl(142, 60%, 90%);
		color: hsl(142, 70%, 35%);
	}

	.activity-content {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
		min-width: 0;
	}

	.activity-title {
		font-size: 0.875rem;
		color: hsl(var(--foreground));
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}

	.activity-time {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	@media (min-width: 640px) {
		.activity-content {
			flex-direction: row;
			justify-content: space-between;
			align-items: center;
		}

		.activity-title {
			flex: 1;
		}

		.activity-time {
			flex-shrink: 0;
		}
	}

	/* Dark mode adjustments */
	:global(.dark) .stat-icon.users {
		background-color: hsl(160, 30%, 20%);
		color: hsl(160, 35%, 55%);
	}

	:global(.dark) .stat-icon.products {
		background-color: hsl(42, 50%, 20%);
		color: hsl(42, 70%, 55%);
	}

	:global(.dark) .stat-icon.feedback {
		background-color: hsl(5, 50%, 20%);
		color: hsl(5, 65%, 55%);
	}

	:global(.dark) .stat-icon.subscriptions {
		background-color: hsl(220, 50%, 20%);
		color: hsl(220, 60%, 60%);
	}

	:global(.dark) .activity-icon.new {
		background-color: hsl(220, 50%, 25%);
		color: hsl(220, 60%, 65%);
	}

	:global(.dark) .activity-icon.reply {
		background-color: hsl(160, 30%, 20%);
		color: hsl(160, 35%, 55%);
	}

	:global(.dark) .activity-icon.resolved {
		background-color: hsl(142, 40%, 20%);
		color: hsl(142, 60%, 55%);
	}
</style>
