<script>
    import { page } from '$app/state';
    import { goto, invalidate } from '$app/navigation';
    import { authClient } from '$lib/actions/authClient';
    import { toast } from '$lib/components/ui/toast';
    import { ToolBox } from '$lib/components/ui/toolbox';
    import { Button } from '$lib/components/ui/button';
    import { CreditCard, Settings, LogOut, Ban, ArrowLeftRight, ChevronDown } from 'lucide-svelte';

    const session = authClient.useSession();

    async function handleStopImpersonation() {
        try {
            let { data, error } = await authClient.admin.stopImpersonating({
                impersonatedBy: $session.data?.session?.impersonatedBy
            })
            if (error) {
                throw new Error(error.message)
            }
            if(data) {
                $session.refetch();
                invalidate('app:layout');
                toast.success('Impersonation stopped')
                goto('/dashboard')
            }
        } catch (error) {
            console.error(error)
            toast.error('Failed to stop impersonation')
        }
    }
</script>

    <!-- right container -->
    <div class="flex flex-row items-center gap-2">
        {#if $session.data?.session?.impersonatedBy}
            <span class="badge bg-primary text-primary-foreground">Impersonating</span>
        {/if}
        <ToolBox position="bottom" closeOnClick={true}>
            {#snippet trigger()}
                <div class="flex flex-row items-center gap-2 rounded-xl p-1 hover:bg-muted">
                    {#if $session.data?.user?.image}
                        <img src={$session.data?.user?.image} alt="User Avatar" class="w-8 h-8 rounded-full" />
                    {:else}
                    <div class="flex flex-row rounded-full bg-muted w-9 h-9 items-center justify-center cursor-pointer font-semibold">
                        {$session.data?.user?.name?.charAt(0) || $session.data?.user?.email?.charAt(0)}
                    </div>
                    {/if}
                    <div class="hidden md:flex flex-col items-start text-xs">
                        <span class="font-semibold">{$session.data?.user?.name}</span>
                        <span class="text-muted-foreground">{$session.data?.user?.email}</span>
                    </div>
                    <ChevronDown size={14} class="hidden md:flex" />
                </div>
            {/snippet}
            <div class="flex flex-col gap-2 p-1 min-w-40">
                <a href="/settings/billing" class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm">
                    <CreditCard size={16} />
                    Billing
                </a>
                <a href="/settings/account" class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm">
                    <Settings size={16} />
                    Account
                </a>
                {#if $session.data?.session?.impersonatedBy}
                <button onclick={handleStopImpersonation} class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm">
                    <Ban size={16} class="text-destructive" />
                    Stop Impersonation
                </button>
                {/if}
                {#if $session.data?.user?.role === 'admin'}
                {@const isAdmin = page.url.pathname.startsWith('/admin')}
                    <a href={isAdmin ? '/dashboard' : '/admin/dashboard'} class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm">
                        <ArrowLeftRight size={16} />
                        {#if isAdmin}
                            User
                        {:else}
                            Admin
                        {/if}
                    </a>
                {/if}
                <button type="button" class="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-muted text-sm" onclick={() => authClient.signOut()}>
                    <LogOut size={16} strokeWidth={1.5} />
                    Log out
                </button>
            </div>
        </ToolBox>
    </div>
