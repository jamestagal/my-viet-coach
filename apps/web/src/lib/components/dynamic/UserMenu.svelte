<script>
    import { page } from '$app/state';
    import { goto, invalidate } from '$app/navigation';
    import { authClient } from '@actions/authClient';
    import { toast } from '@components/Toast.svelte';
    import ToolBox from '@components/ToolBox.svelte';
    import Button from '@components/Button.svelte';
    import CreditCard from '@icons/credit-card.svelte';
    import Settings from '@icons/settings.svelte';
    import LogOut from '@icons/log-out.svelte';
    import Ban from '@icons/ban.svelte';
    import ArrowLeftRight from '@icons/arrow-left-right.svelte';
    import ChevronDown from '@icons/chevron-down.svelte';

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
            <span class="badge bg-primary-accent">Impersonating</span>
        {/if}
        <ToolBox position="bottom" closeOnClick={true}>
            {#snippet trigger()}
                <div class="flex flex-row items-center gap-2 rounded-xl p-1 hover:bg-primary-2">
                    {#if $session.data?.user?.image}
                        <img src={$session.data?.user?.image} alt="User Avatar" class="w-8 h-8 rounded-full" />
                    {:else}
                    <div class="flex flex-row rounded-full bg-primary-2 w-9 h-9 items-center justify-center cursor-pointer font-semibold">
                        {$session.data?.user?.name?.charAt(0) || $session.data?.user?.email?.charAt(0)}
                    </div>
                    {/if}
                    <div class="hidden md:flex flex-col items-start text-xs">
                        <span class="font-semibold">{$session.data?.user?.name}</span>
                        <span class="text-secondary-4">{$session.data?.user?.email}</span>
                    </div>
                    <ChevronDown size={14} class="hidden md:flex" />
                </div>
            {/snippet}
            <div class="flex flex-col gap-2 p-1 min-w-40">
                <a href="/settings/billing" class="button menu">
                    <CreditCard size={16} />
                    Billing
                </a>
                <a href="/settings/account" class="button menu">
                    <Settings size={16} />
                    Account
                </a>
                {#if $session.data?.session?.impersonatedBy}
                <button onclick={handleStopImpersonation} class="button menu">
                    <Ban size={16} color="red" />
                    Stop Impersonation
                </button>
                {/if}
                {#if $session.data?.user?.role === 'admin'}
                {@const isAdmin = page.url.pathname.startsWith('/admin')}
                    <a href={isAdmin ? '/dashboard' : '/admin/dashboard'} class="button menu">
                        <ArrowLeftRight size={16} />
                        {#if isAdmin}
                            User
                        {:else}
                            Admin
                        {/if}
                    </a>
                {/if}
                <button type="button" class="button menu" onclick={() => authClient.signOut()}>
                    <LogOut size={16} strokeWidth={1.5} />
                    Log out
                </button>
            </div>
        </ToolBox>
    </div>