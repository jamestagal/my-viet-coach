<script lang="ts">
	import { page } from '$app/state';
	import type { NavLink } from '$lib/config/adminNavigation';

	let { link }: { link: NavLink } = $props();

	let currentPath = $derived(page.url.pathname);
	let isActive = $derived(currentPath === link.href || currentPath.startsWith(link.href + '/'));

	const Icon = link.icon;
</script>

<a
	href={link.href}
	class="admin-nav-link"
	class:active={isActive}
	class:disabled={link.disabled}
	aria-current={isActive ? 'page' : undefined}
>
	<Icon size={18} strokeWidth={1.75} />
	<span>{link.label}</span>
</a>

<style>
	.admin-nav-link {
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.75rem;
		padding: 0.625rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(var(--foreground) / 0.7);
		transition: all 150ms ease;
	}

	.admin-nav-link:hover:not(.disabled) {
		background-color: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.admin-nav-link.active {
		background-color: hsl(var(--primary) / 0.1);
		color: hsl(var(--primary));
		font-weight: 600;
	}

	.admin-nav-link.disabled {
		opacity: 0.5;
		pointer-events: none;
		cursor: not-allowed;
	}
</style>
