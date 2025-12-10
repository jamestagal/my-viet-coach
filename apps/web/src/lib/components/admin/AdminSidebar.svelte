<script lang="ts">
	import { PanelLeftClose, PanelLeft } from 'lucide-svelte';
	import AdminMenuLink from './AdminMenuLink.svelte';
	import { adminLinks, backToAppLink } from '$lib/config/adminNavigation';

	let { isOpen = $bindable(true) }: { isOpen?: boolean } = $props();

	function toggle() {
		isOpen = !isOpen;
	}
</script>

<aside
	class="admin-sidebar"
	class:collapsed={!isOpen}
>
	<div class="sidebar-header">
		<div class="logo-section">
			{#if isOpen}
				<span class="logo-text">Admin</span>
			{/if}
		</div>
		<button
			type="button"
			class="toggle-btn"
			onclick={toggle}
			aria-label={isOpen ? 'Collapse sidebar' : 'Expand sidebar'}
		>
			{#if isOpen}
				<PanelLeftClose size={20} strokeWidth={1.5} />
			{:else}
				<PanelLeft size={20} strokeWidth={1.5} />
			{/if}
		</button>
	</div>

	{#if isOpen}
		<nav class="sidebar-nav">
			<div class="nav-section">
				{#each adminLinks as link}
					<AdminMenuLink {link} />
				{/each}
			</div>

			<div class="nav-section nav-footer">
				<div class="divider"></div>
				<AdminMenuLink link={backToAppLink} />
			</div>
		</nav>
	{/if}
</aside>

<style>
	.admin-sidebar {
		display: flex;
		flex-direction: column;
		width: 16rem;
		min-height: 100vh;
		background-color: hsl(var(--card));
		border-right: 1px solid hsl(var(--border));
		transition: width 200ms ease;
	}

	.admin-sidebar.collapsed {
		width: 3.5rem;
	}

	.sidebar-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.logo-section {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.logo-text {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1.25rem;
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: 0.375rem;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition: all 150ms ease;
	}

	.toggle-btn:hover {
		background-color: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		flex: 1;
		padding: 1rem;
		justify-content: space-between;
	}

	.nav-section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.nav-footer {
		margin-top: auto;
	}

	.divider {
		height: 1px;
		background-color: hsl(var(--border));
		margin: 0.75rem 0;
	}
</style>
