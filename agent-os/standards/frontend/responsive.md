# Responsive Design - Speak Phở Real

Standards for mobile-first responsive layouts with Tailwind CSS.

## Breakpoints

Use Tailwind's default breakpoints consistently:

| Breakpoint | Min Width | Use For |
|------------|-----------|---------|
| (default) | 0px | Mobile phones |
| `sm:` | 640px | Large phones, small tablets |
| `md:` | 768px | Tablets |
| `lg:` | 1024px | Laptops |
| `xl:` | 1280px | Desktops |
| `2xl:` | 1536px | Large desktops |

## Mobile-First Approach

Start with mobile styles, add breakpoint modifiers for larger screens:

```svelte
<!-- Good: Mobile-first -->
<div class="px-4 md:px-8 lg:px-12">
  <h1 class="text-2xl md:text-3xl lg:text-4xl">
    Practice Vietnamese
  </h1>
</div>

<!-- Avoid: Desktop-first (harder to maintain) -->
<div class="px-12 md:px-8 sm:px-4">
  ...
</div>
```

## Common Patterns

### Responsive Grid

```svelte
<!-- 1 column mobile → 2 columns tablet → 3 columns desktop -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div class="bg-card p-4 rounded-lg">Item 1</div>
  <div class="bg-card p-4 rounded-lg">Item 2</div>
  <div class="bg-card p-4 rounded-lg">Item 3</div>
</div>
```

### Responsive Flex

```svelte
<!-- Stack on mobile, row on tablet+ -->
<div class="flex flex-col sm:flex-row gap-4">
  <button class="px-4 py-2">Action 1</button>
  <button class="px-4 py-2">Action 2</button>
</div>
```

### Hide/Show Elements

```svelte
<!-- Hide on mobile, show on desktop -->
<nav class="hidden lg:flex">
  Desktop navigation
</nav>

<!-- Show on mobile, hide on desktop -->
<button class="lg:hidden">
  <Menu class="w-6 h-6" />
</button>
```

### Responsive Typography

```svelte
<h1 class="text-2xl sm:text-3xl md:text-4xl font-bold">
  Speak Phở Real
</h1>
<p class="text-sm md:text-base text-muted-foreground">
  Practice Vietnamese with AI
</p>
```

### Responsive Spacing

```svelte
<section class="py-8 md:py-12 lg:py-16">
  <div class="container mx-auto px-4 md:px-6 lg:px-8">
    <!-- content -->
  </div>
</section>
```

## Voice Practice Page

Mobile-optimized voice UI:

```svelte
<!-- Full-screen voice orb on mobile -->
<div class="min-h-screen flex flex-col">
  <!-- Header: compact on mobile -->
  <header class="p-4 md:p-6 flex justify-between items-center">
    <h1 class="text-lg md:text-xl">Practice</h1>
    <button class="p-2">
      <X class="w-5 h-5" />
    </button>
  </header>

  <!-- Main: centered voice orb -->
  <main class="flex-1 flex items-center justify-center p-4">
    <div class="w-32 h-32 md:w-40 md:h-40 rounded-full bg-primary/10">
      <!-- Voice orb -->
    </div>
  </main>

  <!-- Transcript: scrollable area -->
  <div class="h-48 md:h-64 overflow-y-auto p-4 bg-muted/50">
    <!-- Conversation history -->
  </div>

  <!-- Controls: fixed bottom on mobile -->
  <footer class="p-4 md:p-6 flex justify-center gap-4">
    <button class="p-4 rounded-full bg-destructive">
      <PhoneOff class="w-6 h-6" />
    </button>
  </footer>
</div>
```

## Touch Targets

Ensure touch targets are at least 44x44px:

```svelte
<!-- Good: Large touch target -->
<button class="p-3 min-w-[44px] min-h-[44px]">
  <Mic class="w-6 h-6" />
</button>

<!-- Good: Padding creates touch area -->
<a href="/settings" class="flex items-center gap-2 py-3 px-4">
  <Settings class="w-5 h-5" />
  <span>Settings</span>
</a>
```

## Container Widths

```svelte
<!-- Max-width containers for readability -->
<div class="max-w-sm mx-auto">
  <!-- Login form: narrow -->
</div>

<div class="max-w-2xl mx-auto">
  <!-- Content: medium -->
</div>

<div class="max-w-6xl mx-auto">
  <!-- Dashboard: wide -->
</div>

<div class="container mx-auto px-4">
  <!-- Responsive container with padding -->
</div>
```

## Testing Checklist

- [ ] Test at 320px width (small phones)
- [ ] Test at 375px width (iPhone)
- [ ] Test at 768px width (tablet)
- [ ] Test at 1024px width (laptop)
- [ ] Test landscape orientation on mobile
- [ ] Verify touch targets are tappable
- [ ] Check text remains readable
- [ ] Verify scrolling works smoothly

## Best Practices

- **Mobile-first:** Default styles for mobile, breakpoints for larger
- **Test on real devices:** Emulators miss touch and performance issues
- **Avoid fixed heights:** Use min-height or flex-grow for variable content
- **Readable text:** Minimum 16px base font size on mobile
- **Thumb-friendly:** Place important actions in easy reach zones
- **Performance:** Optimize images and reduce JS on mobile
