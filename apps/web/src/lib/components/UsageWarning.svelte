<script lang="ts">
  /**
   * UsageWarning Component
   *
   * Displays a warning message when user is low on credits or has exhausted them.
   * Includes optional "Upgrade Plan" link.
   */

  import { AlertTriangle, ArrowRight } from 'lucide-svelte';

  // Props using Svelte 5 runes
  interface Props {
    minutesRemaining: number;
    showUpgradeLink?: boolean;
  }

  let { minutesRemaining, showUpgradeLink = true }: Props = $props();

  // Derived values
  let isExhausted = $derived(minutesRemaining <= 0);
  let isLow = $derived(minutesRemaining > 0 && minutesRemaining <= 5);
  let shouldShow = $derived(isExhausted || isLow);
</script>

{#if shouldShow}
  <div
    class="usage-warning {isExhausted ? 'exhausted' : 'low'}"
    data-testid="usage-warning"
    role="alert"
  >
    <div class="flex items-start gap-3">
      <AlertTriangle class="w-5 h-5 flex-shrink-0 mt-0.5" />
      <div class="flex-1">
        {#if isExhausted}
          <p class="font-medium" data-testid="exhausted-message">
            Monthly credits exhausted
          </p>
          <p class="text-sm mt-0.5 opacity-90">
            You've used all your practice minutes for this month.
          </p>
        {:else}
          <p class="font-medium" data-testid="low-credits-message">
            Low on credits
          </p>
          <p class="text-sm mt-0.5 opacity-90">
            Only {minutesRemaining} {minutesRemaining === 1 ? 'minute' : 'minutes'} remaining this month.
          </p>
        {/if}
        {#if showUpgradeLink}
          <a
            href="/pricing"
            class="inline-flex items-center gap-1.5 text-sm font-medium mt-2 hover:underline"
            data-testid="upgrade-link"
          >
            {isExhausted ? 'Upgrade Plan' : 'Get more minutes'}
            <ArrowRight class="w-4 h-4" />
          </a>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .usage-warning {
    padding: 0.875rem 1rem;
    border-radius: 0.75rem;
    border-width: 1px;
  }

  .usage-warning.exhausted {
    background-color: hsl(var(--destructive) / 0.1);
    border-color: hsl(var(--destructive) / 0.2);
    color: hsl(var(--destructive));
  }

  .usage-warning.low {
    background-color: hsl(45 93% 47% / 0.1);
    border-color: hsl(45 93% 47% / 0.2);
    color: hsl(45 93% 25%);
  }

  .usage-warning a {
    color: inherit;
  }
</style>
