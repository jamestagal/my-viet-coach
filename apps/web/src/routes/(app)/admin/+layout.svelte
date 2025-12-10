<script lang="ts">
	import { Breadcrumbs } from '$lib/components/ui/breadcrumbs';

	let { children } = $props();
</script>

<!-- Admin section just adds breadcrumbs - sidebar is handled by parent (app) layout -->
<div class="admin-wrapper">
	<div class="admin-breadcrumbs">
		<Breadcrumbs home="/admin/dashboard" />
	</div>
	{@render children()}
</div>

<style>
	.admin-wrapper {
		width: 100%;
	}

	.admin-breadcrumbs {
		margin-bottom: 1rem;
	}
</style>
