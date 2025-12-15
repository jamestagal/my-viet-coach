# Svelte Components - Speak Phở Real

Standards for building Svelte 5 components with runes.

## Component Structure

```svelte
<script lang="ts">
  // 1. Imports
  import { onMount } from 'svelte';
  import { Button } from '$lib/components/ui/button';
  import type { User } from '$lib/types';

  // 2. Props (using $props rune)
  interface Props {
    user: User;
    onSelect?: (user: User) => void;
  }
  let { user, onSelect }: Props = $props();

  // 3. State (using $state rune)
  let isLoading = $state(false);
  let error = $state('');

  // 4. Derived values (using $derived rune)
  let displayName = $derived(user.name || user.email);

  // 5. Effects (using $effect rune - use sparingly)
  $effect(() => {
    console.log('User changed:', user.id);
  });

  // 6. Functions
  async function handleClick() {
    isLoading = true;
    try {
      onSelect?.(user);
    } finally {
      isLoading = false;
    }
  }
</script>

<!-- 7. Template -->
<div class="user-card">
  <span>{displayName}</span>
  <Button onclick={handleClick} disabled={isLoading}>
    Select
  </Button>
</div>

<!-- 8. Styles (scoped by default) -->
<style>
  .user-card {
    /* Use Tailwind classes in template instead when possible */
  }
</style>
```

## Svelte 5 Runes

### $state - Reactive State

```svelte
<script lang="ts">
  // Simple state
  let count = $state(0);

  // Object state (deep reactivity)
  let user = $state({ name: '', email: '' });

  // Array state
  let items = $state<string[]>([]);
</script>
```

### $derived - Computed Values

```svelte
<script lang="ts">
  let firstName = $state('');
  let lastName = $state('');

  // Automatically updates when dependencies change
  let fullName = $derived(`${firstName} ${lastName}`.trim());

  // Complex derivations
  let isValid = $derived(firstName.length > 0 && lastName.length > 0);
</script>
```

### $props - Component Props

```svelte
<script lang="ts">
  // With defaults
  interface Props {
    title: string;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
  }
  let { title, variant = 'primary', disabled = false }: Props = $props();
</script>
```

### $effect - Side Effects

```svelte
<script lang="ts">
  let searchQuery = $state('');

  // Runs when searchQuery changes
  $effect(() => {
    if (searchQuery.length > 2) {
      fetchResults(searchQuery);
    }
  });

  // Cleanup pattern
  $effect(() => {
    const timer = setInterval(() => {}, 1000);
    return () => clearInterval(timer);
  });
</script>
```

## Component Patterns

### Event Handlers

```svelte
<script lang="ts">
  interface Props {
    onSubmit?: (data: FormData) => void;
  }
  let { onSubmit }: Props = $props();

  function handleSubmit(event: SubmitEvent) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    onSubmit?.(formData);
  }
</script>

<!-- Use onclick, not on:click (Svelte 5) -->
<button onclick={handleSubmit}>Submit</button>
```

### Slots and Children

```svelte
<!-- Parent.svelte -->
<script lang="ts">
  import { type Snippet } from 'svelte';

  interface Props {
    children: Snippet;
    header?: Snippet;
  }
  let { children, header }: Props = $props();
</script>

<div class="card">
  {#if header}
    <header>{@render header()}</header>
  {/if}
  <main>{@render children()}</main>
</div>
```

### Conditional Rendering

```svelte
{#if isLoading}
  <Spinner />
{:else if error}
  <ErrorMessage message={error} />
{:else}
  <Content {data} />
{/if}
```

### List Rendering

```svelte
{#each items as item (item.id)}
  <ListItem {item} />
{:else}
  <EmptyState />
{/each}
```

## Best Practices

- **Single Responsibility:** One component = one purpose
- **Composition:** Build complex UIs from simple components
- **Props Down, Events Up:** Data flows down, events bubble up
- **Minimal State:** Keep state as local as possible
- **TypeScript:** Always use `lang="ts"` and type props
- **Tailwind First:** Use Tailwind classes over `<style>` blocks
- **No Prop Drilling:** Use context or stores for deep data passing

## Component Location

```
src/lib/components/
  ui/                    # Generic UI components (Button, Modal, Input)
  layout/                # Layout components (Header, Sidebar, Footer)
  voice/                 # Voice-specific components (VoiceOrb, Transcript)
  forms/                 # Form components (LoginForm, SettingsForm)
```
