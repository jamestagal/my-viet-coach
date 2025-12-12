<script lang="ts">
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { PUBLIC_PROJECT_NAME } from '$env/static/public';
	import { PanelLeftClose, PanelLeft, Settings, ArrowLeft } from 'lucide-svelte';
	import { SideNavigation } from '$lib/components/ui/side-navigation';
	import { MenuLink } from '$lib/components/ui/menu-link';
	import { userLinks } from '$lib/config/userNavigation';
	import { adminLinks, backToAppLink } from '$lib/config/adminNavigation';
	import { UserMenu } from '$lib/components/dynamic';
	import VietLogo from '$lib/components/icons/VietLogo.svelte';

	let { children, data } = $props();

	let sideNavRef = $state<{ toggle: () => void }>();
	let isSideNavOpen = $state(true);
	let isMobile = $state(false);

	// Check if user is admin
	let isAdmin = $derived(data.user?.role === 'admin');

	// Check if currently in admin section (using $app/state for Svelte 5 reactivity)
	let isInAdminSection = $derived(page.url.pathname.startsWith('/admin'));

	// Determine which links to show
	let currentLinks = $derived(isInAdminSection ? adminLinks : userLinks);

	onMount(() => {
		checkMobile();
		window.addEventListener('resize', checkMobile);
		return () => window.removeEventListener('resize', checkMobile);
	});

	function checkMobile() {
		isMobile = window.innerWidth < 768;
		if (isMobile && isSideNavOpen) {
			isSideNavOpen = false;
		}
	}

	function closeSidebarOnMobile() {
		if (isMobile && isSideNavOpen) {
			sideNavRef?.toggle();
		}
	}
</script>

<div class="app-layout">
	<!-- Top Navigation Bar -->
	<nav class="app-topbar">
		<div class="topbar-left">
			<button type="button" class="toggle-btn" onclick={() => sideNavRef?.toggle()}>
				{#if isSideNavOpen}
					<PanelLeftClose size={20} strokeWidth={1.5} />
				{:else}
					<PanelLeft size={20} strokeWidth={1.5} />
				{/if}
			</button>
			<a href="/dashboard" class="logo-link">
				<VietLogo size={32} />
				<span class="logo-text">{PUBLIC_PROJECT_NAME}</span>
			</a>
		</div>
		<div class="topbar-right">
			<UserMenu />
		</div>
	</nav>

	<!-- Main Content Area with Sidebar -->
	<div class="app-body">
		<!-- Mobile overlay backdrop -->
		{#if isMobile && isSideNavOpen}
			<button
				type="button"
				class="sidebar-overlay"
				onclick={closeSidebarOnMobile}
				aria-label="Close sidebar"
			></button>
		{/if}

		<SideNavigation bind:this={sideNavRef} bind:isSideNavOpen>
			<div class="sidebar-content">
				{#if isInAdminSection}
					<div class="sidebar-header">
						<span class="sidebar-title">Admin Panel</span>
					</div>
				{/if}

				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<nav class="sidebar-nav" onclick={closeSidebarOnMobile}>
					{#each currentLinks as link (link.href)}
						<MenuLink {link} />
					{/each}
				</nav>

				{#if isAdmin}
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<div class="sidebar-footer" onclick={closeSidebarOnMobile}>
						{#if isInAdminSection}
							<MenuLink link={backToAppLink} />
						{:else}
							<MenuLink link={{ label: 'Admin', href: '/admin/dashboard', icon: Settings }} />
						{/if}
					</div>
				{/if}
			</div>
		</SideNavigation>

		<main class="app-main">
			<div class="app-content">
				{@render children()}
			</div>
		</main>
	</div>
</div>

<style>
	.app-layout {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
		background-color: hsl(var(--background));
	}

	/* Top Navigation Bar */
	.app-topbar {
		position: sticky;
		top: 0;
		z-index: 40;
		display: flex;
		align-items: center;
		justify-content: space-between;
		height: 3.5rem;
		padding: 0 1rem;
		background-color: hsl(var(--background) / 0.95);
		backdrop-filter: blur(8px);
		border-bottom: 1px solid hsl(var(--border));
	}

	.topbar-left {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.topbar-right {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.toggle-btn {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.5rem;
		border-radius: 0.5rem;
		color: hsl(var(--muted-foreground));
		cursor: pointer;
		transition: all 150ms ease;
		flex-shrink: 0;
	}

	.toggle-btn:hover {
		background-color: hsl(var(--muted));
		color: hsl(var(--foreground));
	}

	.logo-link {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		text-decoration: none;
	}

	.logo-text {
		font-weight: 600;
		font-size: 1.125rem;
		color: hsl(var(--foreground));
	}

	/* Main Body with Sidebar */
	.app-body {
		display: flex;
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	/* Mobile overlay */
	.sidebar-overlay {
		display: none;
	}

	/* Sidebar Content */
	.sidebar-content {
		position: fixed;
		display: flex;
		flex-direction: column;
		width: 15rem;
		height: calc(100vh - 3.5rem);
		padding: 1rem;
		background-color: hsl(var(--card));
		border-right: 1px solid hsl(var(--border));
		overflow-y: auto;
		z-index: 30;
	}

	.sidebar-header {
		margin-bottom: 1rem;
		padding-bottom: 0.75rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.sidebar-title {
		font-family: 'Cormorant Garamond', Georgia, serif;
		font-size: 1rem;
		font-weight: 600;
		color: hsl(var(--foreground));
	}

	.sidebar-nav {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		flex: 1;
	}

	.sidebar-footer {
		margin-top: auto;
		padding-top: 1rem;
		border-top: 1px solid hsl(var(--border));
	}

	/* Main Content */
	.app-main {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow-x: hidden;
		overflow-y: auto;
		width: 100%;
	}

	.app-content {
		flex: 1;
		padding: 1.5rem 2rem;
		max-width: 80rem;
		width: 100%;
	}

	/* Mobile styles */
	@media (max-width: 768px) {
		.app-topbar {
			padding: 0 0.75rem;
		}

		.logo-text {
			display: none;
		}

		.app-content {
			padding: 1rem;
		}

		.sidebar-overlay {
			display: block;
			position: fixed;
			inset: 0;
			top: 3.5rem;
			background-color: hsl(var(--foreground) / 0.4);
			z-index: 25;
			cursor: pointer;
			border: none;
		}

		.sidebar-content {
			width: 16rem;
			box-shadow: 4px 0 24px hsl(var(--foreground) / 0.15);
		}
	}
</style>
