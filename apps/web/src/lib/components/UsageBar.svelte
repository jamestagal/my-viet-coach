<script lang="ts">
  /**
   * UsageBar Component
   *
   * Displays a progress bar showing voice practice usage.
   * Color coding: green < 75%, amber 75-90%, red > 90%
   */

  import { formatPlanName, getUsageColorClass } from '$lib/services/usage';

  // Props using Svelte 5 runes
  interface Props {
    plan: 'free' | 'basic' | 'pro';
    minutesUsed: number;
    minutesLimit: number;
    minutesRemaining: number;
    percentUsed: number;
  }

  let { plan, minutesUsed, minutesLimit, minutesRemaining, percentUsed }: Props = $props();

  // Derived values
  let colorClass = $derived(getUsageColorClass(percentUsed));
  let displayPlan = $derived(formatPlanName(plan));

  // Ensure percentage is clamped between 0 and 100
  let clampedPercent = $derived(Math.min(100, Math.max(0, percentUsed)));
</script>

<div class="usage-bar" data-testid="usage-bar">
  <div class="flex justify-between text-sm text-muted-foreground mb-1.5">
    <span class="font-medium capitalize" data-testid="plan-name">{displayPlan} plan</span>
    <span data-testid="minutes-display">
      {minutesUsed}/{minutesLimit} minutes
    </span>
  </div>
  <div
    class="h-2 bg-muted rounded-full overflow-hidden"
    role="progressbar"
    aria-valuenow={percentUsed}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-label="Usage progress"
  >
    <div
      class="h-full transition-all duration-300 {colorClass}"
      style="width: {clampedPercent}%"
      data-testid="progress-fill"
    ></div>
  </div>
  {#if minutesRemaining <= 0}
    <p class="text-destructive text-xs mt-1.5" data-testid="credits-exhausted">
      No credits remaining
    </p>
  {:else if minutesRemaining <= 5}
    <p class="text-amber-600 text-xs mt-1.5" data-testid="low-credits-warning">
      {minutesRemaining} {minutesRemaining === 1 ? 'minute' : 'minutes'} remaining
    </p>
  {/if}
</div>

<style>
  .usage-bar {
    width: 100%;
  }
</style>
