<script>
    import { onMount } from 'svelte';
    import { authClient } from '$lib/actions/authClient';
    import { ToolBox } from '$lib/components/ui/toolbox';
    import { toast } from '$lib/components/ui/toast';
    import { EllipsisVertical, UserRound, UserRoundCog, ChevronLeft, ChevronRight, Check, X, Users } from 'lucide-svelte';
    import AdminPageHeader from '$lib/components/admin/AdminPageHeader.svelte';

    let session = authClient.useSession()
    let users = $state([]);
    let isLoading = $state(true);
    let limit = $state(20); // Limit per page
    let offset = $state(0); // Offset
    let page = $derived(offset / limit + 1); // Current page
    let totalUsers = $state(0); // Total users

    

    onMount(async () => {
        await fetchUsers();
    });


    async function fetchUsers() {
        isLoading = true;
        try {
            const response = await authClient.admin.listUsers({
                query: {
                    limit: limit,
                    offset: offset,
                    sortBy: 'createdAt', // Sort by creation date
                    sortDirection: 'desc' // Newest first
                }
            });

            if(response.error) {
                if(response.status === 401) {
                    $session.refetch()
                    invalidate('admin:layout')
                }
                throw response.error;
            }

            if (response.data && Array.isArray(response.data.users)) {
                // Handle cases where response is nested under 'data'
                users = response.data.users || [];
                totalUsers = response.data.total ?? 0;
            }

        } catch (error) {
            toast.error('Failed to fetch users');
            console.error(error);
            users = [];
            totalUsers = 0;
        } finally {
            isLoading = false;
        }
    }

    // Pagination Logic
    let totalPages = $derived(Math.ceil(totalUsers / limit));

    function changePage(page) {
        offset = (page - 1) * limit;
        fetchUsers();
    }
</script>

<svelte:head>
    <title>Users | Admin</title>
</svelte:head>

<AdminPageHeader
    title="Users"
    subtitle="View and manage user accounts"
    icon={Users}
/>

<div class="card overflow-hidden">
    <div class="overflow-x-auto">
    <table class="w-full min-w-[400px]">
        <thead>
            <tr class="border-b border-primary-2 text-fade text-sm font-medium bg-main">
                <th class="p-2 sm:p-3 text-left">Name</th>
                <th class="p-2 sm:p-3 text-left hidden md:table-cell">Email</th>
                <th class="p-2 sm:p-3 text-left">Status</th>
                <th class="p-2 sm:p-3 text-left hidden sm:table-cell">Role</th>
                <th class="p-2 sm:p-3 text-right">Actions</th>
            </tr>
        </thead>
        <tbody class="divide-y divide-primary-2 {isLoading ? 'opacity-50' : ''}">
            {#each users as userData}
                <tr class="bg-main hover:bg-main/80 transition-colors">
                    <td class="p-2 sm:p-3">
                        <a href={`/admin/users/${userData.id}`} class="flex items-center gap-2 sm:gap-3 text-sm">
                            <div class="hidden sm:flex items-center justify-center w-8 h-8 rounded-full bg-primary-2 overflow-hidden shrink-0">
                                {#if userData.image}
                                    <img
                                        src={userData.image}
                                        alt={userData.name || userData.email}
                                        class="w-full h-full object-cover"
                                    />
                                {:else}
                                    {(userData.name || userData.email || '?').charAt(0).toUpperCase()}
                                {/if}
                            </div>
                            <span class="font-medium truncate max-w-[120px] sm:max-w-none">{userData.name || 'N/A'}</span>
                        </a>
                    </td>
                    <td class="p-2 sm:p-3 hidden md:table-cell">
                        <div class="flex items-center gap-1 text-sm">
                            <span class="truncate max-w-[200px]">{userData.email || 'N/A'}</span>
                            {#if userData.emailVerified}
                                <Check size={14} strokeWidth={3} class="bg-success text-white rounded-full p-[2px] shrink-0" />
                            {:else}
                                <X size={14} strokeWidth={3} class="bg-danger text-white rounded-full p-[2px] shrink-0" />
                            {/if}
                        </div>
                    </td>
                    <td class="p-2 sm:p-3">
                        <span class="badge {userData.banned ? 'bg-danger' : 'bg-success'}">
                            {userData.banned ? 'Banned' : 'Active'}
                        </span>
                    </td>
                    <td class="p-2 sm:p-3 hidden sm:table-cell">
                        <span class="badge {userData.role === 'admin' ? 'bg-primary/10 text-primary' : 'bg-muted'}">
                            {userData.role || 'N/A'}
                        </span>
                    </td>
                    <td class="p-2 sm:p-3 text-right">
                        <ToolBox position="left" closeOnClick={true}>
                            {#snippet trigger()}
                                <EllipsisVertical size={20} />
                            {/snippet}
                            <div class="p-1 min-w-40">
                                <a href={`/admin/users/${userData.id}`} class="button menu w-full">
                                    <UserRoundCog size={20} />
                                    <span>Manage</span>
                                </a>
                            </div>
                        </ToolBox>
                    </td>
                </tr>
            {:else}
                <tr>
                    <td colspan="5" class="p-4 text-center">
                        {#if isLoading}
                            <div class="animate-spin h-6 w-6 border-3 border-primary-3 border-t-secondary-4 rounded-full mx-auto"></div>
                        {:else}
                            <div class="text-sm text-secondary-4">No users found</div>
                        {/if}
                    </td>
                </tr>
            {/each}
        </tbody>
    </table>
    </div>

    {#if totalPages > 1}
        <div class="flex flex-col sm:flex-row justify-between items-center gap-2 p-2 sm:p-3 border-t border-primary">
            <span class="text-xs sm:text-sm text-secondary-4">
                Page {page} of {totalPages} <span class="hidden sm:inline">({totalUsers} users)</span>
            </span>
            <div class="flex gap-2">
                <button class="button p-2 highlight" onclick={() => changePage(page - 1)} disabled={page <= 1 || isLoading}>
                    <ChevronLeft size={18} />
                </button>
                <button class="button p-2 highlight" onclick={() => changePage(page + 1)} disabled={page >= totalPages || isLoading}>
                    <ChevronRight size={18} />
                </button>
            </div>
        </div>
    {/if}
</div>