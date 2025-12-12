<script lang="ts">
	import type { ComponentType, Snippet } from 'svelte';

	interface Props {
		title: string;
		subtitle?: string;
		icon?: ComponentType;
		children?: Snippet;
	}

	let { title, subtitle, icon: Icon, children }: Props = $props();
</script>

<header class="page-header">
	<div class="header-content">
		{#if Icon}
			<div class="header-icon">
				<Icon size={24} strokeWidth={1.5} />
			</div>
		{/if}
		<div class="header-text">
			<h1>{title}</h1>
			{#if subtitle}
				<p class="subtitle">{subtitle}</p>
			{/if}
		</div>
	</div>
	<div class="header-actions">
		{#if children}
			{@render children()}
		{/if}
	</div>
</header>

<style>
	.page-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 2rem;
		padding-bottom: 1.5rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.header-content {
		display: flex;
		align-items: flex-start;
		gap: 1rem;
	}

	.header-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 3rem;
		height: 3rem;
		border-radius: 0.75rem;
		background: linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05));
		color: hsl(var(--primary));
		flex-shrink: 0;
	}

	.header-text h1 {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.75rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
		line-height: 1.2;
	}

	.subtitle {
		font-size: 0.875rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.25rem;
	}

	.header-actions {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-shrink: 0;
	}

	@media (max-width: 640px) {
		.page-header {
			flex-direction: column;
			align-items: stretch;
		}

		.header-actions {
			margin-top: 1rem;
		}
	}
</style>
