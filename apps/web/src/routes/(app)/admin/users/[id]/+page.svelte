<script>
    import { page } from '$app/stores';
    import { onMount } from 'svelte';
    import { authClient } from '$lib/actions/authClient';
    import { toast } from '@components/toast';
    import { goto, invalidate } from '$app/navigation';
    import { ToolBox } from '@components/toolbox';
    import { Modal } from '@components/model';
    import { ChevronLeft, UserRound, LogOut, Ban, CircleCheck, UserCog, List, Monitor, Smartphone, Globe, Tablet, TriangleAlert, CreditCard, EllipsisVertical } from 'lucide-svelte';
    // Import UA Parser correctly and dayjs
    import * as UAParserModule from 'ua-parser-js';
    const UAParser = UAParserModule.UAParser;
    
    import dayjs from 'dayjs';
    import relativeTime from 'dayjs/plugin/relativeTime';
    
    // Initialize dayjs plugins
    dayjs.extend(relativeTime);

    const session = authClient.useSession();
    let userData = $state(null);
    let sessions = $state([]);
    let subscriptions = $state([]);
    let isLoadingUser = $state(true);
    let isLoadingSessions = $state(true);
    let isLoadingSubscriptions = $state(true);
    let userMetrics = $state({
        totalSessions: 0,
        lastActive: null,
        joinedAt: null
    });
    let deleteUserModal = $state(false);

    let userId = $derived($page.params?.id);

    // Format date helper with dayjs
    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        return dayjs(dateString).format('YYYY-MM-DD HH:mm:ss');
    }

    // Time ago formatter with dayjs
    function timeAgo(dateString) {
        if (!dateString) return 'N/A';
        return dayjs(dateString).fromNow();
    }

    async function fetchUserData() {
        isLoadingUser = true;
        try {
            const response = await authClient.admin.listUsers({ query: { filterField: 'id', filterValue: userId, filterOperator: 'eq' } });

            if (response.error) {
                if(response.status === 401) {
                    $session.refetch()
                    invalidate('admin:layout')
                } else {
                    throw new Error(response.error.message);
                }
            }
            userData = response.data?.users?.[0] || response;
            
            // Extract additional metrics if available
            if (userData) {
                userMetrics.joinedAt = userData.createdAt || userData.joinedAt;
                userMetrics.lastActive = userData.lastLoginAt || userData.updatedAt;
            }
        } catch (err) {
            console.error('Failed to fetch user:', err);
            toast.error('Failed to load user data.');
            userData = null;
        } finally {
            isLoadingUser = false;
        }
    }

    async function fetchUserSessions() {
        isLoadingSessions = true;
        try {
            const response = await authClient.admin.listUserSessions({ userId });
            if (response.error) throw new Error(response.error.message);
            
            // Parse user agent details with ua-parser-js
            const rawSessions = response.data?.sessions || response.sessions || [];
            sessions = rawSessions.map(session => {
                const parser = new UAParser(session.userAgent);
                const browser = parser.getBrowser();
                const os = parser.getOS();
                const device = parser.getDevice();
                
                return {
                    ...session,
                    browser: browser.name ? `${browser.name} ${browser.version || ''}` : 'Unknown',
                    browserName: browser.name || 'Unknown',
                    browserVersion: browser.version || '',
                    os: os.name ? `${os.name} ${os.version || ''}` : 'Unknown',
                    osName: os.name || 'Unknown',
                    osVersion: os.version || '',
                    device: device.model ? `${device.vendor || ''} ${device.model}` : (device.type || 'Desktop'),
                    deviceType: device.type || 'Desktop',
                    displayDevice: device.type === 'mobile' ? 'Mobile' : 
                                 device.type === 'tablet' ? 'Tablet' : 'Desktop'
                };
            });
            
            // Sort sessions by creation date (newest first)
            sessions.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            
            // Update metrics
            userMetrics.totalSessions = sessions.length;
            if (sessions.length > 0) {
                const mostRecent = sessions.reduce((latest, session) => 
                    new Date(session.createdAt) > new Date(latest.createdAt) ? session : latest, sessions[0]);
                userMetrics.lastActive = mostRecent.createdAt;
            }
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
            toast.error('Failed to load user sessions.');
            sessions = [];
        } finally {
            isLoadingSessions = false;
        }
    }

    async function fetchUserSubscriptions() {
        isLoadingSubscriptions = true;
        try {
            const response = await fetch(`/api/private/admin/subscriptions?userId=${userId}`);
            if (!response.ok) throw new Error(response.statusText);
            const data = await response.json();
            subscriptions = data?.subscriptions || [];
        } catch (err) {
            console.error('Failed to fetch subscriptions:', err);
            toast.error('Failed to load user subscriptions.');
            subscriptions = [];
        } finally {
            isLoadingSubscriptions = false;
        }
    }

    // --- Action Functions --- (Implement these based on docs)

    async function handleRevokeSession(sessionToken) {
        if (!confirm('Are you sure you want to revoke this session?')) return;
        try {
            await authClient.admin.revokeUserSession({ sessionToken });
            toast.success('Session revoked successfully.');
            fetchUserSessions(); // Refresh sessions list
        } catch (err) {
            console.error('Failed to revoke session:', err);
            toast.error('Failed to revoke session.');
        }
    }

    async function handleRevokeAllSessions() {
        if (!confirm('Are you sure you want to revoke ALL sessions for this user?')) return;
        try {
            await authClient.admin.revokeUserSessions({ userId });
            toast.success('All sessions revoked successfully.');
            fetchUserSessions(); // Refresh sessions list
        } catch (err) {
            console.error('Failed to revoke all sessions:', err);
            toast.error('Failed to revoke all sessions.');
        }
    }

    async function handleSetRole(newRole) {
        // Basic implementation: Prompt for role
        const roleInput = prompt('Enter new role (e.g., admin, user): ', userData?.role || 'user');
        if (!roleInput) return; // User cancelled
        const role = roleInput.trim();

        if (!role) {
            toast.error('Role cannot be empty.');
            return;
        }

        try {
            await authClient.admin.setRole({ userId, role });
            toast.success(`User role updated to ${role}.`);
            fetchUserData(); // Refresh user data
        } catch (err) {
            console.error('Failed to set role:', err);
            toast.error('Failed to update user role.');
        }
    }

    async function handleBanUser() {
        const reason = prompt('Enter ban reason (optional):') || undefined;
        const durationStr = prompt('Enter ban duration in seconds (optional, leave blank for permanent):') || undefined;
        const duration = durationStr ? parseInt(durationStr, 10) : undefined;

        if (durationStr && isNaN(duration)) {
            toast.error('Invalid duration. Please enter a number of seconds.');
            return;
        }
        if (!confirm(`Are you sure you want to ban this user?${reason ? ` Reason: ${reason}` : ''}${duration ? ` Duration: ${duration}s` : ''}`)) return;

        try {
            await authClient.admin.banUser({
                userId,
                banReason: reason,
                banExpiresIn: duration,
            });
            toast.success('User banned successfully.');
            fetchUserData(); // Refresh user data to show ban status
            fetchUserSessions(); // Ban revokes sessions
        } catch (err) {
            console.error('Failed to ban user:', err);
            toast.error('Failed to ban user.');
        }
    }

    async function handleUnbanUser() {
        try {
            await authClient.admin.unbanUser({ userId });
            toast.success('User unbanned successfully.');
            fetchUserData(); // Refresh user data
        } catch (err) {
            console.error('Failed to unban user:', err);
            toast.error('Failed to unban user.');
        }
    }



    async function handleImpersonate() {
        try {
            let { data, error } = await authClient.admin.impersonateUser({ userId })

            if(error) {
                throw new Error(error.message)
            }
            if(data) {
                toast.success('Success! Now acting as ' + userData.name)
                await goto(`/dashboard`)
                await $session.refetch()
                invalidate('admin:layout')
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to impersonate user')
        }
    }

     async function handleDeleteUser() {
        if (!confirm('Are you sure you want to PERMANENTLY DELETE this user? This action cannot be undone.')) return;
        try {
            await authClient.admin.removeUser({ userId });
            toast.success('User deleted successfully.');
            goto('/admin/users'); // Redirect back to the list
        } catch (err) {
            console.error('Failed to delete user:', err);
            toast.error('Failed to delete user.');
        }
    }

    // Fetch data when the component mounts or userId changes
    onMount(() => {
        if (userId) {
            fetchUserData();
            fetchUserSessions();
            fetchUserSubscriptions();
        } else {
            isLoadingUser = false;
            isLoadingSessions = false;
            isLoadingSubscriptions = false;
        }
    });

</script>

<svelte:head>
    <title>{userData?.name || 'User Details'} | Admin</title>
</svelte:head>

<div class="flex flex-col gap-6 w-full max-w-8xl">
    <div class="flex flex-row justify-between w-full items-center">
        <a href="/admin/users" class="flex items-center gap-1 text-fade hover:text-current transition-colors">
            <ChevronLeft size={16} />
            <span>all users</span>
        </a>
    </div>

    <div class="card p-6">
    {#if isLoadingUser}
             <div class="flex justify-center mt-4">
                 <div class="animate-spin h-6 w-6 border-3 border-primary-3 border-t-secondary-4 rounded-full"></div>
            </div>
    {:else if !isLoadingUser && !userData}
            <div class="mt-4">
                <a href="/admin/users" class="button action">Return to User List</a>
            </div>
    {:else if userData}
        <!-- User Details Card -->
            <div class="flex flex-col gap-6 items-start">
                <!-- Avatar section -->
                
                
                <!-- Info -->
                <div class="flex flex-col w-full flex-grow">
                        <div class="flex flex-row justify-between items-start w-full">
                          <div class="flex flex-row gap-3">  
                            <div class="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center overflow-hidden shrink-0">
                                {#if userData.image}
                                    <img
                                        src={userData.image}
                                        alt={userData.name || userData.email}
                                        class="w-full h-full object-cover"
                                    />
                                {:else}
                                    <span class="text-3xl font-medium  text-secondary-4">
                                        {(userData.name || userData.email || '?').charAt(0).toUpperCase()}
                                    </span>
                                {/if}
                            </div>
                            <div class="flex flex-col justify-center gap-1">
                                <h1 class="font-bold">{userData.name || 'Unnamed User'}</h1>
                                <div class="flex items-center gap-1 text-secondary-4">
                                    <p>{userData.email}</p>
                                </div>
                            </div>
                         </div>
                        <ToolBox position="left" closeOnClick={true}>
                            {#snippet trigger()}
                               <EllipsisVertical size={24} />
                            {/snippet}
                       
                            <div class="flex flex-col gap-2 p-2">
                                    <button class="button menu w-full" onclick={handleImpersonate} title="Impersonate User">
                                        <UserRound size={16} />
                                        <span>Impersonate</span>
                                </button>
                                {#if userData.banned}
                                    <button class="button menu w-full" onclick={handleUnbanUser} title="Unban User">
                                        <CircleCheck size={16} />
                                        <span>Unban</span>
                                    </button>
                                {:else}
                                    <button class="button menu w-full" onclick={handleBanUser} title="Ban User">
                                        <Ban size={16} />
                                        <span>Ban</span>
                                    </button>
                                {/if}
                                <button class="button menu w-full" onclick={handleSetRole} title="Set User Role">
                                    <UserCog size={16} />
                                    <span>Set Role</span>
                                </button>
                            </div>
                        </ToolBox>
                    </div>
                    
                    <!-- User status badges -->
                    <div class="flex flex-wrap gap-2 my-4 text-sm">
                        <span class="badge {userData.emailVerified ? 'bg-success' : 'bg-warning'}">
                            Email {userData.emailVerified ? 'Verified' : 'Not Verified'}
                        </span>
                        <span class="capitalize badge {userData.role === 'admin' ? 'bg-danger' : 'bg-muted'}">
                            {userData.role || 'user'}
                        </span>
                        {#if userData.banned}
                            <span class="badge bg-danger">
                                <Ban size={12} class="mr-1" />
                                Banned {userData.banReason ? `(${userData.banReason})` : ''}
                                {#if !userData.banExpires} <!-- Check if ban is effectively permanent -->
                                    (Permanent)
                                {:else}
                                    until {new Date(userData.banExpires).toLocaleString()}
                                {/if}
                            </span>
                        {/if}
                    </div>
                    
                    <!-- User metrics -->
                    <div class="flex flex-col gap-2 text-xs text-secondary-4">
                            <div>ID: {userData.id}</div>
                            <div>Joined: {userMetrics.joinedAt ? formatDate(userMetrics.joinedAt) : 'Unknown'}</div>
                            <div>Last Active: {userMetrics.lastActive ? formatDate(userMetrics.lastActive) : 'Unknown'}</div>
                    </div>
                </div>
                
                
            </div>
       
    {/if}
</div>
       <!-- Sessions Card -->
       <div class="card overflow-hidden">
        <div class="p-4 border-b border-border flex justify-between items-center bg-muted">
            <div class="flex items-center gap-2">
                <List size={18} />
                <h2 class="text-lg font-semibold">Active Sessions ({sessions.length})</h2>
            </div>
            {#if sessions.length > 0}
                <button class="button danger gap-1 p-2 text-sm" onclick={handleRevokeAllSessions} title="Revoke All Sessions">
                    <LogOut size={18} />
                    <span>Revoke All</span>
                </button>
            {/if}
        </div>
        {#if isLoadingSessions}
                <div class="flex justify-center p-6">
                    <div class="animate-spin h-5 w-5 border-3 border-border border-t-muted-foreground rounded-full"></div>
                </div>
        {:else if sessions.length === 0}
                <p class="p-8 text-center text-secondary-4">No active sessions found for this user.</p>
        {:else}
            <!-- Sessions as cards for better display -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {#each sessions as session (session.token)}
                    <div class="bg-muted rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border/50">
                        <div class="p-3 border-b border-border/50 flex items-center justify-between">
                            <div class="flex items-center gap-2">
                                <Globe size={16} />
                                <span class="font-medium text-sm truncate" title={session.browser}>
                                    {session.browser}
                                </span>
                            </div>
                            <div class="text-primary-accent">
                                {#if session.displayDevice === 'Mobile'}
                                    <Smartphone size={16} />
                                {:else if session.displayDevice === 'Tablet'}
                                    <Tablet size={16} />
                                {:else}
                                    <Monitor size={16} />
                                {/if}
                            </div>
                        </div>
                        
                        <div class="p-3">
                            <div class="grid grid-cols-2 gap-1 text-xs mb-3">
                                <div>
                                    <div class="text-secondary-4">Created</div>
                                    <div title={formatDate(session.createdAt)}>{timeAgo(session.createdAt)}</div>
                                </div>
                                <div>
                                    <div class="text-secondary-4">Expires</div>
                                    <div title={formatDate(session.expiresAt)}>{timeAgo(session.expiresAt)}</div>
                                </div>
                                <div class="col-span-2 mt-2">
                                    <div class="text-secondary-4">IP Address</div>
                                    <div>{session.ipAddress || 'N/A'}</div>
                                </div>
                                <div class="col-span-2 mt-2">
                                    <div class="text-secondary-4">Operating System</div>
                                    <div>{session.os}</div>
                                </div>
                                <div class="col-span-2 mt-2">
                                    <div class="text-secondary-4">Device</div>
                                    <div>{session.device}</div>
                                </div>
                            </div>
                            
                            <div class="mt-3 flex justify-end">
                                <button class="button danger gap-1 p-2 text-xs w-full" onclick={() => handleRevokeSession(session.token)} title="Revoke this session">
                                    <LogOut size={14} />
                                    <span>Revoke Session</span>
                                </button>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

        <div class="card overflow-hidden">
        <div class="p-4 border-b border-border/50 flex justify-between items-center bg-muted">
            <div class="flex items-center gap-2">
                <CreditCard size={18} />
                <h2 class="text-lg font-semibold">Subscriptions ({subscriptions.length})</h2>
            </div>
        </div>
            <div class="p-4">
                {#if isLoadingSubscriptions}
                    <div class="flex justify-center items-center p-4">
                         <div class="animate-spin h-5 w-5 border-3 border-primary-3 border-t-secondary-4 rounded-full mr-2"></div>
                        <span>Loading subscriptions...</span>
                    </div>
                {:else}
                    <!-- Subscriptions Grid -->
                    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {#each subscriptions as subscription (subscription._id)}
                            <div class="bg-muted rounded-lg shadow-sm hover:shadow-md transition-shadow overflow-hidden border border-border/50 text-sm">
                                <div class="p-3 border-b border-border/50 flex items-center justify-between">
                                    <span class="font-medium capitalize truncate" title="{subscription.plan} Plan">{subscription.plan}</span>
                                    <span class="badge {subscription.status === 'active' ? 'green' : 'yellow'} capitalize shrink-0">{subscription.status}</span>
                                </div>
                                
                                <div class="p-3 space-y-1.5 text-xs text-secondary-4">
                                    <div>ID: <code class="text-xs bg-muted/50 px-1 rounded">{subscription._id}</code></div>
                                    {#if subscription.productId}
                                        <div>Product ID: <code class="text-xs bg-muted/50 px-1 rounded">{subscription.productId}</code></div>
                                    {/if}
                                    {#if subscription.polarProductId}
                                        <div>Polar Product ID: <code class="text-xs bg-muted/50 px-1 rounded">{subscription.polarProductId}</code></div>
                                    {/if}
                                    {#if subscription.polarCustomerId}
                                        <div>Polar Customer ID: <code class="text-xs bg-muted/50 px-1 rounded">{subscription.polarCustomerId}</code></div>
                                    {/if}
                                    <div>Created: <span title={formatDate(subscription.createdAt)}>{timeAgo(subscription.createdAt)}</span></div>
                                    <div>Updated: <span title={formatDate(subscription.updatedAt)}>{timeAgo(subscription.updatedAt)}</span></div>
                                    {#if subscription.cancelAtPeriodEnd}
                                        <div class="text-warning font-medium pt-1">Cancels at period end</div>
                                    {/if}
                                </div>
                            </div>
                        {:else}
                            <p class="text-secondary-4">No subscriptions found for this user.</p>
                        {/each}
                    </div>
                {/if}
            </div>
        </div>

        <div class="card overflow-hidden">
            <div class="p-4 border-b border-border/50 flex justify-between items-center bg-muted">
                <div class="flex items-center gap-2">
                    <TriangleAlert size={18} color="red" />
                    <h2 class="text-lg font-semibold">Danger Zone</h2>
                </div>
            </div>
        {#if userData?.id}
        <div class="p-4 flex flex-col gap-2">
            <p>Deleting this user will remove all data associated with them. This action cannot be undone.</p>
            <button class="button danger p-2 place-self-end" onclick={() => deleteUserModal = true}>Delete User</button>
        </div>
        {:else if isLoadingUser}
        <div class="p-4 flex flex-col gap-2">
            <p>Loading user data...</p>
        </div>
        {/if}
        <!-- Delete User Modal -->
            <Modal bind:isOpen={deleteUserModal} title="Confirm User Deletion" onClose={() => deleteUserModal = false}>
                <div class="flex flex-col gap-2 p-4">
                    <p>Are you sure you want to delete this user? This action cannot be undone.</p>
                    <button class="button danger p-2 place-self-end" onclick={handleDeleteUser}>Delete User</button>
                </div>
            </Modal>
        </div>
</div> 