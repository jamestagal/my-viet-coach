# Accessibility - Speak Phở Real

Standards for building accessible UI components.

## Semantic HTML

Use appropriate elements for their purpose:

```svelte
<!-- Good -->
<nav>
  <a href="/dashboard">Dashboard</a>
  <a href="/practice">Practice</a>
</nav>

<main>
  <h1>Practice Vietnamese</h1>
  <section>
    <h2>Select Topic</h2>
    <!-- content -->
  </section>
</main>

<button onclick={startSession}>Start Session</button>

<!-- Avoid -->
<div onclick={startSession}>Start Session</div>
<span class="link" onclick={navigate}>Dashboard</span>
```

## Keyboard Navigation

Ensure all interactions work with keyboard:

```svelte
<script lang="ts">
  function handleKeyDown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handleAction();
    }
  }
</script>

<!-- Interactive elements must be focusable -->
<button
  onclick={handleAction}
  onkeydown={handleKeyDown}
  class="focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
>
  Click or press Enter
</button>
```

## Focus Management

### Visible Focus Indicators

```svelte
<button class="
  px-4 py-2 rounded-lg
  focus:outline-none
  focus:ring-2
  focus:ring-ring
  focus:ring-offset-2
">
  Action
</button>

<input class="
  border rounded-lg px-3 py-2
  focus:outline-none
  focus:ring-2
  focus:ring-ring
  focus:border-transparent
" />
```

### Modal Focus Trap

```svelte
<script lang="ts">
  import { onMount } from 'svelte';

  let modalElement: HTMLDivElement;
  let previousActiveElement: HTMLElement | null = null;

  onMount(() => {
    previousActiveElement = document.activeElement as HTMLElement;
    modalElement.focus();

    return () => {
      previousActiveElement?.focus();
    };
  });
</script>

<div
  bind:this={modalElement}
  role="dialog"
  aria-modal="true"
  aria-labelledby="modal-title"
  tabindex="-1"
>
  <h2 id="modal-title">Session Summary</h2>
  <!-- content -->
</div>
```

## Form Labels

Always associate labels with inputs:

```svelte
<!-- Explicit association -->
<label for="email">Email address</label>
<input id="email" type="email" />

<!-- Implicit association -->
<label>
  <span>Email address</span>
  <input type="email" />
</label>

<!-- With aria-label for icon-only buttons -->
<button aria-label="Start voice session">
  <Mic class="w-5 h-5" />
</button>
```

## ARIA Attributes

Use when semantic HTML isn't sufficient:

```svelte
<!-- Loading state -->
<button disabled={isLoading} aria-busy={isLoading}>
  {#if isLoading}
    <Loader2 class="animate-spin" aria-hidden="true" />
    <span class="sr-only">Loading...</span>
  {:else}
    Submit
  {/if}
</button>

<!-- Live region for dynamic updates -->
<div aria-live="polite" aria-atomic="true" class="sr-only">
  {statusMessage}
</div>

<!-- Expandable section -->
<button
  aria-expanded={isOpen}
  aria-controls="panel-content"
  onclick={() => isOpen = !isOpen}
>
  Settings
</button>
<div id="panel-content" hidden={!isOpen}>
  <!-- content -->
</div>
```

## Screen Reader Only Content

```svelte
<!-- Tailwind sr-only class -->
<span class="sr-only">Opens in new tab</span>

<!-- Or custom -->
<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    border: 0;
  }
</style>
```

## Color and Contrast

```svelte
<!-- Don't rely on color alone -->
<div class="flex items-center gap-2">
  <span class="w-2 h-2 rounded-full {connected ? 'bg-green-500' : 'bg-red-500'}"></span>
  <span>{connected ? 'Connected' : 'Disconnected'}</span>
</div>

<!-- Error states with icon + color + text -->
{#if error}
  <div class="text-destructive flex items-center gap-2">
    <AlertCircle class="w-4 h-4" />
    <span>{error}</span>
  </div>
{/if}
```

## Voice UI Accessibility

For the voice practice feature:

```svelte
<!-- Announce connection state changes -->
<div aria-live="assertive" class="sr-only">
  {#if connectionState === 'connected'}
    Voice session connected. You can start speaking.
  {:else if connectionState === 'disconnected'}
    Voice session ended.
  {/if}
</div>

<!-- Provide text alternative for voice content -->
<div class="conversation-history" role="log" aria-label="Conversation history">
  {#each messages as message}
    <div role="article">
      <span class="sr-only">{message.role === 'user' ? 'You said' : 'Coach said'}:</span>
      {message.text}
    </div>
  {/each}
</div>
```

## Best Practices

- **Semantic first:** Use HTML elements for their intended purpose
- **Keyboard accessible:** All interactions must work without a mouse
- **Visible focus:** Never remove focus outlines without replacement
- **Labels for inputs:** Every form field needs an accessible label
- **Alt text:** All meaningful images need descriptions
- **Color isn't enough:** Use icons, text, or patterns alongside color
- **Test with screen reader:** Verify important flows work with VoiceOver/NVDA
