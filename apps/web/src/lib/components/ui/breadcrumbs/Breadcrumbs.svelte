<script>   
    import { page } from '$app/state';
    let { data, home = "/", canVisit = true, children } = $props();
    let currentUrl = $derived(page.url.pathname);
    let breadcrumbs = $derived(currentUrl.split('/').filter(Boolean));

    let breadcrumbLinks = $derived(
        breadcrumbs.map((breadcrumb, i) => ({
            href: '/' + breadcrumbs.slice(0, i + 1).join('/'),
            name: breadcrumb
        }))
    );

</script>

<div class="flex flex-row items-center gap-1">
    <a href={home} aria-label="Home">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" 
        fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        </svg> 
    </a>
    <span class="text-secondary-4 text-xs">{home === currentUrl ? '' : '/'}</span>
    
    {#each breadcrumbLinks as breadcrumb}
        <a href={breadcrumb.href} class="text-sm capitalize">
            <span class={breadcrumb.href === currentUrl ? 'text-secondary font-semibold' : 'text-secondary-4'}>{breadcrumb.name}</span>
        </a>
        <span class="text-secondary-4 text-xs">{breadcrumb.href === currentUrl ? '' : '/'}</span>
    {/each}
</div>