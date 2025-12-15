# CSS & Tailwind - Speak Phở Real

Standards for styling with Tailwind CSS.

## Tailwind First

Use Tailwind utility classes for all styling. Avoid custom CSS unless absolutely necessary.

```svelte
<!-- Good: Tailwind classes -->
<button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
  Click me
</button>

<!-- Avoid: Custom CSS -->
<button class="my-button">Click me</button>
<style>
  .my-button {
    padding: 0.5rem 1rem;
    background: var(--primary);
  }
</style>
```

## Design Tokens

Use CSS variables defined in `app.css` for consistent theming:

```css
/* Theme colors (defined in tailwind config) */
--background      /* Page background */
--foreground      /* Primary text */
--primary         /* Brand/action color */
--primary-foreground
--secondary       /* Secondary actions */
--muted           /* Subdued backgrounds */
--muted-foreground
--accent          /* Highlights */
--destructive     /* Errors, dangerous actions */
--border          /* Borders */
--ring            /* Focus rings */
```

## Common Patterns

### Layout

```svelte
<!-- Full-height page with centered content -->
<div class="min-h-screen flex items-center justify-center">
  <div class="max-w-md w-full px-4">
    <!-- Content -->
  </div>
</div>

<!-- Responsive grid -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <!-- Items -->
</div>

<!-- Flex with gap -->
<div class="flex flex-col sm:flex-row gap-4">
  <!-- Items -->
</div>
```

### Cards

```svelte
<div class="bg-card rounded-xl border shadow-sm p-6">
  <h3 class="text-lg font-semibold text-foreground">Title</h3>
  <p class="text-muted-foreground mt-2">Description</p>
</div>
```

### Buttons

```svelte
<!-- Primary -->
<button class="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
  Primary
</button>

<!-- Secondary -->
<button class="px-4 py-2 bg-secondary text-secondary-foreground rounded-lg hover:bg-secondary/80 transition-colors">
  Secondary
</button>

<!-- Ghost -->
<button class="px-4 py-2 text-foreground hover:bg-muted rounded-lg transition-colors">
  Ghost
</button>

<!-- Destructive -->
<button class="px-4 py-2 bg-destructive text-destructive-foreground rounded-lg hover:bg-destructive/90 transition-colors">
  Delete
</button>
```

### Forms

```svelte
<input
  type="text"
  class="w-full px-3 py-2 bg-background border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring"
  placeholder="Enter text..."
/>

<label class="flex items-center gap-2 text-sm text-muted-foreground">
  <input type="checkbox" class="rounded border-border" />
  Remember me
</label>
```

### Animations

```svelte
<!-- Fade in -->
<div class="animate-fade-in">Content</div>

<!-- Pulse (loading) -->
<div class="animate-pulse bg-muted rounded h-4 w-32"></div>

<!-- Custom transition -->
<button class="transition-all duration-200 hover:scale-105">
  Hover me
</button>
```

## Responsive Design

Use Tailwind breakpoints consistently:

- `sm:` - 640px+ (large phones)
- `md:` - 768px+ (tablets)
- `lg:` - 1024px+ (laptops)
- `xl:` - 1280px+ (desktops)

```svelte
<!-- Mobile-first approach -->
<div class="px-4 md:px-8 lg:px-12">
  <h1 class="text-2xl md:text-3xl lg:text-4xl">Responsive heading</h1>
</div>
```

## Dark Mode

The app uses CSS variables that automatically adjust for dark mode. No need for explicit `dark:` classes when using theme colors.

```svelte
<!-- Automatically works in dark mode -->
<div class="bg-background text-foreground">
  <p class="text-muted-foreground">Subdued text</p>
</div>
```

## Best Practices

- **Mobile-first:** Start with mobile styles, add breakpoint modifiers for larger screens
- **Use theme colors:** Always use `bg-primary`, `text-foreground`, etc. instead of hardcoded colors
- **Consistent spacing:** Use Tailwind spacing scale (4, 6, 8, 12, etc.)
- **No arbitrary values:** Avoid `w-[137px]`; extend Tailwind config if needed
- **Group related classes:** Keep layout, spacing, colors, and states grouped logically
- **bits-ui components:** Use bits-ui for complex interactive components (modals, dropdowns, etc.)
